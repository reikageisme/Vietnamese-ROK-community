"""Vòng chụp màn hình luân phiên cho toàn bộ dàn máy.

Nguyên tắc thiết kế: 16 điện thoại dùng chung băng thông USB của host. Một ảnh
``screencap -p`` 1080p nặng khoảng 1,5–2,5 MB, nên chụp cả 16 máy ở tốc độ cao sẽ
bão hoà USB và cướp băng thông của scanner đang chạy.

Hai cơ chế giữ cho nó không nghẽn:

1. **Chụp theo chế độ xem.** Khi người dùng đang ở màn hình một máy, panel *chỉ*
   chụp máy đó. 15 máy còn lại không ai nhìn, chụp chúng là vứt băng thông đi và
   làm chính máy đang điều khiển giật.
2. **Chỉ encode kích thước thực sự cần.** Ảnh lưới 420px rẻ; ảnh focus 960px đắt
   gấp nhiều lần. Chỉ máy đang xem mới được encode bản lớn.
"""

from __future__ import annotations

import io
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from PIL import Image
from rok_lab.adb import AdbError

from .adbbridge import AdbBridge
from .config import Settings


@dataclass
class Frame:
    png: bytes  # ảnh gốc, dùng cho hiệu chỉnh dhash
    grid_jpeg: bytes
    focus_jpeg: bytes | None  # chỉ có ở máy đang xem
    width: int
    height: int
    captured_at: float
    duration_ms: int

    @property
    def age(self) -> float:
        return time.time() - self.captured_at

    def payload(self, kind: str) -> bytes:
        if kind == "focus" and self.focus_jpeg:
            return self.focus_jpeg
        return self.grid_jpeg


@dataclass
class _Slot:
    next_due: float = 0.0
    interval: float = 0.0
    in_flight: bool = False
    failures: int = 0
    previous_at: float = 0.0
    fps: float = 0.0


def _encode(image: Image.Image, width: int, quality: int) -> bytes:
    if image.width > width:
        height = max(1, round(image.height * width / image.width))
        # BILINEAR nhanh hơn LANCZOS đáng kể và khác biệt không nhìn thấy được
        # trên ảnh đã thu nhỏ để xem qua trình duyệt.
        image = image.resize((width, height), Image.BILINEAR)
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
        self._mode = "grid"  # "grid" | "focus"
        self._paused = False
        self._pool = ThreadPoolExecutor(
            max_workers=max(1, settings.capture_workers), thread_name_prefix="capture"
        )
        self._meta_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="meta")
        self._thread: threading.Thread | None = None
        self._device_poll_at = 0.0
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
        self._meta_pool.shutdown(wait=False, cancel_futures=True)

    # ---------- điều khiển ----------

    def set_view(self, serial: str | None, mode: str | None = None) -> None:
        with self._lock:
            if mode in ("grid", "focus", "video"):
                self._mode = mode
            if serial != self._focus:
                self._focus = serial
                if serial:
                    self._slots.setdefault(serial, _Slot()).next_due = 0.0

    @property
    def focus(self) -> str | None:
        with self._lock:
            return self._focus

    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    def set_paused(self, paused: bool) -> None:
        with self._lock:
            self._paused = paused

    @property
    def paused(self) -> bool:
        with self._lock:
            return self._paused

    def request_now(self, serial: str) -> None:
        with self._lock:
            self._slots.setdefault(serial, _Slot()).next_due = 0.0

    def stats(self, serial: str) -> dict:
        with self._lock:
            slot = self._slots.get(serial)
            return {"fps": round(slot.fps, 2) if slot else 0.0}

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
        return self._capture(serial, want_focus=True)

    # ---------- nội bộ ----------

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
            self._stop.wait(0.05)

    def _dispatch(self, now: float) -> None:
        with self._lock:
            focus = self._focus
            mode = self._mode
        for device in self.bridge.devices():
            if not device.enabled or not device.ready:
                continue

            is_focus = device.serial == focus
            # Đang xem một máy: bỏ hẳn 15 máy còn lại. Đây là thay đổi lớn nhất
            # cho độ mượt — băng thông USB dồn hết cho máy đang điều khiển.
            if mode == "focus" and not is_focus:
                continue
            # Chế độ video: luồng H.264 lo phần hiển thị, screencap nghỉ hoàn toàn.
            # Hiệu chỉnh vẫn có ảnh PNG vì các endpoint đó tự chụp theo yêu cầu.
            if mode == "video":
                continue

            if now - device.meta_checked_at >= self.settings.meta_poll_interval:
                device.meta_checked_at = now
                self._meta_pool.submit(self._refresh_meta, device.serial)

            with self._lock:
                slot = self._slots.setdefault(device.serial, _Slot())
                if slot.in_flight or now < slot.next_due:
                    continue
                slot.in_flight = True
            self._pool.submit(self._worker, device.serial, is_focus)

    def _refresh_meta(self, serial: str) -> None:
        try:
            self.bridge.refresh_meta(serial)
        except Exception:  # noqa: BLE001 - thông tin phụ, không làm chết vòng nền
            pass

    def _worker(self, serial: str, is_focus: bool) -> None:
        started = time.time()
        try:
            self._capture(serial, want_focus=is_focus)
            duration = time.time() - started
            base = self.settings.focus_interval if is_focus else self.settings.grid_interval
            with self._lock:
                slot = self._slots.setdefault(serial, _Slot())
                slot.failures = 0
                if duration > self.settings.slow_capture_threshold:
                    slot.interval = min(base * 6 or 6.0, max(base, slot.interval or base) * 1.5)
                else:
                    slot.interval = base
                slot.next_due = time.time() + slot.interval
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                slot = self._slots.setdefault(serial, _Slot())
                slot.failures += 1
                slot.next_due = time.time() + min(
                    60.0, max(1.0, self.settings.grid_interval) * (2**slot.failures)
                )
            try:
                self.bridge.get(serial).last_error = str(exc)
            except AdbError:
                pass
        finally:
            with self._lock:
                self._slots.setdefault(serial, _Slot()).in_flight = False

    def _capture(self, serial: str, *, want_focus: bool) -> Frame:
        started = time.perf_counter()
        png = self.bridge.screencap(serial, timeout=self.settings.capture_timeout)
        duration_ms = round((time.perf_counter() - started) * 1000)

        with Image.open(io.BytesIO(png)) as image:
            image.load()
            width, height = image.size
            grid = _encode(image.copy(), self.settings.grid_width, self.settings.jpeg_quality)
            # Bản lớn chỉ dựng cho máy đang xem. Trước đây encode cho cả 16 máy,
            # tốn CPU gấp nhiều lần mà 15 bản không ai nhìn.
            focus = (
                _encode(image.copy(), self.settings.focus_width, self.settings.focus_quality)
                if want_focus
                else None
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
            slot = self._slots.setdefault(serial, _Slot())
            if slot.previous_at:
                gap = frame.captured_at - slot.previous_at
                if gap > 0:
                    slot.fps = 1.0 / gap
            slot.previous_at = frame.captured_at
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
