from __future__ import annotations

import json
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from PIL import Image, ImageEnhance, ImageOps

from .adb import AdbClient, AdbError
from .imaging import image_size
from .ocr import available_languages, find_tessdata, find_tesseract, ocr_batch
from .profiles import DeviceProfile
from .ranking_scan_export import write_ranking_exports
from .runs import DeviceRun, utc_now

RankingType = Literal["alliance", "honor", "seed"]


@dataclass(frozen=True)
class RankingMode:
    rows: int
    threshold: int
    invert: bool
    score_multiplier: int


MODES: dict[RankingType, RankingMode] = {
    "alliance": RankingMode(rows=6, threshold=90, invert=True, score_multiplier=1),
    "honor": RankingMode(rows=5, threshold=150, invert=False, score_multiplier=1),
    "seed": RankingMode(rows=6, threshold=90, invert=True, score_multiplier=1),
}


@dataclass(frozen=True)
class RankingScanOptions:
    ranking_type: RankingType
    amount: int = 100
    scan_name: str = "ranking"
    formats: set[str] | None = None
    evidence: Literal["all", "review", "none"] = "all"


def parse_score(value: str) -> int | None:
    digits = re.sub(r"\D", "", value)
    return int(digits) if digits else None


def clean_name(value: str) -> str | None:
    lines = [line.strip(" |}»﹜_-\t") for line in value.splitlines() if line.strip()]
    return " ".join(lines) or None


def normalize_score(score: int | None, previous: int | None) -> tuple[int | None, bool]:
    """Keep raw ranking order honest; never silently replace bad OCR values."""
    if score is None:
        return None, True
    return score, previous is not None and score > previous


