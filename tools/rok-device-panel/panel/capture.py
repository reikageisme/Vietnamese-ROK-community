"""Vòng chụp màn hình luân phiên cho toàn bộ dàn máy.

Nguyên tắc thiết kế: 16 điện thoại dùng chung băng thông USB của host. Một ảnh
``screencap -p`` 1080p nặng khoảng 1,5–2,5 MB, nên chụp cả 16 máy ở tốc độ cao sẽ
bão hoà USB và cướp băng thông của scanner đang chạy.

Vì vậy panel chụp *luân phiên*: mỗi ô lưới làm mới sau ``grid_interval`` giây, chỉ
máy đang xem (focus) mới được làm mới nhanh. Máy nào chụp chậm sẽ tự bị giãn chu kỳ.
"""

from __future__ import annotations

import io
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from PIL import Image
from rok_lab.adb import AdbError

from .adbbridge import AdbBridge
from .config import Settings


@dataclass
class Frame:
    png: bytes  # ảnh gốc, dùng cho hiệu chỉnh dhash
    grid_jpeg: bytes
    focus_jpeg: bytes
    width: int
    height: int
    captured_at: float
    duration_ms: int

    @property
    def age(self) -> float:
        return time.time() - self.captured_at


@dataclass
class _Slot:
    next_due: float = 0.0
    interval: float = 0.0
    in_flight: bool = False
    failures: int = 0


def _encode(image: Image.Image, width: int, quality: int) -> bytes:
    if image.width > width:
        height = max(1, round(image.height * width / image.width))
        image = image.resize((width, height), Image.LANCZOS)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=False)
    return buffer.getvalue()


