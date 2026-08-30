from __future__ import annotations

import json
import math
import re
import shutil
import unicodedata
from difflib import SequenceMatcher
import time
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps

from .adb import AdbClient, AdbError
from .gestures import (
    TouchDevice,
    find_touch_device,
    perform_scroll,
    scroll_motionevent,
    scroll_sendevent,
    scroll_swipe,
)
from .governor import clean_alliance, clean_name, digits, finalize_record
from .imaging import image_size, match_fingerprints, row_grid_offset
from .ocr import available_languages, find_tessdata, find_tesseract, ocr_batch
from .profiles import DeviceProfile
from .ranking_reader import parse_ranking_row
from .runs import DeviceLock, safe_serial, utc_now
from .scan_export import write_exports


@dataclass(frozen=True)
class ScanOptions:
    kingdom: int
    amount: int = 300
    scan_name: str = "kingdom"
    formats: set[str] = field(default_factory=lambda: {"xlsx", "csv", "jsonl"})
    evidence: str = "review"
    open_wait: float = 1.8
    panel_wait: float = 0.8
    close_wait: float = 0.5
    # So lan lui lai toi da moi trang khi vuot qua tron. Het so lan ma van qua
    # thi de nguyen va ghi vao rankGaps — bo sot con hon lui vo tan.
    scroll_corrections: int = 4
    # So hang bam moi lan vuot. 1 = bam dong dau, keo len dung mot dong, doc
    # lai. 4 = cach cua RokTracker.
    #
    # Bam nhieu hang moi trang dat cuoc rang toa do hang 2, 3, 4 van dung sau
    # khi danh sach dung lai — chi dung neu cu vuot dap trung phoc mot so
    # nguyen dong. ROK la Unity, danh sach luon troi them mot chut, nen cai dat
    # cuoc do thua dan qua tung trang roi den luc bam nham nguoi. RokTracker
    # (MIT) cung vay: bang Y cua no co bay gia tri nhung hai cai cuoi chi dung
    # cho nguoi thu 998 va 999, suot ca lan quet no chi bam bon hang tren.
    #
    # Bam mot hang thi khong con dat cuoc nao: vuot lo hay vuot thieu deu thanh
    # sai so cua RIENG vong do chu khong cong don sang vong sau. Gia phai tra la
    # mot lan vuot cho moi nguoi thay vi moi bon nguoi — nhung phan nang nhat
    # cua moi nguoi van la mo ho so va OCR ba man, nen ban quet cham hon chung
    # mot phan ba chu khong phai gap bon.
    rows_per_page: int = 1
    # Kieu vuot. Xem gestures.py: `input swipe` khong bao giu yen ngon tay
    # truoc khi nhac nen luon con quan tinh. Mac dinh dung lai cach cua
    # RokTracker, va tu lui ve cach khac neu may khong cho.
    scroll_gesture: str = "sendevent"
    # Chieu xoay cua tam cam ung so voi man hinh: direct | rot90 | rot270.
    # None = tu suy tu ti le khung hinh. `scroll-calibrate` do duoc cai dung.
    scroll_mapping: str | None = None
    # Nguong giong nhau giua ten tren danh sach va ten trong ho so. Duoi nguong
    # nay coi nhu bam nham nguoi.
    name_match_min: float = 0.55
    scroll_wait: float = 1.6
    resume_directory: Path | None = None


def _page_top_rank(hints: list[dict[str, Any]]) -> int | None:
    """Thu hang cua dong TREN CUNG cua trang, lay theo da so.

    Sau dong tren mot man hinh luon lien tiep, nen moi dong deu cho ra mot
    du doan `rank - vi_tri`. Lay gia tri xuat hien nhieu nhat: mot dong OCR
    hong khong lam lech ca trang.
    """
    votes: dict[int, int] = {}
    for index, hint in enumerate(hints):
        value = (hint or {}).get("rankFromScreen")
        if value:
            top = int(value) - index
            if top >= 1:
                votes[top] = votes.get(top, 0) + 1
    if not votes:
        return None
    return max(votes.items(), key=lambda item: (item[1], -item[0]))[0]


def _name_similarity(left: str, right: str) -> float:
    """Do giong nhau giua hai ten, bo qua khac biet do OCR.

    Ten nguoi choi ROK day ky tu trang tri (chi so tren, chu Han, Cyrillic) nen
    so bang dau bang la se loai bo gan het. Chuan hoa ve chu thuong khong dau
    roi do ty le trung, du de phan biet "cung mot nguoi, OCR hoi lech" voi
    "hai nguoi khac han".
    """
    def normalise(value: str) -> str:
        folded = unicodedata.normalize("NFKD", value.casefold())
        return "".join(c for c in folded if c.isalnum())

    a, b = normalise(left), normalise(right)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


