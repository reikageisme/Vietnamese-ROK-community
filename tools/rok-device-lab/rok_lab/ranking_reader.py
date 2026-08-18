from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance

from .adb import AdbClient
from .imaging import image_size, match_fingerprints
from .ocr import available_languages, find_tessdata, find_tesseract, ocr_tsv
from .profiles import DeviceProfile
from .runs import DeviceRun, utc_now

POWER_PATTERN = re.compile(r"\b\d{1,3}(?:[,.，]\d{3}){2,}\b")
TAG_PATTERN = re.compile(r"\[([^\]]{1,12})\]")


def _parse_row(text: str, rank: int, confidence: float | None) -> dict[str, Any]:
    lines = [line.strip(" |}»﹜_-") for line in text.splitlines() if line.strip()]
    power_match = POWER_PATTERN.search(text)
    power = int(re.sub(r"\D", "", power_match.group())) if power_match else None
    first_line = lines[0] if lines else ""
    if power_match:
        first_line = first_line.replace(power_match.group(), "").strip()
    tag_match = TAG_PATTERN.search(first_line)
    alliance_tag = tag_match.group(1).strip() if tag_match else None
    name = (
        first_line[tag_match.end() :].strip() if tag_match else first_line.strip()
    ) or None
    alliance_name = lines[1] if len(lines) > 1 else None
    if alliance_name and power_match:
        alliance_name = alliance_name.replace(power_match.group(), "").strip() or None
    return {
        "rank": rank,
        "allianceTag": alliance_tag,
        "name": name,
        "allianceName": alliance_name,
        "power": power,
        "ocrConfidence": round(confidence, 2) if confidence is not None else None,
        "ocrRaw": text,
        "needsReview": power is None or name is None,
    }


def read_visible_power_ranking(
    client: AdbClient,
    serial: str,
    profile: DeviceProfile,
    artifacts_root: Path,
    *,
    tesseract_path: str | None = None,
    tessdata_path: str | None = None,
) -> dict[str, Any]:
    with DeviceRun(artifacts_root, serial, "power-read") as run:
        foreground = client.foreground_activity(serial)
        screenshot = client.screenshot(serial, run.artifact("screen.png"))
        size = image_size(screenshot)
        matched, comparisons = match_fingerprints(
            screenshot, profile.screens.get("individual-power-ranking", ())
        )
        if not foreground.startswith(f"{profile.game_package}/") or not matched:
            result = {
                "ok": False,
                "reason": "guard-rejected",
                "foregroundActivity": foreground,
                "screenMatched": matched,
                "fingerprints": comparisons,
                "runDirectory": str(run.path.resolve()),
            }
            run.finish("guard-rejected", result=result)
            return result

        tesseract = find_tesseract(tesseract_path)
        tessdata = find_tessdata(tesseract, tessdata_path)
        languages = available_languages(tessdata)
        governors: list[dict[str, Any]] = []
        with Image.open(screenshot) as source:
            for index in range(1, 7):
                crop_path = run.artifact(f"rows/row-{index}.png")
                crop_path.parent.mkdir(parents=True, exist_ok=True)
                crop = source.crop(profile.box(f"ranking.row{index}", size))
                crop = crop.resize((crop.width * 2, crop.height * 2))
                crop = ImageEnhance.Contrast(crop).enhance(1.5)
                crop.save(crop_path)
                recognized = ocr_tsv(
                    crop_path,
                    executable=tesseract,
                    tessdata=tessdata,
                    languages=languages,
                )
                governors.append(_parse_row(recognized.text, index, recognized.confidence))

        document = {
            "schemaVersion": 1,
            "capturedAt": utc_now(),
            "serial": serial,
            "screen": "individual-power-ranking",
            "resolution": list(size),
            "ocr": {
                "executable": str(tesseract),
                "tessdata": str(tessdata) if tessdata else None,
                "languages": languages,
            },
            "governors": governors,
        }
        json_path = run.artifact("governors.json")
        json_path.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
        csv_path = run.artifact("governors.csv")
        with csv_path.open("w", newline="", encoding="utf-8-sig") as output:
            writer = csv.DictWriter(
                output,
                fieldnames=("rank", "allianceTag", "name", "allianceName", "power", "ocrConfidence", "needsReview"),
            )
            writer.writeheader()
            for governor in governors:
                writer.writerow({key: governor[key] for key in writer.fieldnames})
        result = {
            "ok": True,
            "serial": serial,
            "records": len(governors),
            "reviewRequired": sum(bool(item["needsReview"]) for item in governors),
            "json": str(json_path.resolve()),
            "csv": str(csv_path.resolve()),
            "runDirectory": str(run.path.resolve()),
            "governors": governors,
        }
        run.finish(result=result)
        return result
