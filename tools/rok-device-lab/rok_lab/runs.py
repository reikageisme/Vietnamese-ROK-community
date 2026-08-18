from __future__ import annotations

import json
import os
from contextlib import AbstractContextManager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Self

from .adb import AdbError


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_serial(serial: str) -> str:
    return "".join(
        character if character.isalnum() or character in "-_" else "_"
        for character in serial
    )


class DeviceLock(AbstractContextManager["DeviceLock"]):
    def __init__(self, root: Path, serial: str, operation: str) -> None:
        self.serial = serial
        self.operation = operation
        self.lock_path = root / "locks" / f"{safe_serial(serial)}.lock"
        self._lock_fd: int | None = None

    def __enter__(self) -> Self:
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self._lock_fd = os.open(
                self.lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY
            )
            os.write(
                self._lock_fd,
                f"pid={os.getpid()}\noperation={self.operation}\n".encode(),
            )
        except FileExistsError as exc:
            raise AdbError(
                f"Thiết bị {self.serial} đang có một tác vụ khác "
                f"(lock: {self.lock_path})."
            ) from exc
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> bool:
        if self._lock_fd is not None:
            os.close(self._lock_fd)
            self._lock_fd = None
        try:
            self.lock_path.unlink()
        except FileNotFoundError:
            pass
        return False


class DeviceRun(AbstractContextManager["DeviceRun"]):
    """Own one serial while creating an isolated, auditable run directory."""

    def __init__(self, root: Path, serial: str, operation: str) -> None:
        self.serial = serial
        self.operation = operation
        self.device_root = root / "runs" / safe_serial(serial)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        self.path = self.device_root / f"{timestamp}-{operation}"
        self._lock = DeviceLock(root, serial, operation)
        self.manifest: dict[str, Any] = {
            "schemaVersion": 1,
            "serial": serial,
            "operation": operation,
            "startedAt": utc_now(),
            "status": "running",
            "artifacts": [],
        }

    def __enter__(self) -> Self:
        self._lock.__enter__()
        self.path.mkdir(parents=True, exist_ok=False)
        self.write_manifest()
        return self

    def artifact(self, name: str) -> Path:
        path = self.path / name
        self.manifest["artifacts"].append(name)
        return path

    def write_manifest(self) -> None:
        self.path.mkdir(parents=True, exist_ok=True)
        temporary = self.path / "manifest.json.tmp"
        destination = self.path / "manifest.json"
        temporary.write_text(
            json.dumps(self.manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temporary.replace(destination)

    def finish(self, status: str = "complete", **values: Any) -> None:
        self.manifest.update(values)
        self.manifest["status"] = status
        self.manifest["finishedAt"] = utc_now()
        self.write_manifest()

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> bool:
        if exc is not None:
            self.finish("failed", error=str(exc))
        elif self.manifest["status"] == "running":
            self.finish()
        self._lock.__exit__(exc_type, exc, traceback)
        return False
