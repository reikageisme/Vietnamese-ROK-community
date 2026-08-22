"""Lớp ADB mỏng cho panel.

Khác với ``rok_lab.adb.AdbClient``: mọi lệnh ở đây KHÔNG gọi ``require_ready``,
vì hàm đó chạy thêm một tiến trình ``adb devices -l`` cho mỗi thao tác. Với 16 máy
và vòng chụp liên tục, chi phí đó nhân đôi số tiến trình con. Panel tự giữ cache
trạng thái thiết bị và làm mới theo chu kỳ riêng.

Vẫn dùng lại ``find_adb`` và ``parse_devices`` của rok_lab để hành vi nhận diện
thiết bị giống hệt agent.
"""

from __future__ import annotations

import re
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from rok_lab.adb import AdbError, find_adb, load_aliases, parse_devices

# Trạng thái ADB và nghĩa tiếng Việt hiển thị trên giao diện.
STATE_LABELS = {
    "device": "Sẵn sàng",
    "unauthorized": "Chưa cấp quyền USB",
    "offline": "Mất kết nối",
    "no permissions": "Thiếu quyền udev",
    "authorizing": "Đang cấp quyền",
    "recovery": "Recovery",
    "sideload": "Sideload",
}


@dataclass
class DeviceState:
    serial: str
    alias: str
    state: str = "offline"
    model: str | None = None
    # Kích thước màn hình thật, dùng để đổi toạ độ chuẩn hoá sang pixel.
    width: int | None = None
    height: int | None = None
    battery: int | None = None
    foreground: str | None = None
    last_seen: float = 0.0
    last_capture_ms: int | None = None
    last_error: str | None = None
    meta_checked_at: float = 0.0
    enabled: bool = True

    @property
    def ready(self) -> bool:
        return self.state == "device"

    @property
    def state_label(self) -> str:
        return STATE_LABELS.get(self.state, self.state)

    def as_json(self) -> dict:
        return {
            "serial": self.serial,
            "alias": self.alias,
            "state": self.state,
            "stateLabel": self.state_label,
            "ready": self.ready,
            "model": self.model,
            "width": self.width,
            "height": self.height,
            "battery": self.battery,
            "foreground": self.foreground,
            "lastCaptureMs": self.last_capture_ms,
            "lastError": self.last_error,
            "enabled": self.enabled,
            "secondsSinceSeen": (
                round(time.time() - self.last_seen, 1) if self.last_seen else None
            ),
        }


_SIZE_PATTERN = re.compile(r"(\d+)x(\d+)")
_BATTERY_PATTERN = re.compile(r"(?m)^\s*level:\s*(\d+)")
_FOCUS_PATTERNS = (
    re.compile(r"mCurrentFocus=.*?\s([\w.]+)/([\w.$]+)"),
    re.compile(r"mFocusedApp=.*?\s([\w.]+)/([\w.$]+)"),
)


