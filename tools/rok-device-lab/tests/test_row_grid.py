"""Do do lech cua luoi dong.

Bai nay ton tai vi mot ban quet doc sai vi tri KHONG bao loi: no chi tra ve
"khong doc duoc thu hang", roi bo qua nguoi do va di tiep. Tren may that,
hai anh chup cach nhau ba lan vuot cho ra hai do lech khac han nhau (+1px
va -44px) — nen phai do lai sau moi lan chup, va phep do phai dung.
"""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

from rok_lab.imaging import row_grid_offset

PITCH, BAND, GAP = 120, 100, 20
EXPECTED_TOP = 290


def ranking_screenshot(directory: Path, top: int) -> Path:
    """Mot bang xep hang gia: dai sang cao 100px, khe toi 20px, lap lai."""
    image = Image.new("L", (1920, 1080), 60)
    for index in range(6):
        start = top + PITCH * index
        for y in range(start, min(1080, start + BAND)):
            for x in range(round(1920 * 0.20), round(1920 * 0.82)):
                image.putpixel((x, y), 160)
    path = directory / f"top-{top}.png"
    image.save(path)
    return path


class RowGridOffsetTest(unittest.TestCase):
    def test_reads_zero_when_the_list_sits_on_the_grid(self) -> None:
        with TemporaryDirectory() as workspace:
            path = ranking_screenshot(Path(workspace), EXPECTED_TOP)
            offset = row_grid_offset(path, expected_top=EXPECTED_TOP, pitch=PITCH)
        self.assertIsNotNone(offset)
        self.assertLessEqual(abs(offset), 2)

    def test_reads_the_real_shift_seen_on_the_phone(self) -> None:
        # -44px la con so do duoc tren page-0006.png cua may 09.
        for shift in (-44, -12, 17, 38):
            with self.subTest(shift=shift), TemporaryDirectory() as workspace:
                path = ranking_screenshot(Path(workspace), EXPECTED_TOP + shift)
                offset = row_grid_offset(path, expected_top=EXPECTED_TOP, pitch=PITCH)
                self.assertIsNotNone(offset)
                self.assertLessEqual(abs(offset - shift), 2, f"do ra {offset}")

    def test_says_None_instead_of_guessing_on_a_blank_screen(self) -> None:
        # Man phang li thi khong co van dong nao de bam vao. Doan bua o day la
        # dich ca o cat lan cu bam di mot cho ngau nhien — im lang con hon.
        with TemporaryDirectory() as workspace:
            path = Path(workspace) / "blank.png"
            Image.new("L", (1920, 1080), 120).save(path)
            self.assertIsNone(
                row_grid_offset(path, expected_top=EXPECTED_TOP, pitch=PITCH)
            )


if __name__ == "__main__":
    unittest.main()
