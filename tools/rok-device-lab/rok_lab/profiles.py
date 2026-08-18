from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .adb import AdbError


@dataclass(frozen=True)
class ScreenFingerprint:
    region: tuple[float, float, float, float]
    dhash: str
    max_distance: int


@dataclass(frozen=True)
class DeviceProfile:
    name: str
    game_package: str
    reference_resolution: tuple[int, int]
    taps: dict[str, tuple[float, float]]
    regions: dict[str, tuple[float, float, float, float]]
    screens: dict[str, tuple[ScreenFingerprint, ...]]

    def point(self, name: str, size: tuple[int, int]) -> tuple[int, int]:
        try:
            x_ratio, y_ratio = self.taps[name]
        except KeyError as exc:
            raise AdbError(
                f"Profile '{self.name}' không có điểm chạm '{name}'."
            ) from exc
        width, height = size
        return round(x_ratio * width), round(y_ratio * height)

    def box(self, name: str, size: tuple[int, int]) -> tuple[int, int, int, int]:
        try:
            x, y, width_ratio, height_ratio = self.regions[name]
        except KeyError as exc:
            raise AdbError(f"Profile '{self.name}' không có vùng '{name}'.") from exc
        width, height = size
        return (
            round(x * width),
            round(y * height),
            round((x + width_ratio) * width),
            round((y + height_ratio) * height),
        )


def _pair(value: Any, field: str) -> tuple[float, float]:
    if not isinstance(value, list) or len(value) != 2:
        raise AdbError(f"Profile: '{field}' phải là mảng 2 phần tử.")
    pair = float(value[0]), float(value[1])
    if not all(0 <= item <= 1 for item in pair):
        raise AdbError(f"Profile: '{field}' phải dùng tọa độ chuẩn hóa từ 0 đến 1.")
    return pair


def load_profile(path: Path) -> DeviceProfile:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AdbError(f"Không đọc được profile {path}: {exc}") from exc

    try:
        resolution = tuple(int(item) for item in document["referenceResolution"])
        taps = {
            str(name): _pair(value, f"taps.{name}")
            for name, value in document["taps"].items()
        }
        regions = {
            str(name): tuple(float(item) for item in value)
            for name, value in document.get("regions", {}).items()
        }
        if any(
            len(region) != 4
            or not all(0 <= item <= 1 for item in region)
            or region[0] + region[2] > 1
            or region[1] + region[3] > 1
            for region in regions.values()
        ):
            raise ValueError("regions")
        screens: dict[str, tuple[ScreenFingerprint, ...]] = {}
        for screen_name, screen in document["screens"].items():
            fingerprints: list[ScreenFingerprint] = []
            for fingerprint in screen["fingerprints"]:
                region = tuple(float(item) for item in fingerprint["region"])
                if len(region) != 4 or not all(0 <= item <= 1 for item in region):
                    raise ValueError("region")
                fingerprints.append(
                    ScreenFingerprint(
                        region=region,  # type: ignore[arg-type]
                        dhash=str(fingerprint["dhash"]).lower(),
                        max_distance=int(fingerprint.get("maxDistance", 10)),
                    )
                )
            screens[str(screen_name)] = tuple(fingerprints)
        if len(resolution) != 2 or min(resolution) <= 0:
            raise ValueError("referenceResolution")
        return DeviceProfile(
            name=str(document["name"]),
            game_package=str(document["gamePackage"]),
            reference_resolution=(resolution[0], resolution[1]),
            taps=taps,
            regions=regions,  # type: ignore[arg-type]
            screens=screens,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise AdbError(f"Profile {path} không hợp lệ: {exc}") from exc
