from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


class AdbError(RuntimeError):
    """Raised when an ADB operation fails."""


@dataclass(frozen=True)
class Device:
    serial: str
    state: str
    product: str | None = None
    model: str | None = None
    device: str | None = None
    transport_id: str | None = None

    @property
    def ready(self) -> bool:
        return self.state == "device"


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def find_adb(explicit: str | None = None) -> Path:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    if os.environ.get("ADB_PATH"):
        candidates.append(Path(os.environ["ADB_PATH"]))

    bundled_name = "adb.exe" if os.name == "nt" else "adb"
    candidates.append(
        _project_root() / "RoK Tracker" / "deps" / "platform-tools" / bundled_name
    )

    from_path = shutil.which("adb")
    if from_path:
        candidates.append(Path(from_path))

    for candidate in candidates:
        resolved = candidate.expanduser().resolve()
        if resolved.is_file():
            return resolved

    raise AdbError(
        "Không tìm thấy ADB. Đặt biến ADB_PATH hoặc giữ platform-tools trong "
        "RoK Tracker/deps/platform-tools."
    )


def parse_devices(output: str) -> list[Device]:
    devices: list[Device] = []
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("List of devices attached") or line.startswith("*"):
            continue

        parts = line.split()
        if len(parts) < 2:
            continue

        serial, state = parts[0], parts[1]
        attributes: dict[str, str] = {}
        for item in parts[2:]:
            if ":" in item:
                key, value = item.split(":", 1)
                attributes[key] = value

        devices.append(
            Device(
                serial=serial,
                state=state,
                product=attributes.get("product"),
                model=attributes.get("model"),
                device=attributes.get("device"),
                transport_id=attributes.get("transport_id"),
            )
        )
    return devices


class AdbClient:
    def __init__(self, adb_path: str | None = None, timeout: float = 20) -> None:
        self.path = find_adb(adb_path)
        self.timeout = timeout

    def _run(
        self,
        args: Iterable[str],
        *,
        serial: str | None = None,
        binary: bool = False,
        timeout: float | None = None,
    ) -> bytes | str:
        command = [str(self.path)]
        if serial:
            command.extend(["-s", serial])
        command.extend(str(arg) for arg in args)

        try:
            result = subprocess.run(
                command,
                check=False,
                capture_output=True,
                timeout=timeout or self.timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise AdbError(f"ADB quá thời gian chờ: {' '.join(command)}") from exc
        except OSError as exc:
            raise AdbError(f"Không chạy được ADB: {exc}") from exc

        if result.returncode != 0:
            error = result.stderr.decode("utf-8", errors="replace").strip()
            raise AdbError(error or f"ADB thoát với mã {result.returncode}")

        if binary:
            return result.stdout
        return result.stdout.decode("utf-8", errors="replace").strip()

    def version(self) -> str:
        return str(self._run(["version"]))

    def devices(self) -> list[Device]:
        return parse_devices(str(self._run(["devices", "-l"])))

    def require_ready(self, serial: str) -> Device:
        matching = [device for device in self.devices() if device.serial == serial]
        if not matching:
            raise AdbError(f"Không thấy thiết bị {serial}.")
        device = matching[0]
        if not device.ready:
            raise AdbError(
                f"Thiết bị {serial} đang ở trạng thái '{device.state}', chưa thể điều khiển."
            )
        return device

    def shell(self, serial: str, *args: str, timeout: float | None = None) -> str:
        self.require_ready(serial)
        return str(self._run(["shell", *args], serial=serial, timeout=timeout))

    def getprop(self, serial: str, prop: str) -> str:
        return self.shell(serial, "getprop", prop)

    def inspect(self, serial: str) -> dict[str, str | None]:
        device = self.require_ready(serial)
        battery = self.shell(serial, "dumpsys", "battery")
        battery_level = re.search(r"(?m)^\s*level:\s*(\d+)", battery)
        battery_temp = re.search(r"(?m)^\s*temperature:\s*(\d+)", battery)
        ip_output = self.shell(serial, "ip", "-f", "inet", "addr", "show", "wlan0")
        ip_match = re.search(r"\binet\s+([0-9.]+)", ip_output)

        return {
            **asdict(device),
            "manufacturer": self.getprop(serial, "ro.product.manufacturer") or None,
            "android": self.getprop(serial, "ro.build.version.release") or None,
            "sdk": self.getprop(serial, "ro.build.version.sdk") or None,
            "resolution": self.shell(serial, "wm", "size") or None,
            "density": self.shell(serial, "wm", "density") or None,
            "battery_percent": battery_level.group(1) if battery_level else None,
            "battery_celsius": (
                f"{int(battery_temp.group(1)) / 10:.1f}" if battery_temp else None
            ),
            "wifi_ip": ip_match.group(1) if ip_match else None,
        }

    def screenshot(self, serial: str, destination: Path) -> Path:
        self.require_ready(serial)
        image = self._run(
            ["exec-out", "screencap", "-p"], serial=serial, binary=True, timeout=30
        )
        assert isinstance(image, bytes)
        if not image.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AdbError("Dữ liệu chụp màn hình không phải PNG hợp lệ.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(image)
        return destination

    def open_wifi_settings(self, serial: str) -> str:
        return self.shell(
            serial,
            "am",
            "start",
            "-a",
            "android.settings.WIFI_SETTINGS",
        )

    def wifi_status(self, serial: str) -> str:
        try:
            status = self.shell(serial, "cmd", "wifi", "status")
            if "Unknown command" not in status and "not found" not in status:
                return status
        except AdbError:
            pass
        return self.shell(serial, "dumpsys", "wifi", timeout=30)

    def ui_dump(self, serial: str) -> str:
        return self.shell(serial, "uiautomator", "dump", "/dev/tty", timeout=30)

    def keyevent(self, serial: str, key: str) -> str:
        return self.shell(serial, "input", "keyevent", key)

    def tap(self, serial: str, x: int, y: int) -> str:
        return self.shell(serial, "input", "tap", str(x), str(y))


def load_aliases(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AdbError(f"Không đọc được cấu hình thiết bị {path}: {exc}") from exc

    devices = document.get("devices", {})
    if not isinstance(devices, dict):
        raise AdbError("Trường 'devices' trong cấu hình phải là một object.")
    return {str(alias): str(serial) for alias, serial in devices.items() if serial}


def resolve_device(value: str, aliases: dict[str, str]) -> str:
    return aliases.get(value, value)
