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

    def __init__(
        self,
        scanner: KingdomScanner,
        drift_rows: float,
        blind_rows=(),
        deaf_ranks=(),
        frozen_after=None,
    ) -> None:
        self.scanner = scanner
        self.drift = drift_rows
        self.blind = set(blind_rows)
        # Nhung thu hang ma cu bam khong mo duoc ho so.
        self.deaf = set(deaf_ranks)
        # Vuot khong con an nua ke tu thu hang nay. Do la dieu da xay ra tren
        # may 09: page-0002 den page-0014 giong het nhau.
        self.frozen_after = frozen_after
        self.top = 1.0
        self.pitch = scanner._row_pitch()
        self.scroll_backs = 0

    def scroll(self, client, serial, start, end, screen, kind, **kwargs):  # noqa: ANN001
        if self.frozen_after is not None and self.top >= self.frozen_after:
            return kind
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
        if rank in self.deaf:
            return None
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


def run_scan(
    drift_rows=0.0,
    rows_per_page=4,
    amount=30,
    blind_rows=(),
    deaf_ranks=(),
    frozen_after=None,
):
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
            world = FakeKingdom(
                scanner, drift_rows, blind_rows, deaf_ranks, frozen_after
            )
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
                    ScanOptions(
                        kingdom=1,
                        amount=1,
                        evidence="none",
                        rows_per_page=4,
                        scroll_wait=0,
                    ),
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

    def test_a_scan_full_of_holes_is_not_called_complete(self) -> None:
        # 31/08: quet 3 nguoi, bat duoc hang 109, 4 va 1, va ket qua ghi
        # status=complete ranksMissing=0. Du so luong thi chua phai la du
        # nguoi — thu hang phai lien tuc thi moi goi la tron ven.
        result, _ranks, skipped, _ = run_scan(drift_rows=8.0)
        self.assertGreater(len(skipped), 0)
        self.assertEqual("partial", result["status"])

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


class OneRowPerPageTest(unittest.TestCase):
    """Che do mac dinh: bam DONG DAU, keo len mot dong, doc lai.

    Truoc day hai con so trong `scan` gia dinh moi trang bam bon hang —
    `max_pages` chia cho 4, va nguong dung la ba TRANG lien tiep khong them
    duoc ai. Voi mot hang moi trang thi so trang can gap bon lan con so
    duoc cap, va ba lan bam truot lien tiep du de ket thuc ban quet. Ca hai
    deu ket thuc som ma bao "partial", nen khong ai nhin ra la loi.
    """

    def test_covers_everyone_one_row_at_a_time(self) -> None:
        result, ranks, skipped, _ = run_scan(rows_per_page=1, amount=30)
        self.assertEqual(list(range(1, 31)), ranks)
        self.assertEqual([], skipped)
        self.assertEqual("complete", result["status"])

    def test_overshooting_every_scroll_is_pulled_back(self) -> None:
        result, _ranks, skipped, world = run_scan(
            rows_per_page=1, amount=30, drift_rows=1.0
        )
        self.assertEqual([], skipped)
        self.assertEqual(0, result["ranksMissing"])
        self.assertGreater(world.scroll_backs, 0)

    def test_scattered_misses_do_not_end_the_scan_early(self) -> None:
        # Cu ba nguoi thi mot nguoi bam khong mo duoc ho so. Khong bao gio
        # co 12 lan truot lien tiep, nen ban quet phai di het 30 nguoi.
        result, _ranks, _skipped, _ = run_scan(
            rows_per_page=1, amount=30, deaf_ranks=range(3, 60, 3)
        )
        self.assertEqual(30, result["records"])
        self.assertGreater(result["missedRows"], 0)
        # Di het 30 nguoi chu khong dung som — nhung du SO LUONG ma thieu
        # NGUOI thi van la partial, vi cu ba nguoi lai nhay mot.
        self.assertEqual("partial", result["status"])
        self.assertGreater(result["ranksMissing"], 0)


class RowShiftAppliesToTheRightThingsTest(unittest.TestCase):
    """Do lech chi duoc dich danh sach, khong duoc dich ho so nguoi choi.

    Danh sach troi theo quan tinh; bang ho so mo len la mot lop rieng nam
    yen mot cho. Dich ca hai theo cung mot so la chua cai nay hong cai kia,
    va cai hong moi im lang hon: OCR van ra CHU, chi la chu cua o ben canh.
    """

    def scanner(self, workspace: str) -> KingdomScanner:
        with (
            patch.object(scanner_module, "find_tesseract", lambda path=None: "t"),
            patch.object(scanner_module, "find_tessdata", lambda a, b=None: Path(workspace)),
            patch.object(scanner_module, "available_languages", lambda path: ["eng"]),
        ):
            return KingdomScanner(
                FakeClient(),
                "SERIAL",
                load_profile(PROFILE),
                Path(workspace),
                ScanOptions(kingdom=1, amount=1, evidence="none", scroll_wait=0),
                confirmed=True,
            )

    def test_ranking_boxes_move_and_governor_boxes_do_not(self) -> None:
        with TemporaryDirectory() as workspace:
            scanner = self.scanner(workspace)
            before = {
                name: scanner._region_box(name)
                for name in ("ranking.row1", "ranking.rank1", "governor.name")
            }
            scanner.row_shift = -44
            after = {name: scanner._region_box(name) for name in before}

        for name in ("ranking.row1", "ranking.rank1"):
            self.assertEqual(before[name][1] - 44, after[name][1], name)
            self.assertEqual(before[name][3] - 44, after[name][3], name)
            self.assertEqual(before[name][0], after[name][0], name)
        self.assertEqual(before["governor.name"], after["governor.name"])


class DroppedRecordsAreCountedTest(unittest.TestCase):
    """Ban ghi bi vut phai khai ly do, khong duoc bien mat.

    Chay that ngay 31/08 tren may 09: 14 lan bam, 2 ban ghi, va bao cao ghi
    missedRows=0, ranksMissing=0, rankGaps=[]. Danh sach dung im tu trang 2
    nen 12 lan sau bam lai dung mot nguoi, va nhanh loc trung ID khong co
    `else` nen khong de lai dau vet nao. Bao cao trong y het mot ban quet
    thanh cong — kieu hong te nhat, vi khong ai di kiem tra mot ket qua
    sach se.
    """

    def test_a_frozen_list_is_reported_as_duplicates_not_as_success(self) -> None:
        result, _ranks, _skipped, _ = run_scan(
            rows_per_page=1, amount=6, frozen_after=2
        )
        self.assertEqual("partial", result["status"])
        self.assertGreater(result["missedRows"], 0)
        self.assertGreater(result["missedByReason"].get("trung-id", 0), 0)
        # Bam nhieu hon so nguoi ghi duoc — do la thuoc do do phu that.
        self.assertGreater(result["attempts"], result["records"])

    def test_a_clean_scan_reports_nothing_missed(self) -> None:
        result, _ranks, _skipped, _ = run_scan(rows_per_page=1, amount=6)
        self.assertEqual(6, result["records"])
        self.assertEqual(0, result["missedRows"])
        self.assertEqual({}, result["missedByReason"])


if __name__ == "__main__":
    unittest.main()
