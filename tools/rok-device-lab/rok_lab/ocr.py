from __future__ import annotations

import csv
import os
import shutil
import subprocess
from dataclasses import dataclass
from io import StringIO
from pathlib import Path

from .adb import AdbError


@dataclass(frozen=True)
class OcrText:
    text: str
    confidence: float | None


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def find_tesseract(explicit: str | None = None) -> Path:
    candidates: list[Path] = []
    for value in (explicit, os.environ.get("TESSERACT_PATH"), shutil.which("tesseract")):
        if value:
            candidates.append(Path(value))
    if os.name == "nt":
        candidates.extend(
            (
                Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
                / "Tesseract-OCR"
                / "tesseract.exe",
                Path(os.environ.get("LOCALAPPDATA", ""))
                / "Programs"
                / "Tesseract-OCR"
                / "tesseract.exe",
            )
        )
    for candidate in candidates:
        resolved = candidate.expanduser().resolve()
        if resolved.is_file():
            return resolved
    raise AdbError(
        "Không tìm thấy Tesseract OCR. Đặt TESSERACT_PATH hoặc cài tesseract-ocr."
    )


def find_tessdata(executable: Path, explicit: str | None = None) -> Path | None:
    candidates: list[Path] = []
    for value in (explicit, os.environ.get("TESSDATA_DIR")):
        if value:
            candidates.append(Path(value))
    candidates.extend(
        (
            _project_root() / "RoK Tracker" / "deps" / "tessdata",
            executable.parent / "tessdata",
        )
    )
    for candidate in candidates:
        resolved = candidate.expanduser().resolve()
        if (resolved / "eng.traineddata").is_file():
            return resolved
    return None


def available_languages(tessdata: Path | None) -> list[str]:
    if tessdata is None:
        return ["eng"]
    wanted = ("eng", "vie", "kor")
    return [name for name in wanted if (tessdata / f"{name}.traineddata").is_file()]


def ocr_tsv(
    image: Path,
    *,
    executable: Path,
    tessdata: Path | None,
    languages: list[str],
    page_segmentation: int = 6,
) -> OcrText:
    command = [str(executable), str(image), "stdout"]
    if tessdata is not None:
        command.extend(["--tessdata-dir", str(tessdata)])
    command.extend(["-l", "+".join(languages or ["eng"]), "--psm", str(page_segmentation), "tsv"])
    result = subprocess.run(command, capture_output=True, check=False, timeout=30)
    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise AdbError(f"Tesseract OCR thất bại: {error}")

    document = result.stdout.decode("utf-8", errors="replace")
    rows = csv.DictReader(StringIO(document), delimiter="\t")
    lines: dict[tuple[str, str, str], list[str]] = {}
    confidences: list[float] = []
    for row in rows:
        text = (row.get("text") or "").strip()
        if not text:
            continue
        key = (
            row.get("block_num") or "0",
            row.get("par_num") or "0",
            row.get("line_num") or "0",
        )
        lines.setdefault(key, []).append(text)
        try:
            confidence = float(row.get("conf") or -1)
            if confidence >= 0:
                confidences.append(confidence)
        except ValueError:
            pass
    if lines:
        return OcrText(
            text="\n".join(" ".join(words) for words in lines.values()),
            confidence=(sum(confidences) / len(confidences) if confidences else None),
        )

    # Some portable tessdata bundles contain language models but omit the TSV
    # config file. Plain UTF-8 output still provides useful OCR in that case.
    fallback = command[:-1]
    result = subprocess.run(fallback, capture_output=True, check=False, timeout=30)
    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise AdbError(f"Tesseract OCR thất bại: {error}")
    return OcrText(
        text=result.stdout.decode("utf-8", errors="replace").strip(),
        confidence=None,
    )
