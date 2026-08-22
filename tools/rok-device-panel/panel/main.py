"""RokViet Device Panel — bảng điều khiển nội bộ cho dàn điện thoại quét dữ liệu.

Chạy sau SSH tunnel hoặc trong mạng nội bộ. Không bao giờ mở ra Internet: ai vào được
trang này là chạm được vào mọi tài khoản game đang đăng nhập trên 16 máy.
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Iterator

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.responses import (
    FileResponse,
    JSONResponse,
    PlainTextResponse,
    Response,
    StreamingResponse,
)
from fastapi.staticfiles import StaticFiles
from rok_lab.adb import AdbError

from .adbbridge import AdbBridge
from .calibrate import (
    DEFAULT_MAX_DISTANCE,
    ProfileStore,
    crop_png,
    fingerprint_png,
    normalize_region,
)
from .capture import CaptureService
from .config import Settings, load_settings

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
BROADCAST_ARM_SECONDS = 600  # tự tắt sau 10 phút để không quên bật

KEY_ALIASES = {
    "back": "KEYCODE_BACK",
    "home": "KEYCODE_HOME",
    "recents": "KEYCODE_APP_SWITCH",
    "enter": "KEYCODE_ENTER",
    "delete": "KEYCODE_DEL",
    "power": "KEYCODE_POWER",
    "volume_up": "KEYCODE_VOLUME_UP",
    "volume_down": "KEYCODE_VOLUME_DOWN",
    "wake": "KEYCODE_WAKEUP",
    "sleep": "KEYCODE_SLEEP",
    "escape": "KEYCODE_ESCAPE",
    "tab": "KEYCODE_TAB",
}

settings: Settings = load_settings()
bridge = AdbBridge(settings.adb_path)
capture = CaptureService(bridge, settings)
profiles = ProfileStore(settings.profile_source, settings.profile_working)
broadcast_pool = ThreadPoolExecutor(max_workers=16, thread_name_prefix="broadcast")

_broadcast_armed_until: float = 0.0

app = FastAPI(title="RokViet Device Panel", docs_url=None, redoc_url=None)


# --------------------------------------------------------------------------
# Xác thực
# --------------------------------------------------------------------------


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    if settings.auth_required and path.startswith("/api/"):
        supplied = request.headers.get("x-panel-token") or request.query_params.get("token")
        if supplied != settings.token:
            return JSONResponse({"error": "Token không hợp lệ."}, status_code=401)
    return await call_next(request)


def _fail(exc: Exception) -> HTTPException:
    if isinstance(exc, AdbError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


# --------------------------------------------------------------------------
# Vòng đời
# --------------------------------------------------------------------------


@app.on_event("startup")
def _startup() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    bridge.start_server()
    bridge.load_aliases(settings.aliases_path)
    bridge.refresh_devices()
    capture.start()


@app.on_event("shutdown")
def _shutdown() -> None:
    capture.stop()
    broadcast_pool.shutdown(wait=False, cancel_futures=True)


@app.get("/healthz", response_class=PlainTextResponse)
def healthz() -> str:
    return "ok"


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


# --------------------------------------------------------------------------
# Trạng thái
# --------------------------------------------------------------------------


def _broadcast_armed() -> bool:
    return settings.broadcast_enabled and time.time() < _broadcast_armed_until


@app.get("/api/state")
def state() -> dict[str, Any]:
    devices = []
    for device in bridge.devices():
        payload = device.as_json()
        frame = capture.frame(device.serial)
        payload["frameAge"] = round(frame.age, 1) if frame else None
        payload["frameAt"] = frame.captured_at if frame else None
        payload["hasFrame"] = frame is not None
        devices.append(payload)
    return {
        "devices": devices,
        "focus": capture.focus,
        "paused": capture.paused,
        "broadcast": {
            "supported": settings.broadcast_enabled,
            "armed": _broadcast_armed(),
            "secondsLeft": max(0, round(_broadcast_armed_until - time.time())),
            "maxDevices": settings.broadcast_max_devices,
        },
        "adb": bridge.version(),
        "gamePackage": settings.game_package,
        "gridInterval": settings.grid_interval,
        "focusInterval": settings.focus_interval,
        "profileSource": str(settings.profile_source),
        "serverTime": time.time(),
    }


@app.post("/api/focus")
def set_focus(payload: dict = Body(default={})) -> dict[str, Any]:
    serial = payload.get("serial")
    capture.set_focus(serial or None)
    return {"focus": capture.focus}


@app.post("/api/pause")
def set_pause(payload: dict = Body(default={})) -> dict[str, Any]:
    capture.set_paused(bool(payload.get("paused")))
    return {"paused": capture.paused}


@app.post("/api/devices/{serial}/enabled")
def set_enabled(serial: str, payload: dict = Body(default={})) -> dict[str, Any]:
    try:
        device = bridge.set_enabled(serial, bool(payload.get("enabled", True)))
    except AdbError as exc:
        raise _fail(exc) from exc
    return device.as_json()


@app.post("/api/devices/{serial}/meta")
def refresh_meta(serial: str) -> dict[str, Any]:
    try:
        return bridge.refresh_meta(serial).as_json()
    except AdbError as exc:
        raise _fail(exc) from exc


# --------------------------------------------------------------------------
# Khung hình
# --------------------------------------------------------------------------

_NO_STORE = {"Cache-Control": "no-store, max-age=0"}


@app.get("/api/devices/{serial}/frame.jpg")
def frame(serial: str, kind: str = Query(default="grid")) -> Response:
    item = capture.frame(serial)
    if item is None:
        raise HTTPException(status_code=404, detail="Chưa có khung hình.")
    payload = item.focus_jpeg if kind == "focus" else item.grid_jpeg
    return Response(content=payload, media_type="image/jpeg", headers=_NO_STORE)


@app.get("/api/devices/{serial}/screenshot.png")
def screenshot(serial: str) -> Response:
    item = capture.frame(serial)
    if item is None:
        try:
            item = capture.capture_now(serial)
        except AdbError as exc:
            raise _fail(exc) from exc
    alias = bridge.alias_for(serial)
    return Response(
        content=item.png,
        media_type="image/png",
        headers={
            **_NO_STORE,
            "Content-Disposition": f'attachment; filename="{alias}-{int(item.captured_at)}.png"',
        },
    )


@app.post("/api/devices/{serial}/refresh")
def refresh_frame(serial: str) -> dict[str, Any]:
    try:
        item = capture.capture_now(serial)
    except AdbError as exc:
        raise _fail(exc) from exc
    return {"capturedAt": item.captured_at, "durationMs": item.duration_ms}


@app.get("/api/devices/{serial}/stream.mjpg")
def stream(serial: str) -> StreamingResponse:
    """Luồng MJPEG cho máy đang xem. Chỉ dùng cho một máy, không dùng cho lưới."""
    boundary = "rokframe"

    def generate() -> Iterator[bytes]:
        last = 0.0
        idle_deadline = time.time() + 900  # tự đóng sau 15 phút
        while time.time() < idle_deadline:
            item = capture.wait_for_frame(serial, after=last, timeout=10.0)
            if item is None:
                break
            if item.captured_at <= last:
                continue  # hết thời gian chờ mà không có khung mới
            last = item.captured_at
            payload = item.focus_jpeg
            yield (
                f"--{boundary}\r\nContent-Type: image/jpeg\r\n"
                f"Content-Length: {len(payload)}\r\n\r\n"
            ).encode()
            yield payload
            yield b"\r\n"

    return StreamingResponse(
        generate(),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}",
        headers=_NO_STORE,
    )


# --------------------------------------------------------------------------
# Điều khiển một máy
# --------------------------------------------------------------------------


def _pixels(serial: str, x: float, y: float) -> tuple[int, int]:
    """Đổi toạ độ chuẩn hoá 0–1 sang pixel thật của máy đó.

    Panel luôn nói chuyện bằng toạ độ chuẩn hoá — giống hệt ``DeviceProfile.point`` —
    nên một thao tác phát đi vẫn đúng trên máy có độ phân giải khác.
    """
    device = bridge.require_ready(serial)
    width, height = device.width, device.height
    if not width or not height:
        width, height = bridge.screen_size(serial)
        device.width, device.height = width, height
    return round(max(0.0, min(1.0, x)) * width), round(max(0.0, min(1.0, y)) * height)


def _perform(serial: str, action: dict[str, Any]) -> dict[str, Any]:
    # Chặn ngay ở đây cho MỌI loại thao tác. Nếu chỉ kiểm tra trong `_pixels` thì
    # phím và chuỗi chữ vẫn được gửi tới máy chưa cấp quyền, và lệnh phát đồng loạt
    # sẽ báo thành công cho những máy thực ra không nhận được gì.
    bridge.require_ready(serial)
    kind = str(action.get("type") or "").lower()
    if kind == "tap":
        x, y = _pixels(serial, float(action["x"]), float(action["y"]))
        bridge.tap(serial, x, y)
        return {"type": "tap", "pixels": [x, y]}
    if kind == "swipe":
        start = _pixels(serial, float(action["x1"]), float(action["y1"]))
        end = _pixels(serial, float(action["x2"]), float(action["y2"]))
        duration = int(action.get("durationMs") or 400)
        duration = max(50, min(5000, duration))
        bridge.swipe(serial, start, end, duration)
        return {"type": "swipe", "from": list(start), "to": list(end)}
    if kind == "key":
        raw = str(action.get("key") or "")
        key = KEY_ALIASES.get(raw.lower(), raw.upper())
        bridge.keyevent(serial, key)
        return {"type": "key", "key": key}
    if kind == "text":
        value = str(action.get("text") or "")
        if not value:
            raise AdbError("Chuỗi nhập rỗng.")
        if len(value) > 500:
            raise AdbError("Chuỗi nhập quá dài.")
        bridge.text(serial, value)
        return {"type": "text", "length": len(value)}
    if kind == "launch":
        package = str(action.get("package") or settings.game_package)
        bridge.launch_app(serial, package)
        return {"type": "launch", "package": package}
    if kind == "stop":
        package = str(action.get("package") or settings.game_package)
        bridge.stop_app(serial, package)
        return {"type": "stop", "package": package}
    raise AdbError(f"Thao tác không hỗ trợ: {kind or '(trống)'}")


@app.post("/api/devices/{serial}/action")
def device_action(serial: str, action: dict = Body(...)) -> dict[str, Any]:
    try:
        result = _perform(serial, action)
    except (AdbError, KeyError, ValueError, TypeError) as exc:
        raise _fail(exc if isinstance(exc, AdbError) else AdbError(str(exc))) from exc
    # Chụp lại ngay để người dùng thấy kết quả thao tác.
    capture.request_now(serial)
    return {"ok": True, "result": result}


# --------------------------------------------------------------------------
# Đồng bộ nhiều máy
# --------------------------------------------------------------------------


@app.post("/api/broadcast/arm")
def arm_broadcast(payload: dict = Body(default={})) -> dict[str, Any]:
    global _broadcast_armed_until
    if not settings.broadcast_enabled:
        raise HTTPException(status_code=403, detail="Chế độ đồng bộ đã bị tắt bằng cấu hình.")
    if payload.get("armed"):
        _broadcast_armed_until = time.time() + BROADCAST_ARM_SECONDS
    else:
        _broadcast_armed_until = 0.0
    return {
        "armed": _broadcast_armed(),
        "secondsLeft": max(0, round(_broadcast_armed_until - time.time())),
    }


@app.post("/api/broadcast")
def broadcast(payload: dict = Body(...)) -> dict[str, Any]:
    if not _broadcast_armed():
        raise HTTPException(
            status_code=403,
            detail="Chế độ đồng bộ chưa được mở khoá. Bật công tắc rồi thử lại.",
        )
    serials = [str(item) for item in (payload.get("serials") or [])]
    action = payload.get("action") or {}
    if not serials:
        raise HTTPException(status_code=400, detail="Chưa chọn máy nào.")
    if len(serials) > settings.broadcast_max_devices:
        raise HTTPException(status_code=400, detail="Vượt quá số máy cho phép mỗi lần phát.")

    def run(serial: str) -> dict[str, Any]:
        started = time.perf_counter()
        try:
            result = _perform(serial, action)
            return {
                "serial": serial,
                "alias": bridge.alias_for(serial),
                "ok": True,
                "result": result,
                "ms": round((time.perf_counter() - started) * 1000),
            }
        except Exception as exc:  # noqa: BLE001 - báo lỗi từng máy, không hỏng cả lệnh
            return {
                "serial": serial,
                "alias": bridge.alias_for(serial),
                "ok": False,
                "error": str(exc),
                "ms": round((time.perf_counter() - started) * 1000),
            }

    results = list(broadcast_pool.map(run, serials))
    for item in results:
        capture.request_now(item["serial"])
    return {
        "sent": len(results),
        "succeeded": sum(1 for item in results if item["ok"]),
        "results": results,
    }


# --------------------------------------------------------------------------
# Hiệu chỉnh profile
# --------------------------------------------------------------------------


@app.get("/api/profile")
def get_profile() -> dict[str, Any]:
    document = profiles.document()
    return {
        "profile": document,
        "counts": {
            "taps": len(document.get("taps", {})),
            "regions": len(document.get("regions", {})),
            "screens": len(document.get("screens", {})),
        },
        "workingPath": str(settings.profile_working),
        "sourcePath": str(settings.profile_source),
    }


@app.get("/api/profile/export")
def export_profile() -> Response:
    return Response(
        content=profiles.as_text(),
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="profile.json"',
            **_NO_STORE,
        },
    )


@app.post("/api/profile/point")
def add_point(payload: dict = Body(...)) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên điểm chạm.")
    return profiles.set_point(name, float(payload["x"]), float(payload["y"]))


@app.post("/api/profile/region")
def add_region(payload: dict = Body(...)) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Thiếu tên vùng.")
    region = normalize_region(
        float(payload["x"]), float(payload["y"]), float(payload["w"]), float(payload["h"])
    )
    if region[2] <= 0 or region[3] <= 0:
        raise HTTPException(status_code=400, detail="Vùng chọn quá nhỏ.")
    return profiles.set_region(name, region)


@app.post("/api/profile/fingerprint")
def add_fingerprint(payload: dict = Body(...)) -> dict[str, Any]:
    screen = str(payload.get("screen") or "").strip()
    serial = str(payload.get("serial") or "")
    if not screen:
        raise HTTPException(status_code=400, detail="Thiếu tên màn hình.")
    item = capture.frame(serial)
    if item is None:
        raise HTTPException(status_code=404, detail="Chưa có khung hình để lấy dấu vân.")
    region = normalize_region(
        float(payload["x"]), float(payload["y"]), float(payload["w"]), float(payload["h"])
    )
    if region[2] <= 0 or region[3] <= 0:
        raise HTTPException(status_code=400, detail="Vùng chọn quá nhỏ.")
    dhash = fingerprint_png(item.png, region)
    return profiles.set_fingerprint(
        screen,
        region,
        dhash,
        int(payload.get("maxDistance") or DEFAULT_MAX_DISTANCE),
        bool(payload.get("replace")),
    )


@app.post("/api/profile/delete")
def delete_entry(payload: dict = Body(...)) -> dict[str, Any]:
    kind = str(payload.get("kind") or "")
    name = str(payload.get("name") or "")
    index = payload.get("index")
    ok = profiles.delete(kind, name, int(index) if index is not None else None)
    if not ok:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục cần xoá.")
    return {"ok": True}


@app.post("/api/profile/apply")
def apply_profile() -> dict[str, Any]:
    try:
        path = profiles.apply_to_source()
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Không ghi được profile: {exc}") from exc
    return {"ok": True, "path": str(path), "backup": f"{path}.bak"}


@app.post("/api/profile/reset")
def reset_profile() -> dict[str, Any]:
    profiles.reset_from_source()
    return {"ok": True}


@app.get("/api/profile/match")
def match_profile(serial: str = Query(...)) -> dict[str, Any]:
    item = capture.frame(serial)
    if item is None:
        raise HTTPException(status_code=404, detail="Chưa có khung hình.")
    return {"capturedAt": item.captured_at, "screens": profiles.match(item.png)}


@app.get("/api/profile/preview.png")
def preview_region(
    serial: str = Query(...),
    x: float = Query(...),
    y: float = Query(...),
    w: float = Query(...),
    h: float = Query(...),
) -> Response:
    item = capture.frame(serial)
    if item is None:
        raise HTTPException(status_code=404, detail="Chưa có khung hình.")
    region = normalize_region(x, y, w, h)
    if region[2] <= 0 or region[3] <= 0:
        raise HTTPException(status_code=400, detail="Vùng chọn quá nhỏ.")
    return Response(content=crop_png(item.png, region), media_type="image/png", headers=_NO_STORE)


@app.get("/api/profile/dhash")
def region_dhash(
    serial: str = Query(...),
    x: float = Query(...),
    y: float = Query(...),
    w: float = Query(...),
    h: float = Query(...),
) -> dict[str, Any]:
    item = capture.frame(serial)
    if item is None:
        raise HTTPException(status_code=404, detail="Chưa có khung hình.")
    region = normalize_region(x, y, w, h)
    if region[2] <= 0 or region[3] <= 0:
        raise HTTPException(status_code=400, detail="Vùng chọn quá nhỏ.")
    return {"region": list(region), "dhash": fingerprint_png(item.png, region)}


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
