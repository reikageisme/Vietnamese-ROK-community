"""Luồng hình H.264 lấy thẳng từ bộ mã hoá phần cứng của điện thoại.

Vì sao không dùng giao thức scrcpy: nó đổi theo từng phiên bản — số socket, thứ tự
header, cách đóng gói khung — và không có điện thoại thật để kiểm chứng thì tự viết
lại là đánh cược. Android có sẵn ``screenrecord``, dùng đúng bộ mã hoá H.264 phần
cứng đó nhưng chỉ trả về một luồng byte Annex-B thẳng ra stdout, không có gì để đoán
sai.

So với ``screencap``:

===================  ==================  ====================
                     screencap            screenrecord
===================  ==================  ====================
Nén ở đâu            CPU điện thoại       Bộ mã hoá phần cứng
Mỗi khung            ~2 MB PNG            chỉ phần thay đổi
Nhịp                 2–3/giây             30–60/giây
Băng thông USB       ~4–5 MB/s            ~0,5 MB/s
===================  ==================  ====================

Nhiều khung hình hơn mà tốn ít băng thông hơn, vì H.264 chỉ truyền khác biệt giữa
các khung thay vì gửi lại toàn bộ màn hình mỗi lần.

Hạn chế đã biết: ``screenrecord`` tự dừng sau 180 giây. Lớp này chạy lại tiến trình
trước khi chạm mốc đó và báo cho trình duyệt đặt lại bộ giải mã, nên người dùng chỉ
thấy một nhịp khựng rất ngắn.
"""

from __future__ import annotations

import asyncio
import subprocess
import threading
import time
from dataclasses import dataclass, field

from rok_lab.adb import AdbError

from .adbbridge import AdbBridge
from .config import Settings

# screenrecord chặn cứng ở 180 giây; khởi động lại sớm hơn để không bị đứt đột ngột.
SEGMENT_SECONDS = 170
READ_CHUNK = 32 * 1024
# Hàng đợi mỗi người xem. Đầy thì bỏ gói cũ — với video, trễ tệ hơn mất khung.
QUEUE_LIMIT = 240


# eq=False là bắt buộc: dataclass mặc định sinh __eq__, khiến __hash__ thành None
# và đối tượng không cho vào set() được. Người xem phải phân biệt theo danh tính.
@dataclass(eq=False)
class Subscriber:
    queue: asyncio.Queue
    loop: asyncio.AbstractEventLoop
    dropped: int = 0

    def push(self, item: tuple[str, bytes | None]) -> None:
        def deliver() -> None:
            if self.queue.full():
                try:
                    self.queue.get_nowait()
                    self.dropped += 1
                except asyncio.QueueEmpty:
                    pass
            self.queue.put_nowait(item)

        try:
            self.loop.call_soon_threadsafe(deliver)
        except RuntimeError:
            pass  # vòng lặp đã đóng, người xem sắp bị gỡ


@dataclass
class _Stats:
    started_at: float = 0.0
    bytes_out: int = 0
    segments: int = 0
    last_error: str | None = None


