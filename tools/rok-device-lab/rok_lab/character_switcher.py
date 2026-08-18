from __future__ import annotations

import tempfile
import time
from pathlib import Path
from typing import Any

from .adb import AdbClient, AdbError
from .imaging import image_size, match_fingerprints
from .profiles import DeviceProfile


class CharacterSwitcher:
    """Execute a calibrated, auditable route; no blind coordinate loops."""

    def __init__(self, client: AdbClient, serial: str, profile: DeviceProfile) -> None:
        self.client = client
        self.serial = serial
        self.profile = profile

    def _guard_foreground(self) -> None:
        activity = self.client.foreground_activity(self.serial)
        if not activity.startswith(f"{self.profile.game_package}/"):
            raise AdbError("Game không ở foreground; dừng đổi character.")

    def _wait_screen(self, name: str, timeout_seconds: float) -> None:
        fingerprints = self.profile.screens.get(name, ())
        if not fingerprints:
            raise AdbError(f"Profile chưa có fingerprint màn '{name}'.")
        deadline = time.monotonic() + timeout_seconds
        with tempfile.TemporaryDirectory(prefix="rok-character-") as temporary:
            screenshot = Path(temporary) / "screen.png"
            while time.monotonic() < deadline:
                self.client.screenshot(self.serial, screenshot)
                matched, _ = match_fingerprints(screenshot, fingerprints)
                if matched:
                    return
                time.sleep(0.8)
        raise AdbError(f"Hết thời gian chờ màn '{name}'.")

    def execute(self, route: dict[str, Any]) -> None:
        steps = route.get("steps")
        if not isinstance(steps, list) or not steps:
            raise AdbError("Character route chưa có steps; không chạy thao tác mù.")
        for index, step in enumerate(steps, 1):
            if not isinstance(step, dict):
                raise AdbError(f"Character route step {index} không hợp lệ.")
            action = step.get("action")
            if action == "wait-screen":
                self._wait_screen(
                    str(step["screen"]), float(step.get("timeoutSeconds", 15))
                )
                continue
            self._guard_foreground()
            with tempfile.TemporaryDirectory(prefix="rok-character-size-") as temporary:
                screenshot = self.client.screenshot(
                    self.serial, Path(temporary) / "screen.png"
                )
                size = image_size(screenshot)
            if action == "tap":
                self.client.tap(
                    self.serial, *self.profile.point(str(step["point"]), size)
                )
            elif action == "swipe":
                self.client.swipe(
                    self.serial,
                    self.profile.point(str(step["from"]), size),
                    self.profile.point(str(step["to"]), size),
                    int(step.get("durationMs", 650)),
                )
            elif action == "keyevent":
                key = str(step["key"])
                if not key.startswith("KEYCODE_"):
                    raise AdbError(f"Keyevent không hợp lệ ở step {index}.")
                self.client.keyevent(self.serial, key)
            else:
                raise AdbError(f"Action '{action}' chưa được hỗ trợ ở step {index}.")
            time.sleep(float(step.get("waitSeconds", 1)))
        final_screen = route.get("finalScreen")
        if final_screen:
            self._wait_screen(str(final_screen), 20)