class CaptureService:
    def __init__(self, bridge: AdbBridge, settings: Settings) -> None:
        self.bridge = bridge
        self.settings = settings
        self._frames: dict[str, Frame] = {}
        self._slots: dict[str, _Slot] = {}
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._focus: str | None = None
        self._paused = False
        self._pool = ThreadPoolExecutor(
            max_workers=max(1, settings.capture_workers), thread_name_prefix="capture"
        )
        self._thread: threading.Thread | None = None
        self._device_poll_at = 0.0
        # Đánh thức người đang chờ khung hình mới (dùng cho luồng MJPEG).
        self._frame_event = threading.Condition(self._lock)

    # ---------- vòng đời ----------

    def start(self) -> None:
        if self._thread:
            return
        self._thread = threading.Thread(target=self._loop, name="capture-loop", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._pool.shutdown(wait=False, cancel_futures=True)

    # ---------- điều khiển ----------

    def set_focus(self, serial: str | None) -> None:
        with self._lock:
            if self._focus == serial:
                return
            self._focus = serial
            if serial and serial in self._slots:
                # Ưu tiên máy vừa được chọn ngay lập tức.
                self._slots[serial].next_due = 0.0

    @property
    def focus(self) -> str | None:
        with self._lock:
            return self._focus

    def set_paused(self, paused: bool) -> None:
        with self._lock:
            self._paused = paused

    @property
    def paused(self) -> bool:
        with self._lock:
            return self._paused

    def request_now(self, serial: str) -> None:
        with self._lock:
            slot = self._slots.setdefault(serial, _Slot())
            slot.next_due = 0.0

    # ---------- truy cập khung hình ----------

    def frame(self, serial: str) -> Frame | None:
        with self._lock:
            return self._frames.get(serial)

    def wait_for_frame(self, serial: str, after: float, timeout: float) -> Frame | None:
        deadline = time.time() + timeout
        with self._frame_event:
            while not self._stop.is_set():
                frame = self._frames.get(serial)
                if frame and frame.captured_at > after:
                    return frame
                remaining = deadline - time.time()
                if remaining <= 0:
                    return frame
                self._frame_event.wait(min(remaining, 1.0))
        return None

    def capture_now(self, serial: str) -> Frame:
        """Chụp đồng bộ, bỏ qua lịch. Dùng cho nút làm mới và hiệu chỉnh."""
        return self._capture(serial)

    # ---------- nội bộ ----------

    def _interval_for(self, serial: str, slot: _Slot) -> float:
        base = (
            self.settings.focus_interval
            if serial == self._focus
            else self.settings.grid_interval
        )
        # Giãn dần khi máy chụp chậm hoặc lỗi liên tiếp.
        if slot.interval > base:
            return slot.interval
        return base

    def _loop(self) -> None:
        while not self._stop.is_set():
            now = time.time()
            if now >= self._device_poll_at:
                self._device_poll_at = now + self.settings.device_poll_interval
                try:
                    self.bridge.refresh_devices()
                except Exception:  # noqa: BLE001 - vòng nền không được chết
                    pass

            if not self.paused:
                self._dispatch(now)
            self._stop.wait(0.15)

    def _dispatch(self, now: float) -> None:
        focus = self.focus
        for device in self.bridge.devices():
            if not device.enabled or not device.ready:
                continue
            # Pin và ứng dụng đang chạy đọc bằng dumpsys nên khá chậm; làm mới thưa
            # và lệch pha giữa các máy để không dồn tải vào cùng một nhịp.
            if now - device.meta_checked_at >= self.settings.meta_poll_interval:
                device.meta_checked_at = now  # đặt trước để không xếp hàng trùng
                self._pool.submit(self._refresh_meta, device.serial)
            with self._lock:
                slot = self._slots.setdefault(device.serial, _Slot())
                if slot.in_flight or now < slot.next_due:
                    continue
                slot.in_flight = True
            self._pool.submit(self._worker, device.serial, focus)

    def _refresh_meta(self, serial: str) -> None:
        try:
            self.bridge.refresh_meta(serial)
        except Exception:  # noqa: BLE001 - thông tin phụ, không được làm chết vòng nền
            pass

    def _worker(self, serial: str, focus: str | None) -> None:
        started = time.time()
        try:
            self._capture(serial)
            duration = time.time() - started
            with self._lock:
                slot = self._slots.setdefault(serial, _Slot())
                slot.failures = 0
                base = (
                    self.settings.focus_interval
                    if serial == focus
                    else self.settings.grid_interval
                )
                if duration > self.settings.slow_capture_threshold:
                    # Máy chậm: giãn chu kỳ, tối đa gấp 6 lần mức nền.
                    slot.interval = min(base * 6, max(base, slot.interval or base) * 1.5)
                else:
                    slot.interval = base
                slot.next_due = time.time() + slot.interval
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                slot = self._slots.setdefault(serial, _Slot())
                slot.failures += 1
                backoff = min(60.0, self.settings.grid_interval * (2**slot.failures))
                slot.next_due = time.time() + backoff
            try:
                device = self.bridge.get(serial)
                device.last_error = str(exc)
            except AdbError:
                pass
        finally:
            with self._lock:
                slot = self._slots.setdefault(serial, _Slot())
                slot.in_flight = False

    def _capture(self, serial: str) -> Frame:
        started = time.perf_counter()
        png = self.bridge.screencap(serial, timeout=self.settings.capture_timeout)
        duration_ms = round((time.perf_counter() - started) * 1000)
        with Image.open(io.BytesIO(png)) as image:
            image.load()
            width, height = image.size
            grid = _encode(image.copy(), self.settings.grid_width, self.settings.jpeg_quality)
            focus = _encode(
                image.copy(), self.settings.focus_width, min(90, self.settings.jpeg_quality + 10)
            )
        frame = Frame(
            png=png,
            grid_jpeg=grid,
            focus_jpeg=focus,
            width=width,
            height=height,
            captured_at=time.time(),
            duration_ms=duration_ms,
        )
        with self._frame_event:
            self._frames[serial] = frame
            self._frame_event.notify_all()
        try:
            device = self.bridge.get(serial)
            device.width, device.height = width, height
            device.last_capture_ms = duration_ms
            device.last_error = None
        except AdbError:
            pass
        return frame
