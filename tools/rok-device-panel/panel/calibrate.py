"""Hiệu chỉnh profile trực tiếp từ trình duyệt.

Đây là lý do chính khiến panel này đáng tồn tại. ``CharacterSwitcher`` từ chối chạy
nếu thiếu fingerprint, nên mọi màn hình mới — nhất là bản đồ KvK — đều phải hiệu
chỉnh tay. Trước đây việc đó là: chụp ảnh, mở trình sửa ảnh, đo pixel, chia thủ công
cho chiều rộng, tự tính dhash. Ở đây chỉ là bấm và kéo.

Điểm sống còn: dhash và toạ độ sinh ra phải khớp *tuyệt đối* với thứ ``rok_lab`` tính
lúc chạy thật. Vì vậy module này dùng lại chính ``difference_hash`` của rok_lab và
lặp lại đúng công thức crop của ``fingerprint_image``.
"""

from __future__ import annotations

import io
import json
import threading
from pathlib import Path
from typing import Any

from PIL import Image
from rok_lab.imaging import difference_hash, hamming_distance

Region = tuple[float, float, float, float]

DEFAULT_MAX_DISTANCE = 8


def _crop_box(size: tuple[int, int], region: Region) -> tuple[int, int, int, int]:
    """Bản sao chính xác công thức trong ``rok_lab.imaging.fingerprint_image``."""
    width, height = size
    x, y, region_width, region_height = region
    return (
        round(x * width),
        round(y * height),
        round((x + region_width) * width),
        round((y + region_height) * height),
    )


def fingerprint_png(png: bytes, region: Region) -> str:
    """Tính dhash của một vùng chuẩn hoá, giống hệt lúc agent chạy thật."""
    with Image.open(io.BytesIO(png)) as image:
        image.load()
        return difference_hash(image.crop(_crop_box(image.size, region)))


def crop_png(png: bytes, region: Region, *, max_width: int = 480) -> bytes:
    """Trích vùng đã chọn thành PNG để người dùng xem lại trước khi lưu."""
    with Image.open(io.BytesIO(png)) as image:
        image.load()
        cropped = image.crop(_crop_box(image.size, region))
        if cropped.width > max_width:
            height = max(1, round(cropped.height * max_width / cropped.width))
            cropped = cropped.resize((max_width, height), Image.LANCZOS)
        if cropped.mode not in ("RGB", "L"):
            cropped = cropped.convert("RGB")
        buffer = io.BytesIO()
        cropped.save(buffer, format="PNG")
        return buffer.getvalue()


