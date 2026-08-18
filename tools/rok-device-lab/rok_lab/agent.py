from __future__ import annotations

import json
import platform
import socket
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from typing import Any

from .adb import AdbClient, AdbError, resolve_device
from .character_switcher import CharacterSwitcher
from .collector import upload_scan
from .control_client import ControlClient
from .kingdom_scanner import KingdomScanner, ScanOptions
from .profiles import DeviceProfile
from .ranking_scanner import RankingScanner, RankingScanOptions

AGENT_VERSION = "0.4.0"


class DeviceAgent:
    def __init__(
        self,
        client: AdbClient,
        control: ControlClient,
        profile: DeviceProfile,
        artifacts: Path,
        config: dict[str, Any],
        aliases: dict[str, str],
        *,
        tesseract_path: str | None = None,
        tessdata_path: str | None = None,
    ) -> None:
        self.client = client
        self.control = control
        self.profile = profile
        self.artifacts = artifacts
        self.config = config
        self.aliases = aliases
        self.agent_id = str(config["agentId"])
        self.name = str(config.get("name", self.agent_id))
        self.poll_seconds = max(2, int(config.get("pollSeconds", 5)))
        self.tesseract_path = tesseract_path
        self.tessdata_path = tessdata_path
        self.targets = [
            (
                str(item.get("alias", item["device"])),
                resolve_device(str(item["device"]), aliases),
            )
            for item in config["devices"]
        ]
        # Không tin trạng thái character do file cấu hình tự khai báo. Map này chỉ
        # được cập nhật sau khi route có fingerprint guard chạy thành công.
        self.current_characters: dict[str, str] = {}
        self.active: dict[str, Future[None]] = {}
        self.lock = threading.Lock()

    def _device_payload(self, alias: str, serial: str) -> dict[str, Any]:
        active = serial in self.active and not self.active[serial].done()
        try:
            info = self.client.inspect(serial)
            return {
                "serial": serial,
                "alias": alias,
                "model": info.get("model"),
                "adbState": info.get("state"),
                "resolution": info.get("resolution"),
                "batteryPercent": int(info["battery_percent"])
                if info.get("battery_percent")
                else None,
                "status": "BUSY" if active else "READY",
                "currentCharacterKey": self.current_characters.get(serial),
                "error": None,
            }
        except (AdbError, ValueError) as exc:
            return {
                "serial": serial,
                "alias": alias,
                "status": "OFFLINE",
                "currentCharacterKey": self.current_characters.get(serial),
                "error": str(exc),
            }

    def heartbeat(self) -> None:
        devices = [
            self._device_payload(alias, serial) for alias, serial in self.targets
        ]
        self.control.heartbeat(
            {
                "agentId": self.agent_id,
                "name": self.name,
                "hostname": socket.gethostname(),
                "version": AGENT_VERSION,
                "capabilities": {
                    "platform": platform.platform(),
                    "workers": len(self.targets),
                    "scanners": [
                        "KINGDOM_FULL",
                        "RANKING_SEED",
                        "RANKING_ALLIANCE",
                        "RANKING_HONOR",
                    ],
                },
                "devices": devices,
            }
        )

    def _event(self, job_id: str, serial: str, status: str, **values: Any) -> None:
        self.control.event(
            job_id,
            {"agentId": self.agent_id, "serial": serial, "status": status, **values},
        )

    def _progress(self, job_id: str, serial: str):
        last_sent = 0.0

        def report(event: dict[str, Any]) -> None:
            nonlocal last_sent
            now = time.monotonic()
            if now - last_sent >= 5:
                last_sent = now
                try:
                    self._event(job_id, serial, "SCANNING", progress=event)
                except AdbError:
                    pass

        return report

    def _run_job(self, serial: str, payload: dict[str, Any]) -> None:
        job = payload["job"]
        job_id = str(job["id"])
        character = job.get("character")
        try:
            if not character:
                raise AdbError("Job không có character phù hợp.")
            self._event(
                job_id,
                serial,
                "SWITCHING",
                progress={"character": character["key"]},
            )
            switcher = CharacterSwitcher(self.client, serial, self.profile)
            # Chạy route chọn character ở mọi job để trạng thái bắt đầu luôn xác định,
            # kể cả khi job trước để game ở cuối một danh sách đã cuộn.
            switcher.execute(character["switchRoute"])
            self.current_characters[serial] = str(character["key"])

            job_type = str(job["type"])
            scan_route = character.get("scanRoutes", {}).get(job_type)
            if not scan_route:
                raise AdbError(
                    f"Character {character['key']} chưa có scanRoute cho {job_type}."
                )
            switcher.execute(scan_route)

            self._event(
                job_id,
                serial,
                "SCANNING",
                progress={"records": 0, "target": job["amount"]},
            )
            progress = self._progress(job_id, serial)
            if job_type == "KINGDOM_FULL":
                result = KingdomScanner(
                    self.client,
                    serial,
                    self.profile,
                    self.artifacts,
                    ScanOptions(
                        kingdom=int(job["kingdomNumber"]),
                        amount=int(job["amount"]),
                        scan_name=str(job["scanName"]),
                        formats={"xlsx", "csv", "jsonl"},
                        evidence="review",
                    ),
                    confirmed=True,
                    tesseract_path=self.tesseract_path,
                    tessdata_path=self.tessdata_path,
                    progress=progress,
                ).scan()
                self._event(
                    job_id, serial, "UPLOADING", progress={"records": result["records"]}
                )
                upload = upload_scan(Path(str(result["exports"]["json"])))
                self._event(
                    job_id,
                    serial,
                    "COMPLETED",
                    result={"scan": result, "upload": upload},
                    collectorBatchId=upload.get("batchId"),
                )
            elif job_type in {"RANKING_SEED", "RANKING_ALLIANCE", "RANKING_HONOR"}:
                ranking_type = {
                    "RANKING_SEED": "seed",
                    "RANKING_ALLIANCE": "alliance",
                    "RANKING_HONOR": "honor",
                }[job_type]
                result = RankingScanner(
                    self.client,
                    serial,
                    self.profile,
                    self.artifacts,
                    RankingScanOptions(
                        ranking_type=ranking_type,
                        amount=int(job["amount"]),
                        scan_name=str(job["scanName"]),
                        formats={"xlsx", "csv", "jsonl"},
                        evidence="review",
                    ),  # type: ignore[arg-type]
                    confirmed=True,
                    tesseract_path=self.tesseract_path,
                    tessdata_path=self.tessdata_path,
                    progress=progress,
                ).scan()
                ranking_document = json.loads(
                    Path(str(result["exports"]["json"])).read_text(encoding="utf-8")
                )
                for row in ranking_document.get("records", []):
                    row.pop("evidenceImage", None)
                    row.pop("scoreRaw", None)
                self._event(
                    job_id,
                    serial,
                    "COMPLETED",
                    result={
                        "summary": {
                            "records": result["records"],
                            "reviewRequired": result["reviewRequired"],
                            "reachedBottom": result["reachedBottom"],
                        },
                        "ranking": ranking_document,
                    },
                )
            else:
                raise AdbError(
                    "KVK_DISCOVERY cần adapter bản đồ đã hiệu chỉnh; job được dừng an toàn."
                )
        except (
            AdbError,
            OSError,
            RuntimeError,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            try:
                self._event(job_id, serial, "FAILED", error=str(exc))
            except AdbError:
                pass
        finally:
            with self.lock:
                self.active.pop(serial, None)

    def run_forever(self) -> None:
        print(
            f"Device agent {self.agent_id} đang chạy cho {len(self.targets)} thiết bị."
        )
        with ThreadPoolExecutor(
            max_workers=min(8, len(self.targets)), thread_name_prefix="rok-agent"
        ) as pool:
            last_heartbeat = 0.0
            while True:
                now = time.monotonic()
                if now - last_heartbeat >= 15:
                    try:
                        self.heartbeat()
                    except AdbError as exc:
                        print(f"Heartbeat lỗi: {exc}")
                    last_heartbeat = now
                for _, serial in self.targets:
                    with self.lock:
                        busy = serial in self.active
                    if busy:
                        continue
                    try:
                        payload = self.control.claim(self.agent_id, serial)
                    except AdbError as exc:
                        print(f"Claim {serial} lỗi: {exc}")
                        continue
                    if payload:
                        with self.lock:
                            self.active[serial] = pool.submit(
                                self._run_job, serial, payload
                            )
                time.sleep(self.poll_seconds)
