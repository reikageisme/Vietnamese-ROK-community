import unittest
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

from rok_lab.adb import AdbClient, AdbError, parse_devices, resolve_device
from rok_lab.collector import upload_scan


class ParseDevicesTest(unittest.TestCase):
    def test_parses_two_physical_devices(self) -> None:
        output = """List of devices attached
R58M111 device product:a model:SM_A515F device:a51 transport_id:1
R58M222 unauthorized usb:2-1 transport_id:2
"""
        devices = parse_devices(output)
        self.assertEqual(2, len(devices))
        self.assertEqual("R58M111", devices[0].serial)
        self.assertEqual("SM_A515F", devices[0].model)
        self.assertTrue(devices[0].ready)
        self.assertEqual("unauthorized", devices[1].state)
        self.assertFalse(devices[1].ready)

    def test_ignores_adb_daemon_messages(self) -> None:
        output = """* daemon not running; starting now at tcp:5037
* daemon started successfully
List of devices attached
"""
        self.assertEqual([], parse_devices(output))

    def test_resolves_alias_without_changing_raw_serial(self) -> None:
        aliases = {"phone01": "R58M111"}
        self.assertEqual("R58M111", resolve_device("phone01", aliases))
        self.assertEqual("R58M999", resolve_device("R58M999", aliases))

    def test_shell_always_addresses_requested_serial(self) -> None:
        client = object.__new__(AdbClient)
        client.path = Path("adb")
        client.timeout = 20
        completed = CompletedProcess([], 0, stdout=b"ok\n", stderr=b"")
        with (
            patch.object(client, "require_ready"),
            patch("rok_lab.adb.subprocess.run", return_value=completed) as run,
        ):
            self.assertEqual("ok", client.shell("R58M111", "input", "keyevent", "HOME"))

        command = run.call_args.args[0]
        self.assertEqual(["adb", "-s", "R58M111"], command[:3])
        self.assertFalse(run.call_args.kwargs.get("shell", False))

    def test_foreground_activity_extracts_package_and_activity(self) -> None:
        client = object.__new__(AdbClient)
        with patch.object(
            client,
            "shell",
            return_value=(
                "mResumedActivity: ActivityRecord{1 u0 "
                "com.rok.gp.vn/com.harry.engine.MainActivity t10}"
            ),
        ):
            self.assertEqual(
                "com.rok.gp.vn/com.harry.engine.MainActivity",
                client.foreground_activity("R58M111"),
            )

    def test_collector_requires_url_before_reading_scan(self) -> None:
        with (
            patch.dict("os.environ", {}, clear=True),
            self.assertRaisesRegex(AdbError, "ROK_COLLECTOR_URL"),
        ):
            upload_scan(Path("missing.json"))


if __name__ == "__main__":
    unittest.main()
