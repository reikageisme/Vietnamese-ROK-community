from __future__ import annotations

import json
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from .adb import AdbClient, AdbError, resolve_device
from .kingdom_scanner import KingdomScanner, ScanOptions
from .profiles import DeviceProfile


def load_fleet_job(path: Path) -> dict[str, Any]:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AdbError(f"Không đọc được fleet job {path}: {exc}") from exc
    if not isinstance(document.get("devices"), list) or not document["devices"]:
        raise AdbError("Fleet job phải có mảng devices không rỗng.")
    return document


def run_fleet_job(
    client: AdbClient,
    profile: DeviceProfile,
    artifacts_root: Path,
    aliases: dict[str, str],
    document: dict[str, Any],
    *,
    confirmed: bool,
    workers: int | None = None,
    tesseract_path: str | None = None,
    tessdata_path: str | None = None,
    progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    if not confirmed:
        raise AdbError(
            "Fleet scan bị chặn. Thêm --confirm để cho phép điều hướng game."
        )
    defaults = document.get("defaults", {})
    targets: list[tuple[str, ScanOptions]] = []
    for raw_target in document["devices"]:
        if not isinstance(raw_target, dict):
            raise AdbError("Mỗi phần tử devices phải là object.")
        merged = {**defaults, **raw_target}
        if "device" not in merged or "kingdom" not in merged:
            raise AdbError("Mỗi device cần có device và kingdom.")
        serial = resolve_device(str(merged["device"]), aliases)
        formats = {
            str(item) for item in merged.get("formats", ["xlsx", "csv", "jsonl"])
        }
        if not formats <= {"xlsx", "csv", "jsonl"}:
            raise AdbError("formats chỉ hỗ trợ xlsx, csv, jsonl.")
        targets.append(
            (
                serial,
                ScanOptions(
                    kingdom=int(merged["kingdom"]),
                    amount=int(merged.get("amount", 300)),
                    scan_name=str(
                        merged.get("scanName", document.get("jobId", "fleet"))
                    ),
                    formats=formats,
                    evidence=str(merged.get("evidence", "review")),
                ),
            )
        )

    serials = [serial for serial, _ in targets]
    if len(serials) != len(set(serials)):
        raise AdbError(
            "Fleet job có serial trùng; mỗi điện thoại chỉ được xuất hiện một lần."
        )
    worker_count = max(
        1, min(workers or int(document.get("workers", 2)), len(targets), 8)
    )
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(
        max_workers=worker_count, thread_name_prefix="rok-scan"
    ) as pool:
        futures = {
            pool.submit(
                KingdomScanner(
                    client,
                    serial,
                    profile,
                    artifacts_root,
                    options,
                    confirmed=True,
                    tesseract_path=tesseract_path,
                    tessdata_path=tessdata_path,
                    progress=progress,
                ).scan
            ): serial
            for serial, options in targets
        }
        for future in as_completed(futures):
            serial = futures[future]
            try:
                results.append(future.result())
            except (AdbError, OSError, RuntimeError, ValueError) as exc:
                results.append(
                    {
                        "ok": False,
                        "status": "failed",
                        "serial": serial,
                        "error": str(exc),
                    }
                )
    return {
        "ok": all(result.get("ok") for result in results),
        "workers": worker_count,
        "devices": results,
    }