class RankingScanner:
    """Multi-device safe replacement for RokTracker Alliance/Honor/Seed scans."""

    def __init__(
        self,
        client: AdbClient,
        serial: str,
        profile: DeviceProfile,
        artifacts_root: Path,
        options: RankingScanOptions,
        *,
        confirmed: bool,
        tesseract_path: str | None = None,
        tessdata_path: str | None = None,
        progress: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self.client = client
        self.serial = serial
        self.profile = profile
        self.artifacts_root = artifacts_root
        self.options = options
        self.confirmed = confirmed
        self.tesseract_path = tesseract_path
        self.tessdata_path = tessdata_path
        self.progress = progress or (lambda _: None)

    @property
    def mode(self) -> RankingMode:
        return MODES[self.options.ranking_type]

    def _preprocess(self, image: Image.Image) -> Image.Image:
        result = image.resize((image.width * 3, image.height * 3))
        result = ImageEnhance.Contrast(result.convert("L")).enhance(1.4)
        if self.mode.invert:
            result = ImageOps.invert(result)
        result = result.point(lambda pixel: 255 if pixel > self.mode.threshold else 0)
        return ImageOps.expand(result, border=12, fill=255)

    def _boxes(
        self, row: int, size: tuple[int, int]
    ) -> tuple[tuple[int, ...], tuple[int, ...]]:
        prefix = f"ranking.{self.options.ranking_type}"
        return (
            self.profile.box(f"{prefix}.name{row}", size),
            self.profile.box(f"{prefix}.score{row}", size),
        )

    def _scan_page(
        self,
        run: DeviceRun,
        page: int,
        tesseract: Path,
        tessdata: Path | None,
        languages: list[str],
    ) -> list[dict[str, Any]]:
        screenshot = self.client.screenshot(
            self.serial, run.artifact(f"pages/page-{page:04d}.png")
        )
        size = image_size(screenshot)
        name_paths: list[Path] = []
        score_paths: list[Path] = []
        raw_paths: list[Path] = []
        with Image.open(screenshot) as source:
            for row in range(1, self.mode.rows + 1):
                name_box, score_box = self._boxes(row, size)
                raw_path = run.artifact(f"evidence/page-{page:04d}-row-{row}.png")
                raw_path.parent.mkdir(parents=True, exist_ok=True)
                left = min(name_box[0], score_box[0])
                top = min(name_box[1], score_box[1])
                right = max(name_box[2], score_box[2])
                bottom = max(name_box[3], score_box[3])
                source.crop((left, top, right, bottom)).save(raw_path)
                raw_paths.append(raw_path)

                name_path = run.artifact(f"ocr/page-{page:04d}-name-{row}.png")
                score_path = run.artifact(f"ocr/page-{page:04d}-score-{row}.png")
                name_path.parent.mkdir(parents=True, exist_ok=True)
                self._preprocess(source.crop(name_box)).save(name_path)
                self._preprocess(source.crop(score_box)).save(score_path)
                name_paths.append(name_path)
                score_paths.append(score_path)

        names = ocr_batch(
            name_paths,
            executable=tesseract,
            tessdata=tessdata,
            languages=languages,
            list_file=run.artifact(f"ocr/page-{page:04d}-names.txt"),
        )
        scores = ocr_batch(
            score_paths,
            executable=tesseract,
            tessdata=tessdata,
            languages=["eng"],
            list_file=run.artifact(f"ocr/page-{page:04d}-scores.txt"),
        )
        return [
            {
                "name": clean_name(names[index]),
                "score": parse_score(scores[index]),
                "scoreRaw": scores[index],
                "evidenceImage": str(raw_paths[index].resolve()),
            }
            for index in range(self.mode.rows)
        ]

    @staticmethod
    def _duplicate(record: dict[str, Any], records: list[dict[str, Any]]) -> bool:
        return any(
            prior.get("name") == record.get("name")
            and prior.get("score") == record.get("score")
            and (record.get("name") is not None or record.get("score") is not None)
            for prior in records[-6:]
        )

    def scan(self) -> dict[str, Any]:
        if not self.confirmed:
            raise AdbError(
                "Ranking scan bị chặn. Thêm --confirm để cho phép cuộn game."
            )
        if self.options.amount < 1:
            raise AdbError("--amount phải lớn hơn 0.")
        if self.options.evidence not in {"all", "review", "none"}:
            raise AdbError("evidence chỉ hỗ trợ all, review, none.")
        formats = self.options.formats or {"xlsx", "csv", "jsonl"}

        self.client.require_ready(self.serial)
        foreground = self.client.foreground_activity(self.serial)
        if not foreground.startswith(f"{self.profile.game_package}/"):
            raise AdbError("Game không ở foreground; không gửi thao tác cuộn.")

        tesseract = find_tesseract(self.tesseract_path)
        tessdata = find_tessdata(tesseract, self.tessdata_path)
        languages = available_languages(tessdata)
        records: list[dict[str, Any]] = []
        last_score: int | None = None
        reached_bottom = False

        with DeviceRun(
            self.artifacts_root,
            self.serial,
            f"{self.options.ranking_type}-ranking-scan",
        ) as run:
            page = 1
            while len(records) < self.options.amount and not reached_bottom:
                page_rows = self._scan_page(run, page, tesseract, tessdata, languages)
                readable = sum(
                    row["name"] is not None and row["score"] is not None
                    for row in page_rows
                )
                if page == 1 and readable < 2:
                    raise AdbError(
                        "Màn hiện tại không giống bảng xếp hạng đã chọn "
                        f"({readable}/{self.mode.rows} dòng đọc được)."
                    )

                for row in page_rows:
                    if len(records) >= self.options.amount:
                        break
                    if row["name"] is None and row["score"] is None:
                        reached_bottom = True
                        break
                    score, suspicious = normalize_score(row["score"], last_score)
                    row["score"] = score
                    row["needsReview"] = bool(
                        suspicious or row["name"] is None or score is None
                    )
                    if self._duplicate(row, records):
                        reached_bottom = True
                        break
                    row["rank"] = len(records) + 1
                    if score is not None and not suspicious:
                        last_score = score
                    if self.options.evidence == "none" or (
                        self.options.evidence == "review" and not row["needsReview"]
                    ):
                        row["evidenceImage"] = None
                    records.append(row)
                    self.progress(
                        {
                            "event": "ranking-row",
                            "serial": self.serial,
                            "rankingType": self.options.ranking_type,
                            "rank": row["rank"],
                            "name": row["name"],
                            "score": row["score"],
                            "needsReview": row["needsReview"],
                            "target": self.options.amount,
                        }
                    )

                state = {
                    "schemaVersion": 1,
                    "updatedAt": utc_now(),
                    "serial": self.serial,
                    "rankingType": self.options.ranking_type,
                    "page": page,
                    "target": self.options.amount,
                    "reachedBottom": reached_bottom,
                    "records": records,
                }
                state_path = (
                    run.artifact("state.json") if page == 1 else run.path / "state.json"
                )
                state_path.write_text(
                    json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                run.write_manifest()

                if len(records) < self.options.amount and not reached_bottom:
                    size = image_size(run.path / f"pages/page-{page:04d}.png")
                    self.client.swipe(
                        self.serial,
                        self.profile.point("ranking.scroll-start", size),
                        self.profile.point("ranking.scroll-end", size),
                        700,
                    )
                    time.sleep(1.1)
                    page += 1

            metadata = {
                "capturedAt": utc_now(),
                "deviceId": self.serial,
                "rankingType": self.options.ranking_type,
                "scanName": self.options.scan_name,
                "target": self.options.amount,
                "reachedBottom": reached_bottom,
            }
            exports = write_ranking_exports(
                run.path,
                records,
                metadata,
                formats,
            )
            result = {
                "ok": True,
                "serial": self.serial,
                "rankingType": self.options.ranking_type,
                "records": len(records),
                "reviewRequired": sum(bool(row["needsReview"]) for row in records),
                "reachedBottom": reached_bottom,
                "exports": exports,
                "runDirectory": str(run.path.resolve()),
            }
            run.finish(result=result)
            return result
