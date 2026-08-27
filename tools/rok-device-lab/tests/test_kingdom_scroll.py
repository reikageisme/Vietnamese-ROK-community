"""Kiem tra viec cuon danh sach va viec DEM NGUOI BI BO SOT.

Bai quan trong nhat o day la `test_overshoot_is_reported_not_hidden`.
Truoc day ban quet lay thu hang cao nhat NHIN THAY tren man hinh lam moc,
trong khi moi trang chi bam bon dong dau — hai dong duoi coi nhu da xong du
chua he bam vao. Hau qua: vuot lo mot dong moi trang thi mat bay nguoi trong
ba muoi, va bao cao van ghi "khong bo sot ai". Do la kieu hong nguy hiem
nhat vi ket qua trong van sach se.
"""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from rok_lab import kingdom_scanner as scanner_module
from rok_lab.kingdom_scanner import KingdomScanner, ScanOptions, _page_top_rank
from rok_lab.profiles import load_profile

PROFILE = Path(__file__).resolve().parents[1] / "profiles" / "rok-a51-1920x1080.json"


class FakeClient:
    def require_ready(self, serial):  # noqa: ANN001
        return None

    def shell(self, serial, *args, timeout=None):  # noqa: ANN001, ANN002
        return ""


class FakeKingdom:
    """Mot bang xep hang gia, cuon duoc, de do ban quet chu khong do OCR."""

    def __init__(self, scanner: KingdomScanner, drift_rows: float, blind_rows=()) -> None:
        self.scanner = scanner
        self.drift = drift_rows
        self.blind = set(blind_rows)
        self.top = 1.0
        self.pitch = scanner._row_pitch()
        self.scroll_backs = 0

    def scroll(self, client, serial, start, end, screen, kind, **kwargs):  # noqa: ANN001
        moved = (start[1] - end[1]) / self.pitch
        if moved > 0:
            self.top += moved + self.drift
        else:
            self.top += moved
            self.scroll_backs += 1
        self.top = max(1.0, self.top)
        return kind

    def hints(self, page: int):
        top = int(round(self.top))
        return [
            {
                "name": f"nguoi{top + index}",
                "rankFromScreen": None if index in self.blind else top + index,
            }
            for index in range(6)
        ]

    def open_governor(self, row: int, hint):  # noqa: ANN001
        self.scanner.attempted_rank += 1
        rank = hint["rankFromScreen"]
        return {
            "rank": rank,
            "rankFromScreen": rank,
            "attempt": self.scanner.attempted_rank,
            "governorId": str(100000 + rank),
            "name": hint["name"],
            "allianceTag": "",
            "allianceName": "",
            "killPoints": 0,
            "power": 0,
            "acclaim": 0,
            "highestAcclaim": 0,
            "ocrRaw": {},
        }


def run_scan(drift_rows=0.0, rows_per_page=4, amount=30, blind_rows=()):
    with TemporaryDirectory() as workspace:
        with (
            patch.object(scanner_module, "find_tesseract", lambda path=None: "tesseract"),
            patch.object(scanner_module, "find_tessdata", lambda a, b=None: Path(workspace)),
            patch.object(scanner_module, "available_languages", lambda path: ["eng"]),
            patch.object(scanner_module, "write_exports", lambda *a, **k: {}),
        ):
            scanner = KingdomScanner(
                FakeClient(),
                "SERIAL",
                load_profile(PROFILE),
                Path(workspace),
                ScanOptions(
                    kingdom=1,
                    amount=amount,
                    evidence="none",
                    rows_per_page=rows_per_page,
                    scroll_wait=0,
                ),
                confirmed=True,
            )
            scanner._touch_probed = True
            world = FakeKingdom(scanner, drift_rows, blind_rows)
            scanner._ensure_power_ranking = lambda: None
            scanner._read_ranking_hints = world.hints
            scanner._scan_governor = world.open_governor
            with patch.object(scanner_module, "perform_scroll", world.scroll):
                result = scanner.scan()
            ranks = [record["rank"] for record in scanner.records]
            skipped = sorted(set(range(1, max(ranks) + 1)) - set(ranks)) if ranks else []
            return result, ranks, skipped, world


class PageTopRankTest(unittest.TestCase):
    def test_takes_the_majority_vote_so_one_bad_row_cannot_shift_the_page(self) -> None:
        hints = [{"rankFromScreen": rank} for rank in (7, 8, 77, 10, 11, 12)]
        self.assertEqual(7, _page_top_rank(hints))

    def test_returns_none_when_nothing_was_read(self) -> None:
        self.assertIsNone(_page_top_rank([{"rankFromScreen": None}] * 6))


