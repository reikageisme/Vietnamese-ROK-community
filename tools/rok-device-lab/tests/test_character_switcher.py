import unittest
from pathlib import Path

from PIL import Image
from rok_lab.adb import AdbError
from rok_lab.character_switcher import CharacterSwitcher
from rok_lab.profiles import DeviceProfile


class FakeClient:
    def __init__(self) -> None:
        self.taps = []
        self.keys = []

    def foreground_activity(self, serial: str) -> str:
        return "com.rok.gp.vn/com.lilithgames.rok.MainActivity"

    def screenshot(self, serial: str, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (1920, 1080), "black").save(destination)
        return destination

    def tap(self, serial: str, x: int, y: int) -> str:
        self.taps.append((serial, x, y))
        return ""

    def keyevent(self, serial: str, key: str) -> str:
        self.keys.append((serial, key))
        return ""

    def swipe(self, serial, start, end, duration_ms=650):
        return ""


class CharacterSwitcherTest(unittest.TestCase):
    def setUp(self) -> None:
        self.profile = DeviceProfile(
            name="test",
            game_package="com.rok.gp.vn",
            reference_resolution=(1920, 1080),
            taps={"character.avatar": (0.5, 0.5)},
            regions={},
            screens={},
        )

    def test_executes_named_tap_only_on_game_foreground(self) -> None:
        client = FakeClient()
        CharacterSwitcher(client, "serial-1", self.profile).execute(
            {
                "steps": [
                    {"action": "tap", "point": "character.avatar", "waitSeconds": 0}
                ]
            }
        )
        self.assertEqual([("serial-1", 960, 540)], client.taps)

    def test_refuses_empty_route(self) -> None:
        with self.assertRaises(AdbError):
            CharacterSwitcher(FakeClient(), "serial-1", self.profile).execute(
                {"steps": []}
            )


if __name__ == "__main__":
    unittest.main()
