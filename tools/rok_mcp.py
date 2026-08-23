#!/usr/bin/env python3
"""ROK FAQ MCP server — cho Claude làm việc thẳng với server và dàn điện thoại.

Chạy trên máy Windows của bạn (nơi có Tailscale), không phải trên server. Claude
Desktop khởi động file này và nói chuyện với nó qua stdin/stdout.

Thiết kế có chủ đích: **không phụ thuộc thư viện ngoài nào cả**. Chỉ dùng thư viện
chuẩn của Python. Sau mấy vòng vật lộn với môi trường, thêm một bước `pip install`
là thêm một chỗ để hỏng.

Xác thực SSH bằng **khoá**, không phải mật khẩu. Bản ssh.exe của Windows không nhập
mật khẩu tự động được, nên đây vừa là ràng buộc kỹ thuật vừa là điều nên làm.

Cấu hình bằng biến môi trường, đặt trong claude_desktop_config.json:

    ROK_SSH_HOST     100.113.111.64
    ROK_SSH_USER     root
    ROK_SSH_KEY      C:\\Users\\ban\\.ssh\\id_ed25519
    ROK_REPO         /root/Vietnamese-ROK-community
    ROK_PANEL_URL    http://100.113.111.64:5100
    ROK_PANEL_TOKEN  <PANEL_TOKEN trong .env>
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

SERVER_NAME = "rokfaq"
SERVER_VERSION = "1.0.0"
DEFAULT_PROTOCOL = "2024-11-05"

# Cắt bớt đầu ra dài để không nhồi cả nghìn dòng log vào ngữ cảnh.
MAX_OUTPUT_CHARS = 24_000


# ---------------------------------------------------------------------------
# Cấu hình
# ---------------------------------------------------------------------------


def env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


class Config:
    def __init__(self) -> None:
        self.ssh_host = env("ROK_SSH_HOST")
        self.ssh_user = env("ROK_SSH_USER", "root")
        self.ssh_key = env("ROK_SSH_KEY")
        self.ssh_port = env("ROK_SSH_PORT", "22")
        self.repo = env("ROK_REPO", "/root/Vietnamese-ROK-community")
        self.panel_url = env("ROK_PANEL_URL").rstrip("/")
        self.panel_token = env("ROK_PANEL_TOKEN")

    def missing_ssh(self) -> str | None:
        if not self.ssh_host:
            return "Thiếu ROK_SSH_HOST."
        if not shutil.which("ssh"):
            return "Không tìm thấy ssh. Trên Windows 10/11 bật OpenSSH Client trong Optional Features."
        return None

    def missing_panel(self) -> str | None:
        if not self.panel_url:
            return "Thiếu ROK_PANEL_URL."
        return None


CONFIG = Config()


# ---------------------------------------------------------------------------
# SSH và HTTP
# ---------------------------------------------------------------------------


def run_ssh(command: str, timeout: int = 120) -> tuple[int, str]:
    """Chạy một lệnh trên server. Trả về (mã thoát, đầu ra gộp cả stderr)."""
    problem = CONFIG.missing_ssh()
    if problem:
        return 1, problem

    argv = ["ssh"]
    if CONFIG.ssh_key:
        argv += ["-i", CONFIG.ssh_key]
    argv += [
        "-p", CONFIG.ssh_port,
        # Không hỏi gì hết: server chạy nền, không có ai gõ "yes".
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=12",
        f"{CONFIG.ssh_user}@{CONFIG.ssh_host}",
        command,
    ]
    try:
        result = subprocess.run(
            argv, capture_output=True, timeout=timeout,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except subprocess.TimeoutExpired:
        return 124, f"Lệnh quá {timeout} giây, đã huỷ."
    except OSError as exc:
        return 1, f"Không chạy được ssh: {exc}"

    out = result.stdout.decode("utf-8", "replace")
    err = result.stderr.decode("utf-8", "replace")
    combined = (out + ("\n" + err if err.strip() else "")).strip()
    if result.returncode != 0 and "Permission denied" in err:
        combined += (
            "\n\nSSH từ chối. Kiểm tra khoá công khai đã nằm trong "
            f"{CONFIG.ssh_user}@{CONFIG.ssh_host}:~/.ssh/authorized_keys chưa."
        )
    return result.returncode, combined


def panel_request(path: str, method: str = "GET", body: dict | None = None,
                  timeout: int = 30) -> tuple[int, bytes, str]:
    """Gọi API của panel. Trả về (mã HTTP, nội dung, kiểu nội dung)."""
    problem = CONFIG.missing_panel()
    if problem:
        return 0, problem.encode(), "text/plain"

    url = CONFIG.panel_url + (path if path.startswith("/") else "/" + path)
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    if CONFIG.panel_token:
        request.add_header("X-Panel-Token", CONFIG.panel_token)
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(), response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), exc.headers.get("Content-Type", "") if exc.headers else ""
    except urllib.error.URLError as exc:
        return 0, f"Không nối được panel tại {CONFIG.panel_url}: {exc.reason}".encode(), "text/plain"


def clip(text: str) -> str:
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    return text[:MAX_OUTPUT_CHARS] + f"\n… (đã cắt bớt, tổng {len(text)} ký tự)"


# ---------------------------------------------------------------------------
# Các công cụ
# ---------------------------------------------------------------------------


def text_result(text: str, error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": clip(text) or "(không có đầu ra)"}],
            "isError": error}


def tool_run(args: dict) -> dict:
    command = str(args.get("command") or "").strip()
    if not command:
        return text_result("Thiếu tham số command.", True)
    code, output = run_ssh(command, int(args.get("timeout") or 120))
    header = f"$ {command}\n(mã thoát {code})\n\n"
    return text_result(header + output, code != 0)


def tool_devices(_args: dict) -> dict:
    status, payload, _ = panel_request("/api/state")
    if status != 200:
        return text_result(f"Panel trả {status}: {payload.decode('utf-8', 'replace')}", True)
    try:
        state = json.loads(payload)
    except json.JSONDecodeError:
        return text_result("Panel trả về dữ liệu không phải JSON.", True)

    lines = [
        f"adb: {state.get('adb')}",
        f"chế độ xem: {state.get('mode')} · máy đang xem: {state.get('focus') or '—'}"
        f" · tạm dừng chụp: {state.get('paused')}",
        "",
        f"{'tên':14}{'serial':18}{'trạng thái':20}{'pin':>5}  {'chụp':>7}  ứng dụng",
    ]
    for device in state.get("devices", []):
        video = device.get("video") or {}
        note = f" [H.264 {video.get('kbps')}kbps]" if video.get("streaming") else ""
        lines.append(
            f"{device.get('alias', ''):14}{device.get('serial', ''):18}"
            f"{device.get('stateLabel', ''):20}"
            f"{str(device.get('battery') or '—'):>5}  "
            f"{str(device.get('lastCaptureMs') or '—'):>7}  "
            f"{device.get('foreground') or ''}{note}"
        )
        if device.get("lastError"):
            lines.append(f"{'':14}lỗi: {device['lastError']}")
    return text_result("\n".join(lines))


def tool_screen(args: dict) -> dict:
    """Ảnh màn hình thật của một máy — để Claude nhìn được game đang hiện gì."""
    serial = str(args.get("serial") or "").strip()
    if not serial:
        return text_result("Thiếu tham số serial.", True)
    status, payload, kind = panel_request(
        f"/api/devices/{urllib.parse.quote(serial)}/screenshot.png", timeout=60
    )
    if status != 200:
        return text_result(f"Panel trả {status}: {payload.decode('utf-8', 'replace')}", True)
    return {
        "content": [
            {"type": "text", "text": f"Màn hình {serial} ({len(payload) // 1024} KB)"},
            {"type": "image",
             "data": base64.b64encode(payload).decode(),
             "mimeType": kind.split(";")[0] or "image/png"},
        ],
        "isError": False,
    }


def tool_match(args: dict) -> dict:
    """Đối chiếu màn hình hiện tại với profile — chẩn đoán vì sao route dừng."""
    serial = str(args.get("serial") or "").strip()
    if not serial:
        return text_result("Thiếu tham số serial.", True)
    status, payload, _ = panel_request(
        f"/api/profile/match?serial={urllib.parse.quote(serial)}", timeout=60
    )
    if status != 200:
        return text_result(f"Panel trả {status}: {payload.decode('utf-8', 'replace')}", True)
    data = json.loads(payload)
    lines = ["Khoảng cách Hamming đúng như CharacterSwitcher sẽ thấy lúc wait-screen:", ""]
    for screen in data.get("screens", []):
        mark = "✓" if screen["matched"] else "·"
        lines.append(f"  {mark} {screen['screen']:28} d={screen['worstDistance']}")
        for item in screen.get("fingerprints", []):
            if not item.get("ok"):
                lines.append(
                    f"      vùng {item['region']}: mong {item['expected']} "
                    f"thấy {item['actual']} (d={item['distance']} > {item['maxDistance']})"
                )
    return text_result("\n".join(lines))


def tool_logs(args: dict) -> dict:
    lines = int(args.get("lines") or 80)
    service = str(args.get("service") or "panel")
    code, output = run_ssh(
        f"cd {CONFIG.repo}/tools/rok-device-panel && "
        f"docker compose logs --tail={lines} --no-color {service}",
        timeout=60,
    )
    return text_result(output, code != 0)


def tool_deploy(_args: dict) -> dict:
    code, output = run_ssh(
        f"cd {CONFIG.repo} && git pull --ff-only && "
        f"cd tools/rok-device-panel && docker compose up -d --build && "
        f"sleep 5 && docker compose ps",
        timeout=900,
    )
    return text_result(output, code != 0)


def tool_panel_api(args: dict) -> dict:
    """Cửa thoát hiểm: gọi thẳng bất kỳ endpoint nào của panel."""
    path = str(args.get("path") or "").strip()
    if not path:
        return text_result("Thiếu tham số path.", True)
    status, payload, kind = panel_request(
        path, str(args.get("method") or "GET").upper(), args.get("body")
    )
    body = payload.decode("utf-8", "replace")
    if "json" in kind:
        try:
            body = json.dumps(json.loads(payload), ensure_ascii=False, indent=2)
        except json.JSONDecodeError:
            pass
    return text_result(f"HTTP {status}\n\n{body}", status >= 400 or status == 0)


TOOLS = [
    {
        "name": "rok_run",
        "description": (
            "Chạy một lệnh shell trên server ROK FAQ qua SSH và trả về đầu ra. "
            "Dùng cho mọi việc vận hành: git, docker, adb, xem file, kiểm tra tài nguyên."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Lệnh shell cần chạy."},
                "timeout": {"type": "integer", "description": "Giới hạn giây, mặc định 120."},
            },
            "required": ["command"],
        },
        "handler": tool_run,
    },
    {
        "name": "rok_devices",
        "description": (
            "Liệt kê toàn bộ điện thoại trong dàn kèm trạng thái ADB, pin, thời gian chụp, "
            "ứng dụng đang chạy và lỗi gần nhất."
        ),
        "inputSchema": {"type": "object", "properties": {}},
        "handler": tool_devices,
    },
    {
        "name": "rok_screen",
        "description": (
            "Lấy ảnh màn hình thật của một điện thoại và trả về dưới dạng hình ảnh, "
            "để nhìn được game đang hiển thị gì. Dùng khi hiệu chỉnh route hoặc chẩn đoán."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"serial": {"type": "string", "description": "Serial máy."}},
            "required": ["serial"],
        },
        "handler": tool_screen,
    },
    {
        "name": "rok_match",
        "description": (
            "Đối chiếu màn hình hiện tại của một máy với mọi dấu vân trong profile, "
            "trả về đúng khoảng cách Hamming mà CharacterSwitcher sẽ thấy lúc wait-screen. "
            "Dùng để biết vì sao một route dừng giữa chừng."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {"serial": {"type": "string", "description": "Serial máy."}},
            "required": ["serial"],
        },
        "handler": tool_match,
    },
    {
        "name": "rok_logs",
        "description": "Đọc log gần nhất của container panel trên server.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "lines": {"type": "integer", "description": "Số dòng, mặc định 80."},
                "service": {"type": "string", "description": "Tên service, mặc định panel."},
            },
        },
        "handler": tool_logs,
    },
    {
        "name": "rok_deploy",
        "description": (
            "Kéo code mới từ GitHub trên server rồi dựng lại container panel. "
            "Tương đương git pull + docker compose up -d --build."
        ),
        "inputSchema": {"type": "object", "properties": {}},
        "handler": tool_deploy,
    },
    {
        "name": "rok_panel_api",
        "description": (
            "Gọi thẳng một endpoint bất kỳ của panel. Dùng khi các công cụ trên chưa đủ."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Ví dụ /api/state"},
                "method": {"type": "string", "description": "GET hoặc POST, mặc định GET."},
                "body": {"type": "object", "description": "Thân JSON cho POST."},
            },
            "required": ["path"],
        },
        "handler": tool_panel_api,
    },
]

HANDLERS = {tool["name"]: tool["handler"] for tool in TOOLS}
TOOL_SPECS = [{k: v for k, v in tool.items() if k != "handler"} for tool in TOOLS]


# ---------------------------------------------------------------------------
# Giao thức MCP qua stdio: JSON-RPC 2.0, mỗi dòng một thông điệp
# ---------------------------------------------------------------------------


def respond(message_id, result=None, error=None) -> None:
    payload = {"jsonrpc": "2.0", "id": message_id}
    if error is not None:
        payload["error"] = error
    else:
        payload["result"] = result
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle(message: dict) -> None:
    method = message.get("method")
    message_id = message.get("id")
    params = message.get("params") or {}

    # Thông báo (không có id) thì không được trả lời.
    if message_id is None:
        return

    if method == "initialize":
        asked = str(params.get("protocolVersion") or "")
        version = asked if asked.count("-") == 2 else DEFAULT_PROTOCOL
        respond(message_id, {
            "protocolVersion": version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        })
    elif method == "tools/list":
        respond(message_id, {"tools": TOOL_SPECS})
    elif method == "tools/call":
        name = params.get("name")
        handler = HANDLERS.get(name)
        if handler is None:
            respond(message_id, error={"code": -32602, "message": f"Không có công cụ '{name}'"})
            return
        try:
            respond(message_id, handler(params.get("arguments") or {}))
        except Exception as exc:  # noqa: BLE001 - lỗi phải quay về Claude, không được làm chết server
            respond(message_id, text_result(f"Công cụ lỗi: {type(exc).__name__}: {exc}", True))
    elif method == "ping":
        respond(message_id, {})
    else:
        respond(message_id, error={"code": -32601, "message": f"Chưa hỗ trợ method '{method}'"})


def main() -> int:
    # Bắt buộc trên Windows. Console mặc định không dùng UTF-8 nên chữ tiếng Việt
    # trong kết quả sẽ hỏng, và stdout tự đổi \n thành \r\n — mà giao thức MCP
    # phân tách thông điệp bằng đúng ký tự xuống dòng, nên sẽ vỡ khung.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            continue
        try:
            handle(message)
        except Exception as exc:  # noqa: BLE001
            print(f"[rok-mcp] lỗi ngoài dự kiến: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