def _round(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def normalize_region(x: float, y: float, width: float, height: float) -> Region:
    """Ép vùng nằm gọn trong [0,1] — ``load_profile`` sẽ từ chối nếu tràn."""
    left = _clamp01(min(x, x + width))
    top = _clamp01(min(y, y + height))
    right = _clamp01(max(x, x + width))
    bottom = _clamp01(max(y, y + height))
    return (
        _round(left),
        _round(top),
        _round(min(right - left, 1.0 - left)),
        _round(min(bottom - top, 1.0 - top)),
    )


class ProfileStore:
    """Giữ một *bản làm việc* của profile.

    Không bao giờ ghi thẳng vào profile gốc đã hiệu chỉnh của bạn. Mọi thay đổi vào
    bản làm việc; muốn áp dụng thì phải bấm nút riêng có xác nhận.
    """

    def __init__(self, source: Path, working: Path) -> None:
        self.source = source
        self.working = working
        self._lock = threading.RLock()
        self._document: dict[str, Any] = {}
        self.reload()

    # ---------- nạp và lưu ----------

    def _blank(self) -> dict[str, Any]:
        return {
            "schemaVersion": 1,
            "name": "Profile mới",
            "gamePackage": "com.rok.gp.vn",
            "referenceResolution": [1920, 1080],
            "taps": {},
            "regions": {},
            "screens": {},
        }

    def reload(self) -> dict[str, Any]:
        with self._lock:
            path = self.working if self.working.exists() else self.source
            try:
                self._document = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                self._document = self._blank()
            for key in ("taps", "regions", "screens"):
                self._document.setdefault(key, {})
            return self._document

    def reset_from_source(self) -> dict[str, Any]:
        with self._lock:
            if self.working.exists():
                self.working.unlink()
            return self.reload()

    def _persist(self) -> None:
        self.working.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.working.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(self._document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(self.working)

    def document(self) -> dict[str, Any]:
        with self._lock:
            return json.loads(json.dumps(self._document))

    def as_text(self) -> str:
        with self._lock:
            return json.dumps(self._document, ensure_ascii=False, indent=2) + "\n"

    def apply_to_source(self) -> Path:
        """Ghi bản làm việc đè lên profile gốc, có sao lưu bản cũ."""
        with self._lock:
            if self.source.exists():
                backup = self.source.with_suffix(self.source.suffix + ".bak")
                backup.write_bytes(self.source.read_bytes())
            self.source.write_text(self.as_text(), encoding="utf-8")
            return self.source

    # ---------- chỉnh sửa ----------

    def set_point(self, name: str, x: float, y: float) -> dict[str, Any]:
        with self._lock:
            self._document["taps"][name] = [_round(_clamp01(x)), _round(_clamp01(y))]
            self._persist()
            return {"name": name, "point": self._document["taps"][name]}

    def set_region(self, name: str, region: Region) -> dict[str, Any]:
        with self._lock:
            self._document["regions"][name] = list(region)
            self._persist()
            return {"name": name, "region": list(region)}

    def set_fingerprint(
        self, screen: str, region: Region, dhash: str, max_distance: int, replace: bool
    ) -> dict[str, Any]:
        with self._lock:
            screens = self._document["screens"]
            entry = screens.setdefault(screen, {"fingerprints": []})
            fingerprint = {
                "region": list(region),
                "dhash": dhash,
                "maxDistance": int(max_distance),
            }
            if replace:
                entry["fingerprints"] = [fingerprint]
            else:
                entry["fingerprints"].append(fingerprint)
            self._persist()
            return {"screen": screen, "fingerprints": entry["fingerprints"]}

    def delete(self, kind: str, name: str, index: int | None = None) -> bool:
        with self._lock:
            if kind == "screen" and index is not None:
                entry = self._document["screens"].get(name)
                if not entry or index >= len(entry["fingerprints"]):
                    return False
                entry["fingerprints"].pop(index)
                if not entry["fingerprints"]:
                    self._document["screens"].pop(name, None)
                self._persist()
                return True
            bucket = {"tap": "taps", "region": "regions", "screen": "screens"}.get(kind)
            if not bucket or name not in self._document[bucket]:
                return False
            self._document[bucket].pop(name)
            self._persist()
            return True

    # ---------- đối chiếu ----------

    def match(self, png: bytes) -> list[dict[str, Any]]:
        """So khung hình hiện tại với mọi màn hình trong profile.

        Trả về đúng khoảng cách Hamming mà ``CharacterSwitcher._wait_screen`` sẽ thấy,
        nên bạn biết ngay route sẽ đi qua hay dừng.
        """
        document = self.document()
        results: list[dict[str, Any]] = []
        with Image.open(io.BytesIO(png)) as image:
            image.load()
            size = image.size
            for screen, entry in document.get("screens", {}).items():
                fingerprints = entry.get("fingerprints") or []
                comparisons = []
                matched = bool(fingerprints)
                worst = 0
                for fingerprint in fingerprints:
                    region = tuple(float(item) for item in fingerprint["region"])
                    try:
                        actual = difference_hash(image.crop(_crop_box(size, region)))
                        distance = hamming_distance(actual, str(fingerprint["dhash"]).lower())
                    except (ValueError, OSError):
                        actual, distance = "", 64
                    limit = int(fingerprint.get("maxDistance", DEFAULT_MAX_DISTANCE))
                    comparisons.append(
                        {
                            "region": list(region),
                            "expected": fingerprint["dhash"],
                            "actual": actual,
                            "distance": distance,
                            "maxDistance": limit,
                            "ok": distance <= limit,
                        }
                    )
                    worst = max(worst, distance)
                    matched = matched and distance <= limit
                results.append(
                    {
                        "screen": screen,
                        "matched": matched,
                        "worstDistance": worst,
                        "fingerprints": comparisons,
                    }
                )
        results.sort(key=lambda item: (not item["matched"], item["worstDistance"]))
        return results
