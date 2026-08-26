from __future__ import annotations

import json
import math
import re
import shutil
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps

from .adb import AdbClient, AdbError
from .governor import clean_alliance, clean_name, digits, finalize_record
from .imaging import image_size, match_fingerprints
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
    # Vuot 0.875 -> 0.32 la 599 px tren man 1080, dung bang 4,96 dong. Doc 6
    # dong moi trang nen thiet ke la CO CHONG LAN mot dong — khong bao gio ho.
    #
    # Nhung 599 px trong 650 ms la 922 px/giay, du nhanh de Android coi la
    # FLING: danh sach con truot tiep sau khi nhac tay, va truot bao xa thi
    # khong xac dinh. Mot lan chay nhay 6 dong, lan khac nhay 13 dong. Cham lai
    # de thanh keo chu khong phai bung.
    scroll_duration_ms: int = 1500
    # Phan quang duong vuot so voi profile. Profile vuot 0.875 -> 0.32 = 4,96
    # dong, dung bang mot trang tru mot dong chong lan.
    #
    # Nhung ROK la game Unity, danh sach cua no co quan tinh rieng va `input
    # swipe` luon truyen van toc luc nhac tay. 599 px trong 1500 ms van la 400
    # px/giay, trong khi nguong fling cua Android chi khoang 130 px/giay. Vuot
    # cham khong bo duoc quan tinh — chi vuot NGAN moi bo duoc hau qua cua no.
    #
    # 0.5 = di ~2,5 dong moi lan. Doc 6 dong nen con du 3,5 dong dem: quan tinh
    # co nhan doi quang duong thi van chong lan, khong ho. Doi lai la nhieu
    # trang hon va cham hon. Cham ma du con hon nhanh ma thung.
    scroll_fraction: float = 0.35
    # So lan lui lai toi da moi trang khi vuot qua tron. Het so lan ma van qua
    # thi de nguyen va ghi vao rankGaps — bo sot con hon lui vo tan.
    scroll_corrections: int = 4
    scroll_wait: float = 1.6
    resume_directory: Path | None = None


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
        self.last_screen_rank: int | None = None
        self.started_at = utc_now()
        self.attempted_rank = 0
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
                crop = source.crop(self.profile.box(region, self.size))
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
        self.client.tap(
            self.serial, *self.profile.point(f"ranking.row{row}", self.size)
        )
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

    def _scroll(self, fraction: float | None = None, direction: int = 1) -> None:
        start = self.profile.point("ranking.scroll-start", self.size)
        end = self.profile.point("ranking.scroll-end", self.size)
        ratio = max(0.05, min(1.0, fraction if fraction is not None else self.options.scroll_fraction))
        ratio *= direction
        target = (
            start[0] + round((end[0] - start[0]) * ratio),
            start[1] + round((end[1] - start[1]) * ratio),
        )
        self.client.swipe(self.serial, start, target, self.options.scroll_duration_ms)
        time.sleep(self.options.scroll_wait)

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
                stagnant_pages = 0
                max_pages = max(4, math.ceil(self.options.amount / 4) + 8)
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
                        seen = [
                            h.get("rankFromScreen")
                            for h in hints
                            if h and h.get("rankFromScreen")
                        ]
                        if not seen or self.last_screen_rank is None:
                            break
                        if min(seen) <= self.last_screen_rank + 1:
                            break
                        self.progress(
                            {
                                "serial": self.serial,
                                "event": "scroll-back",
                                "page": page + 1,
                                "expected": self.last_screen_rank + 1,
                                "sawTop": min(seen),
                            }
                        )
                        self._scroll(fraction=0.3, direction=-1)
                        hints = self._read_ranking_hints(page + 1)

                    added = 0
                    page_seen = [
                        h.get("rankFromScreen") for h in hints if h and h.get("rankFromScreen")
                    ]
                    if page_seen and self.last_screen_rank is not None:
                        top = min(page_seen)
                        if top > self.last_screen_rank + 1:
                            gap = {
                                "page": page + 1,
                                "afterRank": self.last_screen_rank,
                                "nextRank": top,
                                "missing": top - self.last_screen_rank - 1,
                            }
                            self.rank_gaps.append(gap)
                            self.progress({"serial": self.serial, "event": "rank-gap", **gap})
                    if page_seen:
                        self.last_screen_rank = max(self.last_screen_rank or 0, max(page_seen))
                    for row in range(1, 7):
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
                    stagnant_pages = stagnant_pages + 1 if added == 0 else 0
                    if stagnant_pages >= 3:
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
