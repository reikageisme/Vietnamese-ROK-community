import unittest

from rok_lab.governor import finalize_record


class GovernorValidationTest(unittest.TestCase):
    def test_reconstructs_total_kill_points_when_both_tier_views_agree(self) -> None:
        record = {
            "governorId": "1",
            "name": "Governor",
            "power": 10,
            "killPoints": 4406003,
            "t1Kills": 51118035,
            "t2Kills": 6795651,
            "t3Kills": 6807947,
            "t4Kills": 407729281,
            "t5Kills": 765613042,
            "t1KillPoints": 10223607,
            "t2KillPoints": 13591302,
            "t3KillPoints": 27231788,
            "t4KillPoints": 4077292810,
            "t5KillPoints": 15312260840,
        }
        result = finalize_record(record)
        self.assertEqual(19440600347, result["killPoints"])
        self.assertTrue(result["killPointsReconstructed"])
        self.assertTrue(result["killsValidated"])
        self.assertFalse(result["needsReview"])


if __name__ == "__main__":
    unittest.main()
