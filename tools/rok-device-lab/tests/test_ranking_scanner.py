import tempfile
import unittest
from pathlib import Path

from rok_lab.profiles import load_profile
from rok_lab.ranking_scan_export import write_ranking_exports
from rok_lab.ranking_scanner import MODES, clean_name, normalize_score, parse_score


class RankingScannerTest(unittest.TestCase):
    def test_parses_localized_score(self) -> None:
        self.assertEqual(135_240_771, parse_score("135.240,771"))
        self.assertIsNone(parse_score("—"))

    def test_cleans_multiline_name(self) -> None:
        self.assertEqual("Boss Võ", clean_name(" Boss\nVõ "))
        self.assertIsNone(clean_name("  \n"))

    def test_flags_non_monotonic_score_without_overwriting_it(self) -> None:
        score, review = normalize_score(120, 100)
        self.assertEqual(120, score)
        self.assertTrue(review)

    def test_profile_has_every_mode_region(self) -> None:
        profile_path = (
            Path(__file__).resolve().parents[1] / "profiles" / "rok-a51-1920x1080.json"
        )
        profile = load_profile(profile_path)
        for mode_name, mode in MODES.items():
            for row in range(1, mode.rows + 1):
                profile.box(f"ranking.{mode_name}.name{row}", (1920, 1080))
                profile.box(f"ranking.{mode_name}.score{row}", (1920, 1080))

    def test_profile_covers_complete_kill_statistics_popup(self) -> None:
        profile_path = (
            Path(__file__).resolve().parents[1] / "profiles" / "rok-a51-1920x1080.json"
        )
        profile = load_profile(profile_path)
        regions = [
            *(f"kills.t{tier}" for tier in range(1, 6)),
            *(f"kills.t{tier}-kp" for tier in range(1, 6)),
            "kills.ranged",
        ]
        self.assertEqual(11, len(regions))
        for region in regions:
            profile.box(region, (1920, 1080))

    def test_exports_json_csv_and_xlsx(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_ranking_exports(
                Path(temporary),
                [
                    {
                        "rank": 1,
                        "name": "Boss Võ",
                        "score": 123,
                        "scoreRaw": "123",
                        "evidenceImage": None,
                        "needsReview": False,
                    }
                ],
                {"rankingType": "seed", "capturedAt": "now"},
                {"xlsx", "csv", "jsonl"},
            )
            self.assertEqual({"json", "jsonl", "csv", "xlsx"}, set(paths))
            self.assertTrue(all(Path(path).is_file() for path in paths.values()))


if __name__ == "__main__":
    unittest.main()
