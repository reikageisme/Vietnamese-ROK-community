from __future__ import annotations

from pathlib import Path

from PIL import Image

from .profiles import ScreenFingerprint


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


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
