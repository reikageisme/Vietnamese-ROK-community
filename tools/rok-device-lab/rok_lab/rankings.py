from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from .adb import AdbClient, AdbError
from .imaging import image_size, match_fingerprints
from .profiles import DeviceProfile
from .runs import DeviceRun


def probe_rankings_menu(
    client: AdbClient,
    serial: str,
    profile: DeviceProfile,
    artifacts_root: Path,
) -> dict[str, Any]:
    with DeviceRun(artifacts_root, serial, "rankings-probe") as run:
        device = client.require_ready(serial)
        foreground = client.foreground_activity(serial)
        screenshot = client.screenshot(serial, run.artifact("screen.png"))
        size = image_size(screenshot)
        fingerprints = profile.screens.get("rankings-menu", ())
        matched, comparisons = match_fingerprints(screenshot, fingerprints)
        package_ok = foreground.startswith(f"{profile.game_package}/")
        result = {
            "ok": package_ok and matched,
            "serial": serial,
            "model": device.model,
            "foregroundActivity": foreground,
            "gamePackageMatched": package_ok,
            "screen": "rankings-menu" if matched else "unknown",
            "screenMatched": matched,
            "resolution": list(size),
            "fingerprints": comparisons,
            "runDirectory": str(run.path.resolve()),
        }
        run.finish("complete" if result["ok"] else "guard-rejected", result=result)
        return result


def open_ranking(
    client: AdbClient,
    serial: str,
    profile: DeviceProfile,
    artifacts_root: Path,
    ranking: str,
    *,
    confirmed: bool,
    wait_seconds: float = 2.5,
) -> dict[str, Any]:
    if not confirmed:
        raise AdbError("Thao tác chạm bị chặn. Thêm --confirm sau khi đã kiểm tra đúng máy.")
    tap_name = f"ranking.{ranking}"
    with DeviceRun(artifacts_root, serial, "rankings-open") as run:
        foreground = client.foreground_activity(serial)
        before = client.screenshot(serial, run.artifact("before.png"))
        size = image_size(before)
        fingerprints = profile.screens.get("rankings-menu", ())
        matched, comparisons = match_fingerprints(before, fingerprints)
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

        point = profile.point(tap_name, size)
        client.tap(serial, *point)
        time.sleep(max(0.5, min(wait_seconds, 10)))
        after = client.screenshot(serial, run.artifact("after.png"))
        result = {
            "ok": True,
            "serial": serial,
            "ranking": ranking,
            "tap": list(point),
            "resolution": list(size),
            "beforeScreen": "rankings-menu",
            "afterScreenshot": str(after.resolve()),
            "runDirectory": str(run.path.resolve()),
        }
        run.finish(result=result)
        return result
