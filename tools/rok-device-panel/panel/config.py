"""Cấu hình đọc từ biến môi trường. Mọi giá trị đều có mặc định an toàn."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, "") or default)
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, "") or default)
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    token: str
    host: str
    port: int

    adb_path: str | None
    game_package: str

    profile_source: Path
    profile_working: Path
    aliases_path: Path
    data_dir: Path

    # Vòng chụp. Giữ thưa để không tranh băng thông USB với scanner.
    grid_interval: float
    focus_interval: float
    capture_workers: int
    capture_timeout: float
    slow_capture_threshold: float

    grid_width: int
    focus_width: int
    jpeg_quality: int

    device_poll_interval: float
    meta_poll_interval: float

    broadcast_enabled: bool
    broadcast_max_devices: int

    @property
    def auth_required(self) -> bool:
        return bool(self.token)


def load_settings() -> Settings:
    data_dir = Path(os.environ.get("PANEL_DATA_DIR", "/data"))
    return Settings(
        token=os.environ.get("PANEL_TOKEN", "").strip(),
        host=os.environ.get("PANEL_HOST", "0.0.0.0"),
        port=_int("PANEL_PORT", 5100),
        adb_path=os.environ.get("ADB_PATH") or None,
        game_package=os.environ.get("GAME_PACKAGE", "com.rok.gp.vn"),
        profile_source=Path(
            os.environ.get("PROFILE_PATH", "/profiles/rok-a51-1920x1080.json")
        ),
        profile_working=data_dir / "profile.working.json",
        aliases_path=Path(os.environ.get("ALIASES_PATH", "/config/devices.local.json")),
        data_dir=data_dir,
        grid_interval=_float("GRID_INTERVAL_SECONDS", 5.0),
        focus_interval=_float("FOCUS_INTERVAL_SECONDS", 0.8),
        capture_workers=_int("CAPTURE_WORKERS", 3),
        capture_timeout=_float("CAPTURE_TIMEOUT_SECONDS", 25.0),
        slow_capture_threshold=_float("SLOW_CAPTURE_SECONDS", 3.0),
        grid_width=_int("GRID_WIDTH", 420),
        focus_width=_int("FOCUS_WIDTH", 1280),
        jpeg_quality=_int("JPEG_QUALITY", 72),
        device_poll_interval=_float("DEVICE_POLL_SECONDS", 4.0),
        meta_poll_interval=_float("META_POLL_SECONDS", 30.0),
        broadcast_enabled=_bool("BROADCAST_ENABLED", True),
        broadcast_max_devices=_int("BROADCAST_MAX_DEVICES", 32),
    )