class VideoSession:
    """Một tiến trình screenrecord cho một máy, phát cho nhiều người xem."""

    def __init__(self, bridge: AdbBridge, serial: str, settings: Settings) -> None:
        self.bridge = bridge
        self.serial = serial
        self.settings = settings
        self._subscribers: set[Subscriber] = set()
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._process: subprocess.Popen | None = None
        self.stats = _Stats()

    # ---------- người xem ----------

    def add(self, subscriber: Subscriber) -> None:
        with self._lock:
            self._subscribers.add(subscriber)
            if self._thread is None:
                self._start()

    def remove(self, subscriber: Subscriber) -> bool:
        """Gỡ một người xem. Trả về True nếu không còn ai và phiên đã dừng."""
        with self._lock:
            self._subscribers.discard(subscriber)
            if self._subscribers:
                return False
        self.close()
        return True

    @property
    def viewers(self) -> int:
        with self._lock:
            return len(self._subscribers)

    def _broadcast(self, item: tuple[str, bytes | None]) -> None:
        with self._lock:
            targets = list(self._subscribers)
        for subscriber in targets:
            subscriber.push(item)

    # ---------- vòng đời ----------

    def _start(self) -> None:
        self._stop.clear()
        self.stats = _Stats(started_at=time.time())
        self._thread = threading.Thread(
            target=self._run, name=f"video-{self.serial[:8]}", daemon=True
        )
        self._thread.start()

    def close(self) -> None:
        self._stop.set()
        process = self._process
        if process and process.poll() is None:
            try:
                process.kill()
            except OSError:
                pass
        thread = self._thread
        if thread and thread is not threading.current_thread():
            thread.join(timeout=3)
        self._thread = None

    # ---------- đọc luồng ----------

    def _command(self) -> list[str]:
        command = [
            str(self.bridge.path),
            "-s",
            self.serial,
            "exec-out",
            "screenrecord",
            "--output-format=h264",
            f"--bit-rate={self.settings.h264_bitrate}",
            f"--time-limit={SEGMENT_SECONDS}",
        ]
        # Mặc định KHÔNG truyền --size: để screenrecord giữ đúng độ phân giải và
        # hướng màn hình thật. Đoán sai tỉ lệ ở đây sẽ làm ảnh méo hoặc viền đen,
        # mà game chạy ngang trên màn dọc thì rất dễ đoán sai.
        if self.settings.h264_size:
            command.append(f"--size={self.settings.h264_size}")
        command.append("-")
        return command

    def _run(self) -> None:
        while not self._stop.is_set():
            segment_started = time.time()
            try:
                self._process = subprocess.Popen(
                    self._command(), stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
            except OSError as exc:
                self.stats.last_error = str(exc)
                self._broadcast(("error", str(exc).encode()))
                return

            self.stats.segments += 1
            # Đoạn mới bắt đầu bằng SPS/PPS/IDR mới, nên trình duyệt phải dựng lại
            # bộ giải mã; nếu không nó sẽ cố ghép khung mới vào tham chiếu cũ.
            if self.stats.segments > 1:
                self._broadcast(("reset", None))

            stream = self._process.stdout
            assert stream is not None
            saw_data = False
            while not self._stop.is_set():
                chunk = stream.read(READ_CHUNK)
                if not chunk:
                    break
                saw_data = True
                self.stats.bytes_out += len(chunk)
                self._broadcast(("data", chunk))

            code = self._process.poll()
            error = b""
            if self._process.stderr is not None:
                try:
                    error = self._process.stderr.read() or b""
                except (OSError, ValueError):
                    error = b""
            self._process = None

            if self._stop.is_set():
                return
            if not saw_data:
                message = error.decode("utf-8", "replace").strip() or (
                    f"screenrecord thoát với mã {code} mà không trả về dữ liệu."
                )
                self.stats.last_error = message
                self._broadcast(("error", message.encode()))
                return
            # Đoạn kết thúc quá nhanh nghĩa là có gì đó sai, đừng quay vòng liên tục.
            if time.time() - segment_started < 2:
                self.stats.last_error = "screenrecord dừng ngay sau khi khởi động."
                self._broadcast(("error", self.stats.last_error.encode()))
                return


class VideoService:
    """Quản lý các phiên video, mỗi máy tối đa một tiến trình screenrecord."""

    def __init__(self, bridge: AdbBridge, settings: Settings) -> None:
        self.bridge = bridge
        self.settings = settings
        self._sessions: dict[str, VideoSession] = {}
        self._lock = threading.RLock()

    def subscribe(self, serial: str, subscriber: Subscriber) -> VideoSession:
        self.bridge.require_ready(serial)
        with self._lock:
            session = self._sessions.get(serial)
            if session is None:
                session = VideoSession(self.bridge, serial, self.settings)
                self._sessions[serial] = session
        session.add(subscriber)
        return session

    def unsubscribe(self, serial: str, subscriber: Subscriber) -> None:
        with self._lock:
            session = self._sessions.get(serial)
        if session is None:
            return
        if session.remove(subscriber):
            with self._lock:
                if self._sessions.get(serial) is session and session.viewers == 0:
                    self._sessions.pop(serial, None)

    def active(self) -> dict[str, int]:
        with self._lock:
            return {serial: item.viewers for serial, item in self._sessions.items()}

    def is_streaming(self, serial: str) -> bool:
        with self._lock:
            session = self._sessions.get(serial)
            return bool(session and session.viewers)

    def stop_all(self) -> None:
        with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for session in sessions:
            session.close()

    def stats(self, serial: str) -> dict:
        with self._lock:
            session = self._sessions.get(serial)
        if not session:
            return {"streaming": False}
        elapsed = max(0.001, time.time() - session.stats.started_at)
        return {
            "streaming": True,
            "viewers": session.viewers,
            "kbps": round(session.stats.bytes_out * 8 / elapsed / 1000),
            "segments": session.stats.segments,
            "lastError": session.stats.last_error,
        }


def probe_screenrecord(bridge: AdbBridge, serial: str) -> tuple[bool, str]:
    """Kiểm tra máy có chạy được screenrecord không, trước khi hứa với giao diện."""
    try:
        output = bridge.shell(serial, "screenrecord", "--help", timeout=12)
    except AdbError as exc:
        return False, str(exc)
    if "output-format" not in output and "bit-rate" not in output:
        return False, "Máy không hỗ trợ screenrecord H.264."
    return True, ""
