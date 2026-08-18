from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from .adb import AdbClient, AdbError, resolve_device
from .profiles import DeviceProfile
from .ranking_scanner import MODES, RankingScanner, RankingScanOptions


def run_fleet_ranking_job(
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
        raise AdbError("Fleet ranking scan bị chặn. Thêm --confirm để cho phép cuộn.")
    defaults = document.get("defaults", {})
    targets: list[tuple[str, RankingScanOptions]] = []
    for raw_target in document["devices"]:
        if not isinstance(raw_target, dict):
            raise AdbError("Mỗi phần tử devices phải là object.")
        merged = {**defaults, **raw_target}
        if "device" not in merged or "rankingType" not in merged:
            raise AdbError("Mỗi device cần có device và rankingType.")
        ranking_type = str(merged["rankingType"])
        if ranking_type not in MODES:
            raise AdbError("rankingType chỉ hỗ trợ alliance, honor, seed.")
        formats = {
            str(item) for item in merged.get("formats", ["xlsx", "csv", "jsonl"])
        }
        if not formats <= {"xlsx", "csv", "jsonl"}:
            raise AdbError("formats chỉ hỗ trợ xlsx, csv, jsonl.")
        targets.append(
            (
                resolve_device(str(merged["device"]), aliases),
                RankingScanOptions(
                    ranking_type=ranking_type,  # type: ignore[arg-type]
                    amount=int(merged.get("amount", 100)),
                    scan_name=str(
                        merged.get("scanName", document.get("jobId", "fleet-ranking"))
                    ),
                    formats=formats,
                    evidence=str(merged.get("evidence", "all")),  # type: ignore[arg-type]
                ),
            )
        )
    serials = [serial for serial, _ in targets]
    if len(serials) != len(set(serials)):
        raise AdbError("Fleet job có serial trùng; mỗi điện thoại chỉ chạy một tác vụ.")
    worker_count = max(
        1, min(workers or int(document.get("workers", 2)), len(targets), 8)
    )
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(
        max_workers=worker_count, thread_name_prefix="rok-ranking"
    ) as pool:
        futures = {
            pool.submit(
                RankingScanner(
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
                results.append({"ok": False, "serial": serial, "error": str(exc)})
    return {
        "ok": all(result.get("ok") for result in results),
        "workers": worker_count,
        "devices": results,
    }