class KingdomScanner:
    def __init__(
        self,
        client: AdbClient,
        serial: str,
        profile: DeviceProfile,
        artifacts_root: Path,
        options: ScanOptions,
        *,
        confirmed: bool,
        tesseract_path: str | None = None,
        tessdata_path: str | None = None,
        progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        if not confirmed:
            raise AdbError(
                "Kingdom scan bị chặn. Thêm --confirm để cho phép điều hướng game."
            )
        if not 1 <= options.amount <= 500:
            raise AdbError("--amount phải từ 1 đến 500.")
        if options.evidence not in {"all", "review", "none"}:
            raise AdbError("--evidence chỉ nhận all, review hoặc none.")
        self.client = client
        self.serial = serial
        self.profile = profile
        self.artifacts_root = artifacts_root
        self.options = options
        self.tesseract = find_tesseract(tesseract_path)
        self.tessdata = find_tessdata(self.tesseract, tessdata_path)
        self.languages = available_languages(self.tessdata)
        self.progress = progress or (lambda _event: None)
        self.size = profile.reference_resolution

        if options.resume_directory:
            self.directory = options.resume_directory.resolve()
        else:
            timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
            scan_id = safe_serial(
                f"{options.scan_name}-kd{options.kingdom}-{timestamp}"
            )
            self.directory = (
                artifacts_root / "scans" / safe_serial(serial) / scan_id
            ).resolve()
        self.state_path = self.directory / "state.json"
        self.records: list[dict[str, Any]] = []
        # Khoi tao o day, KHONG phai trong _load_state: _load_state thoat som
        # khi khong co --resume, nen dat trong do la thuoc tinh chi ton tai o
        # duong resume. _save_state goi ngay tu nguoi dau tien, va no no ra
        # AttributeError.
        # Nhung hang bam vao ma khong mo duoc ho so. Day moi la thuoc do that
        # cua do phu: "30 ban ghi" khong noi gi neu phai bam 45 lan moi duoc 30.
        self.missed_rows: list[dict[str, Any]] = []
        self.last_miss_reason: dict[str, Any] | None = None
        self.rank_gaps: list[dict[str, Any]] = []
        # Thu hang cao nhat da THUC SU bam toi (ke ca bam truot). Moi thu
        # hang lon hon so nay + 1 o trang sau la nguoi bi nhay qua.
        self.last_covered_rank: int | None = None
        self.started_at = utc_now()
        self.attempted_rank = 0
        # Danh sach dang nam lech bao nhieu pixel so voi luoi trong profile.
        # Do lai sau MOI lan chup man; xem imaging.row_grid_offset.
        self.row_shift = 0
        self._touch: TouchDevice | None = None
        self._touch_probed = False
        self._gesture_warned = False
        self._load_state()

    def _load_state(self) -> None:
        if not self.options.resume_directory:
            return
        try:
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise AdbError(f"Không resume được state {self.state_path}: {exc}") from exc
        if (
            state.get("serial") != self.serial
            or state.get("kingdom") != self.options.kingdom
        ):
            raise AdbError("State resume không khớp serial hoặc kingdom.")
        self.records = list(state.get("records", []))
        self.missed_rows = list(state.get("missedRows", []))
        self.rank_gaps = list(state.get("rankGaps", []))
        self.started_at = str(state.get("startedAt") or self.started_at)
        self.attempted_rank = int(state.get("attemptedRank") or 0)

    def _save_state(self, status: str, error: str | None = None) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        state = {
            "schemaVersion": 1,
            "serial": self.serial,
            "kingdom": self.options.kingdom,
            "targetAmount": self.options.amount,
            "startedAt": self.started_at,
            "updatedAt": utc_now(),
            "status": status,
            "attemptedRank": self.attempted_rank,
            "records": self.records,
            # Ho thu hang phai song sot qua --resume. Khong luu thi chay tiep
            # mot lan la moi dau vet bi nhay qua bien mat, va ban quet trong
            # nhu mot ban quet lien mach.
            "missedRows": self.missed_rows,
            "rankGaps": self.rank_gaps,
        }
        if error:
            state["error"] = error
        temporary = self.state_path.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temporary.replace(self.state_path)

    def _screen_matches(self, screenshot: Path, screen: str) -> bool:
        matched, _ = match_fingerprints(
            screenshot, self.profile.screens.get(screen, ())
        )
        return matched

    def _recognise_screen(self, screenshot: Path) -> tuple[str | None, int | None]:
        """Man hinh nay khop voi man nao trong profile, va lech bao nhieu bit.

        Bao "khong phai man ho so" thi khong du de sua: van con la danh sach,
        hay la mot bang khac chen ngang, hay la ho so mo nhung nguong qua chat
        — ba nguyen nhan do sua ba kieu khac han nhau.
        """
        best_name: str | None = None
        best_distance: int | None = None
        for name, prints in self.profile.screens.items():
            if not prints:
                continue
            matched, comparisons = match_fingerprints(screenshot, prints)
            distance = min(
                (c["distance"] for c in comparisons if "distance" in c), default=None
            )
            if matched:
                return name, distance
            if distance is not None and (best_distance is None or distance < best_distance):
                best_name, best_distance = name, distance
        return (f"gan nhat: {best_name}" if best_name else None), best_distance

    def _capture(self, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        result = self.client.screenshot(self.serial, destination)
        self.size = image_size(result)
        return result

    def _ensure_power_ranking(self) -> None:
        foreground = self.client.foreground_activity(self.serial)
        if not foreground.startswith(f"{self.profile.game_package}/"):
            raise AdbError(
                f"{self.serial} không mở ROK; foreground={foreground or 'unknown'}"
            )
        screenshot = self._capture(self.directory / "prepare.png")
        if self._screen_matches(screenshot, "individual-power-ranking"):
            return
        if not self._screen_matches(screenshot, "rankings-menu"):
            raise AdbError(
                "Phải đặt điện thoại ở menu Rankings hoặc Individual Power Rankings."
            )
        self.client.tap(
            self.serial, *self.profile.point("ranking.individual-power", self.size)
        )
        time.sleep(self.options.open_wait)
        screenshot = self._capture(self.directory / "prepared-power-ranking.png")
        if not self._screen_matches(screenshot, "individual-power-ranking"):
            raise AdbError(
                "Đã chạm Individual Power nhưng guard không nhận ra màn kết quả."
            )

    def _preprocess_batch(
        self,
        screenshot: Path,
        regions: list[str],
        destination: Path,
        *,
        threshold: int | None = None,
        white_text: bool = False,
    ) -> list[Path]:
        paths: list[Path] = []
        destination.mkdir(parents=True, exist_ok=True)
        with Image.open(screenshot) as source:
            for index, region in enumerate(regions):
                crop = source.crop(self._region_box(region))
                crop = crop.resize((crop.width * 3, crop.height * 3))
                if white_text:
                    hsv = crop.convert("HSV")
                    mask = Image.new("L", hsv.size)
                    pixels: list[int] = []
                    for y in range(hsv.height):
                        for x in range(hsv.width):
                            _hue, saturation, value = hsv.getpixel((x, y))
                            pixels.append(
                                0 if saturation < 180 and value > 150 else 255
                            )
                    mask.putdata(pixels)
                    crop = mask
                elif threshold is None:
                    crop = ImageEnhance.Contrast(crop).enhance(2)
                else:
                    grayscale = ImageOps.grayscale(crop)
                    crop = grayscale.point(
                        lambda pixel: 255 if pixel > threshold else 0
                    )
                path = destination / f"{index:02}-{safe_serial(region)}.png"
                crop.save(path)
                paths.append(path)
        return paths

    def _region_box(self, region: str) -> tuple[int, int, int, int]:
        """Vung cat, da dich theo do lech cua luoi dong.

        Chi cac vung `ranking.*` moi troi theo danh sach. Ho so nguoi choi la
        mot bang rieng, no nam yen mot cho — dich no theo la cat truot.
        """
        left, top, right, bottom = self.profile.box(region, self.size)
        if self.row_shift and region.startswith("ranking."):
            return (left, top + self.row_shift, right, bottom + self.row_shift)
        return (left, top, right, bottom)

    def _measure_row_shift(self, screenshot: Path) -> None:
        shift = row_grid_offset(
            screenshot,
            expected_top=self.profile.box("ranking.row1", self.size)[1],
            pitch=round(self._row_pitch()),
        )
        if shift is None or shift == self.row_shift:
            return
        previous, self.row_shift = self.row_shift, shift
        if abs(shift - previous) > 2:
            self.progress(
                {"serial": self.serial, "event": "row-shift", "pixels": shift}
            )

    def _ocr_regions(
        self,
        screenshot: Path,
        regions: list[str],
        destination: Path,
        *,
        threshold: int | None = None,
        white_text: bool = False,
        languages: list[str] | None = None,
        page_segmentation: int = 7,
    ) -> list[str]:
        images = self._preprocess_batch(
            screenshot,
            regions,
            destination,
            threshold=threshold,
            white_text=white_text,
        )
        return ocr_batch(
            images,
            executable=self.tesseract,
            tessdata=self.tessdata,
            languages=languages or self.languages,
            list_file=destination / "inputs.txt",
            page_segmentation=page_segmentation,
        )

    def _read_ranking_hints(self, page: int) -> list[dict[str, Any]]:
        page_root = self.directory / "ranking-pages"
        screenshot = self._capture(page_root / f"page-{page:04d}.png")
        if not self._screen_matches(screenshot, "individual-power-ranking"):
            raise AdbError("Mất màn Individual Power Rankings trước khi đọc trang.")
        self._measure_row_shift(screenshot)
        regions = [f"ranking.row{row}" for row in range(1, 7)]
        rows = self._ocr_regions(
            screenshot,
            regions,
            page_root / f"page-{page:04d}-crops",
            page_segmentation=6,
        )

        # Doc THU HANG THAT tren man hinh, khong dung vi tri hang lam thu hang.
        #
        # Truoc day truong `rank` la bo dem luot thu, nen mot nguoi bi bo qua
        # khong de lai dau vet nao: ban quet van danh so 1,2,3... lien mach.
        # Chinh vi vay ba nguoi hang 6,7,8 bien mat ma ket qua trong van sach.
        #
        # Chu so thu hang nam o x 0.136-0.198, ngay ben trai vung doc ten (bat
        # dau tu 0.1979) — do la ly do no chua bao gio duoc nhin toi.
        rank_regions = [f"ranking.rank{row}" for row in range(1, 7)]
        try:
            rank_texts = self._ocr_regions(
                screenshot,
                rank_regions,
                page_root / f"page-{page:04d}-rank-crops",
                white_text=True,
                page_segmentation=7,
            )
        except Exception:
            rank_texts = [""] * 6

        hints = []
        for index, text in enumerate(rows, 1):
            digits_only = re.sub(r"\D", "", rank_texts[index - 1] or "")
            true_rank = int(digits_only) if digits_only else None
            hint = parse_ranking_row(text, true_rank or index, None)
            # Phan biet ro thu hang doc duoc voi thu hang suy tu vi tri hang:
            # cai thu hai khong dung de phat hien bo sot duoc.
            hint["rankFromScreen"] = true_rank
            hints.append(hint)
        return hints

    def _cleanup_panels(self) -> None:
        try:
            self.client.tap(
                self.serial, *self.profile.point("more-info.close", self.size)
            )
            time.sleep(self.options.close_wait)
            self.client.tap(
                self.serial, *self.profile.point("governor.close", self.size)
            )
            time.sleep(self.options.close_wait)
        except AdbError:
            pass

    def _scan_governor(
        self, row: int, hint: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        self.attempted_rank += 1
        governor_dir = self.directory / "evidence" / f"rank-{self.attempted_rank:04d}"
        # Bam theo luoi DA DO, khong theo luoi trong profile. Day moi la cho
        # chua benh "toi hang duoi la bam nham xuong dong ke tiep": khong phai
        # toa do hang sai, ma ca danh sach dang nam lech.
        column, height = self.profile.point(f"ranking.row{row}", self.size)
        self.client.tap(self.serial, column, height + self.row_shift)
        time.sleep(self.options.open_wait)
        profile_image = self._capture(governor_dir / "profile.png")
        if not self._screen_matches(profile_image, "governor-profile"):
            # Anh nay la bang chung duy nhat noi duoc vi sao cu bam truot. Ghi
            # lai man hinh nhan ra duoc va giu anh lai bat ke --evidence, vi
            # doan lai sau khi anh bi don di la khong the.
            screen, distance = self._recognise_screen(profile_image)
            self.last_miss_reason = {
                "screen": screen,
                "distance": distance,
                "shot": str(profile_image),
            }
            # Neu cu bam co mo ra mot bang nao do, phai dong lai — de nguyen thi
            # cu bam cua hang KE TIEP roi vao bang do chu khong vao danh sach,
            # va mot lan truot keo theo ca chuoi truot.
            #
            # Chi dong khi NHAN RA la bang. Bam mu vao toa do nut dong trong khi
            # man hinh dang la danh sach co the trung nut X cua chinh bang xep
            # hang, va the la mat luon man hinh dang quet.
            if screen in {"more-info", "governor-profile"}:
                self._cleanup_panels()
            return None

        general_regions = [
            "governor.id",
            "governor.name",
            "governor.alliance",
            "governor.killpoints",
            "governor.power",
            "governor.acclaim",
            "governor.acclaim-max",
        ]
        general = self._ocr_regions(
            profile_image,
            general_regions,
            governor_dir / "crops-general",
            white_text=True,
        )
        alliance_tag, alliance_name = clean_alliance(general[2])
        screen_rank = (hint or {}).get("rankFromScreen")
        record: dict[str, Any] = {
            "rank": screen_rank or self.attempted_rank,
            "rankFromScreen": screen_rank,
            "attempt": self.attempted_rank,
            "governorId": str(digits(general[0]) or ""),
            "name": clean_name(general[1]),
            "allianceTag": alliance_tag,
            "allianceName": alliance_name,
            "killPoints": digits(general[3]),
            "power": digits(general[4]),
            "acclaim": digits(general[5]),
            "highestAcclaim": digits(general[6]),
            "ocrRaw": {name: value for name, value in zip(general_regions, general)},
        }
        if hint:
            hint_name = clean_name(str(hint.get("name") or ""))

            # Doi chieu ten doc tu DANH SACH voi ten trong HO SO vua mo.
            #
            # Day la cho duy nhat phat hien duoc "bam nham nguoi". Nguoi dung
            # quan sat: toi hang 6 thi cu bam luon roi xuong tai khoan ben duoi.
            # Truoc day doan nay chi dung hint de dien vao cho trong, nen bam
            # nham la ghi thang du lieu nguoi khac vao dung vi tri do — sai ma
            # khong co dau hieu gi.
            #
            # Tha bo mot nguoi con hon ghi nham mot nguoi: bo thi dem duoc, con
            # ghi nham thi khong ai biet ma sua.
            if hint_name and record["name"]:
                if _name_similarity(hint_name, record["name"]) < self.options.name_match_min:
                    self.last_miss_reason = {
                        "reason": "ten-khong-khop",
                        "hintName": hint_name,
                        "profileName": record["name"],
                        "shot": str(profile_image),
                    }
                    self._cleanup_panels()
                    return None
            elif not hint_name:
                # Khong doc duoc ten tren danh sach thi khong the doi chieu.
                # Van ghi nhan, nhung phai noi ra la chua kiem duoc.
                record["needsReview"] = True
                record["reviewReason"] = "khong-doi-chieu-duoc-ten"

            if not record["name"] or (
                hint_name
                and record["name"].startswith(hint_name)
                and len(record["name"]) - len(hint_name) <= 3
            ):
                record["name"] = hint_name
            if not record["allianceTag"]:
                record["allianceTag"] = hint.get("allianceTag") or ""
            if not record["allianceName"]:
                record["allianceName"] = hint.get("allianceName") or ""
            if record["power"] is None:
                record["power"] = hint.get("power")

        self.client.tap(self.serial, *self.profile.point("governor.kills", self.size))
        time.sleep(self.options.panel_wait)
        kills_image = self._capture(governor_dir / "kills.png")
        if self._screen_matches(kills_image, "kill-statistics"):
            kills_regions = [
                *(f"kills.t{tier}" for tier in range(1, 6)),
                *(f"kills.t{tier}-kp" for tier in range(1, 6)),
                "kills.ranged",
            ]
            kills = self._ocr_regions(
                kills_image,
                kills_regions,
                governor_dir / "crops-kills",
                threshold=100,
                languages=["eng"],
            )
            for tier in range(1, 6):
                record[f"t{tier}Kills"] = digits(kills[tier - 1])
                record[f"t{tier}KillPoints"] = digits(kills[tier + 4])
            record["rangedPoints"] = digits(kills[10])
            record["ocrRaw"].update(
                {name: value for name, value in zip(kills_regions, kills)}
            )

        self.client.tap(
            self.serial, *self.profile.point("governor.more-info", self.size)
        )
        time.sleep(self.options.panel_wait)
        info_image = self._capture(governor_dir / "more-info.png")
        if self._screen_matches(info_image, "more-info"):
            info_regions = [
                "more-info.dead",
                "more-info.gathered",
                "more-info.assisted",
                "more-info.helps",
            ]
            info = self._ocr_regions(
                info_image, info_regions, governor_dir / "crops-info", languages=["eng"]
            )
            record.update(
                {
                    "deadTroops": digits(info[0]),
                    "resourcesGathered": digits(info[1]),
                    "resourceAssistance": digits(info[2]),
                    "helps": digits(info[3]),
                }
            )
            record["ocrRaw"].update(
                {name: value for name, value in zip(info_regions, info)}
            )

        self._cleanup_panels()
        record = finalize_record(record)
        if self.options.evidence == "none" or (
            self.options.evidence == "review" and not record["needsReview"]
        ):
            shutil.rmtree(governor_dir)
        return record

    def _row_pitch(self) -> float:
        """Khoang cach giua hai dong trong danh sach, tinh bang pixel."""
        first = self.profile.point("ranking.row1", self.size)
        second = self.profile.point("ranking.row2", self.size)
        pitch = abs(second[1] - first[1])
        return float(pitch) if pitch else self.size[1] * 0.111

    def _touch_device(self) -> TouchDevice | None:
        if self._touch is None and not self._touch_probed:
            self._touch_probed = True
            self._touch = find_touch_device(self.client, self.serial)
        return self._touch

    def _scroll(self, rows: float | None = None, direction: int = 1) -> None:
        """Cuon danh sach di DUNG bao nhieu DONG, khong phai bao nhieu phan man hinh.

        Truoc day quang duong tinh theo ti le man hinh roi hy vong no roi vao
        khoang mot trang. Gio tinh thang tu khoang cach giua hai dong doc duoc
        trong ho so thiet bi, nen "vuot 4 dong" nghia dung la 4 dong.
        """
        pitch = self._row_pitch()
        count = self.options.rows_per_page if rows is None else rows
        distance = abs(pitch * count)

        column = self.profile.point("ranking.scroll-start", self.size)[0]
        low = self.profile.point("ranking.scroll-start", self.size)[1]
        high = self.profile.point("ranking.scroll-end", self.size)[1]
        travel = abs(low - high)
        if travel < pitch:
            travel = pitch * 4

        remaining = distance
        while remaining > 0.5:
            step = min(remaining, travel)
            if direction >= 0:
                origin, target = low, round(low - step)
            else:
                origin, target = high, round(high + step)
            used = perform_scroll(
                self.client,
                self.serial,
                (column, round(origin)),
                (column, target),
                self.size,
                self.options.scroll_gesture,
                touch=self._touch_device(),
                mapping=self.options.scroll_mapping,
                settle=self.options.scroll_wait,
            )
            if used != self.options.scroll_gesture and not self._gesture_warned:
                self._gesture_warned = True
                self.progress(
                    {
                        "serial": self.serial,
                        "event": "gesture-fallback",
                        "requested": self.options.scroll_gesture,
                        "used": used,
                    }
                )
            remaining -= step

    def _top_rank(self, page: int) -> int | None:
        """Thu hang cua dong TREN CUNG dang hien tren man hinh.

        Doc ca sau dong roi lay dong nao OCR duoc, tru di khoang cach dong —
        chi tin mot dong duy nhat thi mot lan OCR hong la mat ca phep do.
        """
        return _page_top_rank(self._read_ranking_hints(page))

    def calibrate_scroll(self, rows: int, repeat: int) -> dict[str, Any]:
        """Do tren may THAT xem kieu vuot nao dich dung `rows` dong moi lan.

        Khong the ngoi doan kieu nao chay duoc tren may nao: `input
        motionevent` co tren may nay chua, tam cam ung xoay chieu nao, co
        quyen ghi vao /dev/input khong — deu la thu chi may moi tra loi duoc.
        Nen lam mot phep do: doc thu hang dong dau, vuot, doc lai, lay hieu.
        Hieu = so dong da dich. Dung bao nhieu lan lien tiep moi la dat.
        """
        with DeviceLock(self.artifacts_root, self.serial, "scroll-calibrate"):
            self.client.require_ready(self.serial)
            self._ensure_power_ranking()
            touch = self._touch_device()

            candidates: list[tuple[str, str | None]] = []
            if touch is not None:
                # Chieu xoay tam cam ung: "auto" doan tu ti le khung hinh,
                # nhung doan sai chieu thi danh sach chay NGUOC. Thu ca hai.
                for mapping in ("auto", "rot270", "direct"):
                    candidates.append(("sendevent", mapping))
            candidates.extend(
                (kind, None) for kind in ("motionevent", "swipe-slow", "swipe")
            )

            pitch = self._row_pitch()
            column = self.profile.point("ranking.scroll-start", self.size)[0]
            low = self.profile.point("ranking.scroll-start", self.size)[1]
            distance = round(pitch * rows)
            start = (column, round(low))
            end = (column, round(low) - distance)

            page = 0
            report: list[dict[str, Any]] = []
            for kind, mapping in candidates:
                deltas: list[int | None] = []
                error: str | None = None
                for _ in range(max(1, repeat)):
                    page += 1
                    before = self._top_rank(page)
                    try:
                        if kind == "sendevent":
                            assert touch is not None
                            device = (
                                touch
                                if mapping in (None, "auto")
                                else replace(touch, mapping=mapping)
                            )
                            scroll_sendevent(
                                self.client,
                                self.serial,
                                start,
                                end,
                                self.size,
                                touch=device,
                            )
                        elif kind == "motionevent":
                            scroll_motionevent(
                                self.client, self.serial, start, end, self.size
                            )
                        else:
                            scroll_swipe(
                                self.client,
                                self.serial,
                                start,
                                end,
                                self.size,
                                duration_ms=4000 if kind == "swipe-slow" else 1500,
                            )
                    except (AdbError, OSError) as exc:
                        error = str(exc)
                        break
                    time.sleep(self.options.scroll_wait)
                    page += 1
                    after = self._top_rank(page)
                    deltas.append(
                        None if (before is None or after is None) else after - before
                    )
                    self.progress(
                        {
                            "serial": self.serial,
                            "event": "calibrate",
                            "gesture": kind,
                            "mapping": mapping,
                            "before": before,
                            "after": after,
                            "moved": deltas[-1],
                            "wanted": rows,
                        }
                    )
                clean = [value for value in deltas if value is not None]
                report.append(
                    {
                        "gesture": kind,
                        "mapping": mapping,
                        "moved": deltas,
                        "exact": bool(clean)
                        and len(clean) == len(deltas)
                        and all(value == rows for value in clean),
                        "spread": (max(clean) - min(clean)) if clean else None,
                        "error": error,
                    }
                )

            winner = next((entry for entry in report if entry["exact"]), None)
            return {
                "ok": winner is not None,
                "serial": self.serial,
                "wantedRows": rows,
                "rowPitchPx": pitch,
                "distancePx": distance,
                "touchDevice": (
                    None
                    if touch is None
                    else {
                        "node": touch.node,
                        "maxX": touch.max_x,
                        "maxY": touch.max_y,
                        "protocolB": touch.protocol_b,
                        "mappingAuto": touch.resolved_mapping(self.size),
                    }
                ),
                "results": report,
                "recommended": winner,
            }

    def scan(self) -> dict[str, Any]:
        with DeviceLock(self.artifacts_root, self.serial, "kingdom-scan"):
            self._save_state("running")
            try:
                self.client.require_ready(self.serial)
                self._ensure_power_ranking()
                known_ids = {
                    str(record.get("governorId"))
                    for record in self.records
                    if record.get("governorId")
                }
                stagnant_rows = 0
                rows = max(1, min(6, self.options.rows_per_page))
                # Moi trang thu duoc NHIEU NHAT `rows` nguoi, va it hon the moi
                # khi bam truot. Nhan doi de mot nua so lan bam hong van con du
                # trang ma di het `amount`; tinh theo /4 nhu truoc thi
                # --rows-per-page 1 het trang o mot phan tu quang duong.
                max_pages = math.ceil(self.options.amount / rows) * 2 + 8
                for page in range(max_pages):
                    hints = self._read_ranking_hints(page + 1)

                    # Vuot bao nhieu cung khong the chinh xac: ROK la game
                    # Unity, danh sach co quan tinh rieng va `input swipe` luon
                    # truyen van toc luc nhac tay. Da thu vuot cham, vuot ngan,
                    # deu chi giam chu khong het.
                    #
                    # Nhung gio doc duoc thu hang THAT tren man hinh, nen khong
                    # can vuot chinh xac nua — chi can BIET minh dang o dau roi
                    # lui lai. Chong lan thi vo hai (trung se bi loc theo
                    # governorId); nhay cach moi la mat nguoi.
                    for _ in range(self.options.scroll_corrections):
                        top = _page_top_rank(hints)
                        if top is None or self.last_covered_rank is None:
                            break
                        if top <= self.last_covered_rank + 1:
                            break
                        self.progress(
                            {
                                "serial": self.serial,
                                "event": "scroll-back",
                                "page": page + 1,
                                "expected": self.last_covered_rank + 1,
                                "sawTop": top,
                            }
                        )
                        self._scroll(rows=1, direction=-1)
                        hints = self._read_ranking_hints(page + 1)

                    added = 0
                    page_top = _page_top_rank(hints)

                    # So sanh voi thu hang DA BAM TOI, khong phai thu hang NHIN
                    # THAY. Truoc day lay max cua ca sau dong dang hien, trong
                    # khi moi trang chi bam bon dong dau — hai dong duoi coi
                    # nhu da xong du chua he bam vao. Vuot lo mot dong la mat
                    # mot nguoi, va phep do bao "khong bo sot ai".
                    #
                    # Chay thu: vuot lo 1 dong moi trang, quet 30 nguoi ->
                    # mat 7 nguoi (5, 10, 15, 20, 25, 30, 35) ma rankGaps van
                    # bao 0. Do la kieu hong nguy hiem nhat: ket qua trong
                    # van sach se.
                    if page_top is not None and self.last_covered_rank is not None:
                        if page_top > self.last_covered_rank + 1:
                            gap = {
                                "page": page + 1,
                                "afterRank": self.last_covered_rank,
                                "nextRank": page_top,
                                "missing": page_top - self.last_covered_rank - 1,
                            }
                            self.rank_gaps.append(gap)
                            self.progress({"serial": self.serial, "event": "rank-gap", **gap})

                    # Cac dong tren MOT man hinh luon lien tiep nhau, nen suy
                    # thu hang tung dong tu dong dau dang tin hon la OCR rieng
                    # tung dong: mot lan doc hong khong keo ca trang di theo.
                    if page_top is not None:
                        for index, hint in enumerate(hints):
                            if hint is not None:
                                hint["rankFromScreen"] = page_top + index
                        self.last_covered_rank = max(
                            self.last_covered_rank or 0, page_top + rows - 1
                        )
                    for row in range(1, rows + 1):
                        if len(self.records) >= self.options.amount:
                            break
                        record = self._scan_governor(row, hints[row - 1])
                        if record is None:
                            # Bam vao hang nay khong mo duoc ho so. Bo dem
                            # attempted_rank VAN da tang, nen neu khong ghi lai
                            # o day thi nguoi bi bo qua bien mat khong dau vet:
                            # ket qua chi thay "30 ban ghi" va khong biet da
                            # phai bam bao nhieu lan moi duoc 30.
                            miss = {
                                "page": page + 1,
                                "row": row,
                                "attempt": self.attempted_rank,
                                "hintName": (hints[row - 1] or {}).get("name"),
                                **(self.last_miss_reason or {}),
                            }
                            self.last_miss_reason = None
                            self.missed_rows.append(miss)
                            self.progress({"serial": self.serial, "event": "row-miss", **miss})
                            continue
                        governor_id = str(record.get("governorId") or "")
                        if governor_id and governor_id not in known_ids:
                            known_ids.add(governor_id)
                            self.records.append(record)
                            added += 1
                            self._save_state("running")
                            self.progress(
                                {
                                    "serial": self.serial,
                                    "event": "governor",
                                    "rank": record.get("rank"),
                                    "name": record.get("name"),
                                    "records": len(self.records),
                                    "target": self.options.amount,
                                    "needsReview": record.get("needsReview"),
                                }
                            )
                    if len(self.records) >= self.options.amount:
                        break
                    # Dem theo HANG chu khong theo trang: nguong 3 trang cu la
                    # 12 hang khi moi trang bam 4 hang, nhung chi la 3 hang khi
                    # moi trang bam 1 — ba lan bam truot lien tiep la ban quet
                    # tu dung giua chung.
                    stagnant_rows = stagnant_rows + rows if added == 0 else 0
                    if stagnant_rows >= 12:
                        break
                    self.progress(
                        {
                            "serial": self.serial,
                            "event": "scroll",
                            "page": page + 1,
                            "records": len(self.records),
                            "target": self.options.amount,
                        }
                    )
                    self._scroll()

                captured_at = utc_now()
                metadata = {
                    "externalId": (
                        f"{safe_serial(self.serial)}-kd{self.options.kingdom}-"
                        f"{self.started_at.replace(':', '').replace('+', '-')[:19]}"
                    ),
                    "deviceId": self.serial,
                    "capturedAt": captured_at,
                    "kingdom": self.options.kingdom,
                    "coveragePercent": min(
                        100, round(len(self.records) / self.options.amount * 100)
                    ),
                }
                outputs = write_exports(
                    self.directory, self.records, metadata, self.options.formats
                )
                status = (
                    "complete"
                    if len(self.records) >= self.options.amount
                    else "partial"
                )
                self._save_state(status)
                return {
                    "ok": status == "complete",
                    "status": status,
                    "serial": self.serial,
                    "kingdom": self.options.kingdom,
                    "target": self.options.amount,
                    "records": len(self.records),
                    "reviewRequired": sum(
                        bool(record.get("needsReview")) for record in self.records
                    ),
                    "directory": str(self.directory),
                    "outputs": outputs,
                    "missedRows": len(self.missed_rows),
                    "mismatchRejected": sum(
                        1 for m in self.missed_rows if m.get("reason") == "ten-khong-khop"
                    ),
                    "rankGaps": self.rank_gaps,
                    "ranksMissing": sum(g["missing"] for g in self.rank_gaps),
                    "attempts": self.attempted_rank,
                    "missedDetail": self.missed_rows,
                }
            except KeyboardInterrupt:
                self._cleanup_panels()
                self._save_state("interrupted", "Người vận hành nhấn Ctrl+C.")
                raise
            except Exception as exc:
                self._cleanup_panels()
                self._save_state("failed", str(exc))
                raise
