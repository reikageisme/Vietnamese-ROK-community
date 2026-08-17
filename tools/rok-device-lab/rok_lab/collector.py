from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from .adb import AdbError


def upload_scan(
    source: Path,
    *,
    api_url: str | None = None,
    token: str | None = None,
    timeout: float = 90,
) -> dict[str, object]:
    endpoint = api_url or os.environ.get("ROK_COLLECTOR_URL")
    secret = token or os.environ.get("ROK_COLLECTOR_TOKEN")
    if not endpoint:
        raise AdbError("Thiếu ROK_COLLECTOR_URL.")
    if not secret or len(secret) < 24:
        raise AdbError("Thiếu ROK_COLLECTOR_TOKEN hợp lệ (tối thiểu 24 ký tự).")
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AdbError(f"Không đọc được scan JSON: {exc}") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
        raise AdbError("Scan JSON phải chứa object và mảng records.")
    if not payload["records"] or len(payload["records"]) > 500:
        raise AdbError("Mỗi batch phải có 1–500 records.")

    request = urllib.request.Request(
        endpoint.rstrip("/") + "/api/collector/v1/scans",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
            "User-Agent": "RokViet-Device-Lab/0.1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise AdbError(f"Collector API trả HTTP {exc.code}: {detail[:500]}") from exc
    except urllib.error.URLError as exc:
        raise AdbError(f"Không kết nối được Collector API: {exc.reason}") from exc
