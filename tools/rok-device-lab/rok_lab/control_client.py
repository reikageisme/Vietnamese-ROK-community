from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .adb import AdbError


class ControlClient:
    def __init__(self, base_url: str | None = None, token: str | None = None) -> None:
        self.base_url = (base_url or os.environ.get("ROK_CONTROL_URL") or "").rstrip(
            "/"
        )
        self.token = token or os.environ.get("ROK_DEVICE_AGENT_TOKEN") or ""
        if not self.base_url:
            raise AdbError("Thiếu ROK_CONTROL_URL (ví dụ http://127.0.0.1:3031).")
        if len(self.token) < 32:
            raise AdbError("Thiếu ROK_DEVICE_AGENT_TOKEN hợp lệ (tối thiểu 32 ký tự).")

    def _request(
        self, method: str, path: str, body: dict[str, Any]
    ) -> dict[str, Any] | None:
        request = urllib.request.Request(
            self.base_url + path,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "User-Agent": "RokViet-Device-Agent/0.4",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status == 204:
                    return None
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise AdbError(f"Control API HTTP {exc.code}: {detail[:800]}") from exc
        except urllib.error.URLError as exc:
            raise AdbError(f"Không kết nối được Control API: {exc.reason}") from exc

    def heartbeat(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        return self._request("POST", "/api/agent/v1/heartbeat", payload)

    def claim(self, agent_id: str, serial: str) -> dict[str, Any] | None:
        return self._request(
            "POST", "/api/agent/v1/jobs/claim", {"agentId": agent_id, "serial": serial}
        )

    def event(self, job_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        return self._request("POST", f"/api/agent/v1/jobs/{job_id}/events", payload)


def load_agent_config(path: Path) -> dict[str, Any]:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AdbError(f"Không đọc được agent config {path}: {exc}") from exc
    if not isinstance(document.get("agentId"), str) or not document["agentId"]:
        raise AdbError("Agent config thiếu agentId.")
    if not isinstance(document.get("devices"), list) or not document["devices"]:
        raise AdbError("Agent config cần mảng devices.")
    return document
