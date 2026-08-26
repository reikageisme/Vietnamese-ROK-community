from __future__ import annotations

import json
import math
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
        self.rank_gaps: list[dict[str, Any]] = []
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
        return [
            parse_ranking_row(text, index, None) for index, text in enumerate(rows, 1)
        ]

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
        record: dict[str, Any] = {
            "rank": self.attempted_rank,
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

    def _scroll(self) -> None:
        self.client.swipe(
            self.serial,
            self.profile.point("ranking.scroll-start", self.size),
            self.profile.point("ranking.scroll-end", self.size),
            self.options.scroll_duration_ms,
        )
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
                # Thu hang cao nhat da nhin thay. Dung de phat hien ho: neu
                # trang sau bat dau tu mot thu hang xa hon lien ke, co nguoi da
                # bi nhay qua. Khong bat duoc thi ban quet van bao "300 nguoi"
                # trong khi thuc te la 300 nguoi rai rac trong 450 thu hang —
                # va nhin vao ket qua thi khong the biet.
                last_rank = max(
                    (r.get("rank") for r in self.records if isinstance(r.get("rank"), int)),
                    default=None,
                )
                max_pages = max(4, math.ceil(self.options.amount / 4) + 8)
                for page in range(max_pages):
                    hints = self._read_ranking_hints(page + 1)
                    added = 0
                    page_ranks: list[int] = []
                    for row in range(1, 7):
                        if len(self.records) >= self.options.amount:
                            break
                        record = self._scan_governor(row, hints[row - 1])
                        if record is None:
                            continue
                        if isinstance(record.get("rank"), int):
                            page_ranks.append(record["rank"])
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
                    if page_ranks:
                        top = min(page_ranks)
                        if last_rank is not None and top > last_rank + 1:
                            gap = {
                                "page": page + 1,
                                "afterRank": last_rank,
                                "nextRank": top,
                                "missing": top - last_rank - 1,
                            }
                            self.rank_gaps.append(gap)
                            self.progress({"serial": self.serial, "event": "rank-gap", **gap})
                        last_rank = max(last_rank or 0, max(page_ranks))

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
                    "rankGaps": self.rank_gaps,
                    "ranksMissing": sum(gap["missing"] for gap in self.rank_gaps),
                }
            except KeyboardInterrupt:
                self._cleanup_panels()
                self._save_state("interrupted", "Người vận hành nhấn Ctrl+C.")
                raise
            except Exception as exc:
                self._cleanup_panels()
                self._save_state("failed", str(exc))
                raise
