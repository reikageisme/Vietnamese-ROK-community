import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from PIL import Image
from rok_lab.imaging import difference_hash, hamming_distance
from rok_lab.profiles import DeviceProfile, ScreenFingerprint
from rok_lab.rankings import open_ranking


class ImagingTest(unittest.TestCase):
    def test_difference_hash_is_stable(self) -> None:
        image = Image.new("RGB", (100, 50), "white")
        first = difference_hash(image)
        second = difference_hash(image.copy())
        self.assertEqual(first, second)
        self.assertEqual(0, hamming_distance(first, second))


class RankingGuardTest(unittest.TestCase):
    def test_open_requires_explicit_confirmation_before_adb(self) -> None:
        profile = DeviceProfile(
            name="test",
            game_package="com.rok.gp.vn",
            reference_resolution=(1920, 1080),
            taps={"ranking.individual-power": (0.5, 0.5)},
            regions={},
            screens={"rankings-menu": (ScreenFingerprint((0, 0, 1, 1), "0" * 16, 0),)},
        )
        client = Mock()
        with (
            tempfile.TemporaryDirectory() as directory,
            self.assertRaisesRegex(Exception, "--confirm"),
        ):
            open_ranking(
                client,
                "R58M111",
                profile,
                Path(directory),
                "individual-power",
                confirmed=False,
            )
        client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