class AdbBridge:
    """Bọc một adb server dùng chung cho toàn bộ panel."""

    def __init__(self, adb_path: str | None, timeout: float = 20.0) -> None:
        self.path = find_adb(adb_path)
        self.timeout = timeout
        self._lock = threading.RLock()
        self._devices: dict[str, DeviceState] = {}
        self._aliases: dict[str, str] = {}
        self._serial_to_alias: dict[str, str] = {}

    # ---------- hạ tầng ----------

    def raw(
        self,
        args: list[str],
        *,
        serial: str | None = None,
        binary: bool = False,
        timeout: float | None = None,
    ) -> bytes | str:
        command = [str(self.path)]
        if serial:
            command.extend(["-s", serial])
        command.extend(str(item) for item in args)
        try:
            result = subprocess.run(
                command,
                check=False,
                capture_output=True,
                timeout=timeout or self.timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise AdbError(f"ADB quá thời gian chờ: {' '.join(command[-3:])}") from exc
        except OSError as exc:
            raise AdbError(f"Không chạy được ADB: {exc}") from exc
        if result.returncode != 0:
            message = result.stderr.decode("utf-8", errors="replace").strip()
            raise AdbError(message or f"ADB thoát với mã {result.returncode}")
        return result.stdout if binary else result.stdout.decode("utf-8", "replace").strip()

    def start_server(self) -> None:
        try:
            self.raw(["start-server"], timeout=30)
        except AdbError:
            # Không chặn khởi động panel: vòng poll sẽ thử lại.
            pass

    def version(self) -> str:
        try:
            return str(self.raw(["version"], timeout=10)).splitlines()[0]
        except (AdbError, IndexError):
            return "không xác định"

    # ---------- alias ----------

    def load_aliases(self, path: Path) -> None:
        aliases: dict[str, str] = {}
        try:
            if path.exists():
                aliases = load_aliases(path)
        except AdbError:
            aliases = {}
        with self._lock:
            self._aliases = aliases
            self._serial_to_alias = {serial: alias for alias, serial in aliases.items()}
            for serial, device in self._devices.items():
                device.alias = self._serial_to_alias.get(serial, serial)

    def alias_for(self, serial: str) -> str:
        with self._lock:
            return self._serial_to_alias.get(serial, serial)

    # ---------- danh sách thiết bị ----------

    def refresh_devices(self) -> list[DeviceState]:
        try:
            listing = parse_devices(str(self.raw(["devices", "-l"], timeout=15)))
        except AdbError as exc:
            with self._lock:
                for device in self._devices.values():
                    device.last_error = str(exc)
                return list(self._devices.values())

        now = time.time()
        seen: set[str] = set()
        with self._lock:
            for entry in listing:
                seen.add(entry.serial)
                device = self._devices.get(entry.serial)
                if device is None:
                    device = DeviceState(
                        serial=entry.serial,
                        alias=self._serial_to_alias.get(entry.serial, entry.serial),
                    )
                    self._devices[entry.serial] = device
                device.state = entry.state
                device.model = entry.model or device.model
                device.last_seen = now
                if entry.state == "device":
                    device.last_error = None
            for serial, device in self._devices.items():
                if serial not in seen:
                    device.state = "offline"
            return list(self._devices.values())

    def devices(self) -> list[DeviceState]:
        with self._lock:
            return sorted(self._devices.values(), key=lambda item: item.alias)

    def get(self, serial: str) -> DeviceState:
        with self._lock:
            device = self._devices.get(serial)
        if device is None:
            raise AdbError(f"Không thấy thiết bị {serial}.")
        return device

    def require_ready(self, serial: str) -> DeviceState:
        device = self.get(serial)
        if not device.ready:
            raise AdbError(f"Thiết bị {device.alias} đang ở trạng thái '{device.state_label}'.")
        return device

    def set_enabled(self, serial: str, enabled: bool) -> DeviceState:
        device = self.get(serial)
        with self._lock:
            device.enabled = enabled
        return device

    # ---------- lệnh trên máy ----------

    def shell(self, serial: str, *args: str, timeout: float | None = None) -> str:
        return str(self.raw(["shell", *args], serial=serial, timeout=timeout))

    def screencap(self, serial: str, timeout: float) -> bytes:
        payload = self.raw(
            ["exec-out", "screencap", "-p"], serial=serial, binary=True, timeout=timeout
        )
        assert isinstance(payload, bytes)
        if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AdbError("Dữ liệu chụp màn hình không phải PNG hợp lệ.")
        return payload

    def screen_size(self, serial: str) -> tuple[int, int]:
        """Kích thước vật lý theo ``wm size``. Trò chơi chạy ngang nên có thể đảo trục."""
        output = self.shell(serial, "wm", "size", timeout=10)
        override = None
        physical = None
        for line in output.splitlines():
            match = _SIZE_PATTERN.search(line)
            if not match:
                continue
            value = (int(match.group(1)), int(match.group(2)))
            if "Override" in line:
                override = value
            elif "Physical" in line:
                physical = value
        size = override or physical
        if not size:
            raise AdbError("Không đọc được kích thước màn hình.")
        return size

    def refresh_meta(self, serial: str) -> DeviceState:
        """Đọc pin và ứng dụng đang chạy. Gọi thưa vì dumpsys khá chậm."""
        device = self.get(serial)
        try:
            battery = self.shell(serial, "dumpsys", "battery", timeout=15)
            match = _BATTERY_PATTERN.search(battery)
            device.battery = int(match.group(1)) if match else None
        except (AdbError, ValueError):
            device.battery = None
        try:
            window = self.shell(serial, "dumpsys", "window", timeout=20)
            package = None
            for pattern in _FOCUS_PATTERNS:
                found = pattern.search(window)
                if found:
                    package = found.group(1)
                    break
            device.foreground = package
        except AdbError:
            device.foreground = None
        device.meta_checked_at = time.time()
        return device

    # ---------- thao tác ----------

    def tap(self, serial: str, x: int, y: int) -> None:
        self.shell(serial, "input", "tap", str(x), str(y), timeout=15)

    def swipe(
        self, serial: str, start: tuple[int, int], end: tuple[int, int], duration_ms: int
    ) -> None:
        self.shell(
            serial,
            "input",
            "swipe",
            str(start[0]),
            str(start[1]),
            str(end[0]),
            str(end[1]),
            str(duration_ms),
            timeout=max(15.0, duration_ms / 1000 + 10),
        )

    def keyevent(self, serial: str, key: str) -> None:
        if not re.fullmatch(r"KEYCODE_[A-Z0-9_]+", key):
            raise AdbError(f"Keyevent không hợp lệ: {key}")
        self.shell(serial, "input", "keyevent", key, timeout=15)

    def text(self, serial: str, value: str) -> None:
        # ``input text`` không nhận khoảng trắng thô và diễn giải một số ký tự.
        escaped = (
            value.replace("\\", "\\\\")
            .replace(" ", "%s")
            .replace("'", "\\'")
            .replace('"', '\\"')
            .replace("&", "\\&")
            .replace("(", "\\(")
            .replace(")", "\\)")
            .replace("<", "\\<")
            .replace(">", "\\>")
            .replace(";", "\\;")
            .replace("|", "\\|")
            .replace("$", "\\$")
            .replace("`", "\\`")
        )
        self.shell(serial, "input", "text", escaped, timeout=20)

    def launch_app(self, serial: str, package: str) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_.]+", package):
            raise AdbError("Tên package không hợp lệ.")
        self.shell(
            serial, "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1",
            timeout=25,
        )

    def stop_app(self, serial: str, package: str) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_.]+", package):
            raise AdbError("Tên package không hợp lệ.")
        self.shell(serial, "am", "force-stop", package, timeout=20)