class ScrollDistanceTest(unittest.TestCase):
    def test_one_page_moves_exactly_rows_per_page_rows(self) -> None:
        calls = []
        with TemporaryDirectory() as workspace:
            with (
                patch.object(scanner_module, "find_tesseract", lambda path=None: "t"),
                patch.object(scanner_module, "find_tessdata", lambda a, b=None: Path(workspace)),
                patch.object(scanner_module, "available_languages", lambda path: ["eng"]),
            ):
                scanner = KingdomScanner(
                    FakeClient(),
                    "SERIAL",
                    load_profile(PROFILE),
                    Path(workspace),
                    ScanOptions(kingdom=1, amount=1, evidence="none", scroll_wait=0),
                    confirmed=True,
                )
            scanner._touch_probed = True
            def record(client, serial, start, end, screen, kind, **kwargs):  # noqa: ANN001
                calls.append((start, end))
                return kind
            with patch.object(scanner_module, "perform_scroll", record):
                scanner._scroll()
                pitch = scanner._row_pitch()
                self.assertEqual(round(pitch * 4), calls[0][0][1] - calls[0][1][1])

                calls.clear()
                scanner._scroll(rows=1, direction=-1)
                self.assertGreater(calls[0][1][1], calls[0][0][1])

    def test_a_long_scroll_is_split_so_the_finger_stays_on_the_list(self) -> None:
        with TemporaryDirectory() as workspace:
            with (
                patch.object(scanner_module, "find_tesseract", lambda path=None: "t"),
                patch.object(scanner_module, "find_tessdata", lambda a, b=None: Path(workspace)),
                patch.object(scanner_module, "available_languages", lambda path: ["eng"]),
            ):
                scanner = KingdomScanner(
                    FakeClient(),
                    "SERIAL",
                    load_profile(PROFILE),
                    Path(workspace),
                    ScanOptions(
                        kingdom=1, amount=1, evidence="none", rows_per_page=9, scroll_wait=0
                    ),
                    confirmed=True,
                )
            scanner._touch_probed = True
            calls = []
            def record(client, serial, start, end, screen, kind, **kwargs):  # noqa: ANN001
                calls.append((start, end))
                return kind
            with patch.object(scanner_module, "perform_scroll", record):
                scanner._scroll()
            profile = load_profile(PROFILE)
            size = profile.reference_resolution
            top = profile.point("ranking.row1", size)[1]
            bottom = profile.point("ranking.row6", size)[1]
            self.assertEqual(2, len(calls))
            self.assertEqual(
                round(scanner._row_pitch() * 9),
                sum(start[1] - end[1] for start, end in calls),
            )
            for start, end in calls:
                for point in (start, end):
                    self.assertGreaterEqual(point[1], top - 80)
                    self.assertLessEqual(point[1], bottom + 80)


class CoverageAccountingTest(unittest.TestCase):
    def test_a_clean_scroll_misses_nobody(self) -> None:
        result, ranks, skipped, _ = run_scan(drift_rows=0.0)
        self.assertEqual(list(range(1, 31)), ranks)
        self.assertEqual([], skipped)
        self.assertEqual(0, result["ranksMissing"])

    def test_undershooting_only_overlaps_and_duplicates_are_dropped(self) -> None:
        result, ranks, skipped, _ = run_scan(drift_rows=-1.0)
        self.assertEqual([], skipped)
        self.assertEqual(0, result["ranksMissing"])
        self.assertEqual(len(set(ranks)), len(ranks))

    def test_a_small_overshoot_is_pulled_back_instead_of_losing_people(self) -> None:
        result, _ranks, skipped, world = run_scan(drift_rows=2.0)
        self.assertEqual([], skipped)
        self.assertEqual(0, result["ranksMissing"])
        self.assertGreater(world.scroll_backs, 0)

    def test_overshoot_is_reported_not_hidden(self) -> None:
        # Vuot lo qua xa de lui lai khong kip. Khong doi ban quet cuu duoc, chi
        # doi no BAO DUNG so nguoi da mat — bao cao sai con te hon quet thieu.
        result, _ranks, skipped, _ = run_scan(drift_rows=8.0)
        self.assertGreater(len(skipped), 0)
        self.assertEqual(len(skipped), result["ranksMissing"])

    def test_rank_ocr_failing_on_most_rows_does_not_break_the_count(self) -> None:
        result, _ranks, skipped, _ = run_scan(blind_rows=(0, 1, 2, 3, 4))
        self.assertEqual([], skipped)
        self.assertEqual(0, result["ranksMissing"])


if __name__ == "__main__":
    unittest.main()
