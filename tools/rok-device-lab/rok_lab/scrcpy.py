from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from .adb import AdbError


def find_scrcpy(explicit: str | None = None) -> Path:
    candidates: list[str] = []
    if explicit:
        candidates.append(explicit)
    if os.environ.get("SCRCPY_PATH"):
        candidates.append(os.environ["SCRCPY_PATH"])
    from_path = shutil.which("scrcpy")
    if from_path:
        candidates.append(from_path)

    for candidate in candidates:
        path = Path(candidate).expanduser().resolve()
        if path.is_file():
            return path
    raise AdbError("Không tìm thấy scrcpy. Cài scrcpy hoặc đặt biến SCRCPY_PATH.")


def launch_scrcpy(
    serial: str,
    title: str,
    *,
    explicit_path: str | None = None,
    max_size: int = 720,
    max_fps: int = 15,
) -> int:
    path = find_scrcpy(explicit_path)
    command = [
        str(path),
        "-s",
        serial,
        f"--window-title={title}",
        f"--max-size={max_size}",
        f"--max-fps={max_fps}",
        "--no-audio",
    ]
    try:
        process = subprocess.Popen(command)
    except OSError as exc:
        raise AdbError(f"Không mở được scrcpy: {exc}") from exc
    return process.pid
