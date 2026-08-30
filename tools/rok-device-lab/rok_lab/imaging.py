from __future__ import annotations

from pathlib import Path

from PIL import Image

from .profiles import ScreenFingerprint


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def row_grid_offset(
    path: Path,
    *,
    expected_top: int,
    pitch: int,
    rows: int = 6,
    gap: int = 20,
    columns: tuple[float, float] = (0.22, 0.80),
    min_contrast: int = 15,
) -> int | None:
    """Luoi dong dang nam lech bao nhieu pixel so voi cho profile mong doi.

    Danh sach ROK dung lai o dau la tuy quan tinh; no gan nhu khong bao gio
    dung dung vach. Do la ly do o cat thu hang doc duoc luc duoc luc khong:
    lech 40px tren mot o cao 56px la cat doi con so, va lech bao nhieu thi
    moi lan vuot moi khac.

    Nhung cac dong cach nhau DEU DAN va giua hai dong co mot khe toi, nen
    chi can tim PHA cua khe do la biet ca luoi dang lech bao nhieu. Biet roi
    thi khong can vuot chinh xac nua — cat va bam deu dich theo do lech.

    Tra ve so pixel: am la danh sach dang nam CAO hon cho mong doi. Tra ve
    None khi anh khong co van dong ro rang de tin (dang o mot man khac, hay
    danh sach trong).
    """
    with Image.open(path) as image:
        width, height = image.size
        column = (
            image.convert("L")
            .crop((round(width * columns[0]), 0, round(width * columns[1]), height))
            .resize((1, height))
        )
        brightness = [column.getpixel((0, y)) for y in range(height)]

    area = range(max(0, expected_top), min(height, expected_top + pitch * rows))
    if pitch < 4 or len(area) < pitch * 2:
        return None

    def darkness(offset: int) -> float:
        band = [brightness[y] for y in area if (y - offset) % pitch < gap]
        return sum(band) / len(band) if band else 255.0

    scores = [darkness(offset) for offset in range(pitch)]
    if max(scores) - min(scores) < min_contrast:
        return None
    top = scores.index(min(scores)) + gap
    # Pha chi cho biet lech trong MOT nhip; keo ve nhip gan expected_top nhat.
    top += pitch * round((expected_top - top) / pitch)
    return top - expected_top


def difference_hash(image: Image.Image, hash_size: int = 8) -> str:
    grayscale = image.convert("L").resize((hash_size + 1, hash_size))
    pixels = [
        grayscale.getpixel((column, row))
        for row in range(hash_size)
        for column in range(hash_size + 1)
    ]
    bits = []
    row_width = hash_size + 1
    for row in range(hash_size):
        offset = row * row_width
        for column in range(hash_size):
            bits.append(pixels[offset + column] > pixels[offset + column + 1])
    value = sum(1 << index for index, bit in enumerate(bits) if bit)
    return f"{value:0{hash_size * hash_size // 4}x}"


def hamming_distance(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def fingerprint_image(path: Path, region: tuple[float, float, float, float]) -> str:
    with Image.open(path) as image:
        width, height = image.size
        x, y, region_width, region_height = region
        box = (
            round(x * width),
            round(y * height),
            round((x + region_width) * width),
            round((y + region_height) * height),
        )
        return difference_hash(image.crop(box))


def match_fingerprints(
    path: Path, fingerprints: tuple[ScreenFingerprint, ...]
) -> tuple[bool, list[dict[str, int | str]]]:
    comparisons: list[dict[str, int | str]] = []
    matched = bool(fingerprints)
    for fingerprint in fingerprints:
        actual = fingerprint_image(path, fingerprint.region)
        distance = hamming_distance(actual, fingerprint.dhash)
        comparisons.append(
            {
                "expected": fingerprint.dhash,
                "actual": actual,
                "distance": distance,
                "maxDistance": fingerprint.max_distance,
            }
        )
        matched = matched and distance <= fingerprint.max_distance
    return matched, comparisons
