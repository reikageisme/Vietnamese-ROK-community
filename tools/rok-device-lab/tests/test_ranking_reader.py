import unittest

from rok_lab.ranking_reader import parse_ranking_row


class RankingRowParserTest(unittest.TestCase):
    def test_parses_tag_name_alliance_and_power(self) -> None:
        result = parse_ranking_row("[CS35] Boss Võ\nCZ/SK Legends 125,785,281", 1, 92.5)
        self.assertEqual("CS35", result["allianceTag"])
        self.assertEqual("Boss Võ", result["name"])
        self.assertEqual("CZ/SK Legends", result["allianceName"])
        self.assertEqual(125785281, result["power"])
        self.assertFalse(result["needsReview"])

    def test_marks_missing_power_for_review(self) -> None:
        result = parse_ranking_row("[F812] 정보\nFreak", 4, 70)
        self.assertTrue(result["needsReview"])

    def test_accepts_fullwidth_separators_and_ignores_prefix_before_tag(self) -> None:
        result = parse_ranking_row(
            "、 [CS35] RockkyWar\nCZ/SK Legends 96，347，130", 3, None
        )
        self.assertEqual("RockkyWar", result["name"])
        self.assertEqual(96347130, result["power"])
        self.assertFalse(result["needsReview"])


if __name__ == "__main__":
    unittest.main()
