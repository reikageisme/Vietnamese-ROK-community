"""Kiem tra cach sinh dong tac vuot.

Phan quan trong nhat khong phai quang duong ma la DOAN CUOI: phai co mot
chuoi nhip khong kem di chuyen truoc khi nhac tay. Do la thu lam van toc ve
0, va la thu `input swipe` khong the co. Neu ai do "don dep" mat doan giu
yen nay thi loi truot danh sach se quay lai y nguyen, nen no can mot bai
kiem tra rieng.
"""

import unittest

from rok_lab.gestures import (
    ABS_MT_POSITION_X,
    ABS_MT_POSITION_Y,
    ABS_MT_TRACKING_ID,
    TRACKING_ID_LIFT,
    TouchDevice,
    find_touch_device,
    scroll_motionevent,
    scroll_sendevent,
)

GETEVENT = """add device 1: /dev/input/event3
  name:     "gpio_keys"
  events:
    KEY (0001): 0072  0073
add device 2: /dev/input/event2
  name:     "sec_touchscreen"
  events:
    KEY (0001): 014a
    ABS (0003): 0035  : value 0, min 0, max 1079, fuzz 0, flat 0, resolution 0
                 0036  : value 0, min 0, max 2399, fuzz 0, flat 0, resolution 0
                 0039  : value 0, min 0, max 65535, fuzz 0, flat 0, resolution 0
"""


class FakeClient:
    def __init__(self, reply: str = "") -> None:
        self.reply = reply
        self.scripts: list[str] = []

    def shell(self, serial, *args, timeout=None):  # noqa: ANN001, ANN002
        if args and args[0] == "getevent":
            return self.reply
        self.scripts.append(args[0])
        return ""


class FindTouchDeviceTest(unittest.TestCase):
    def test_picks_the_node_that_reports_both_touch_axes(self) -> None:
        device = find_touch_device(FakeClient(GETEVENT), "X")
        assert device is not None
        self.assertEqual("/dev/input/event2", device.node)
        self.assertEqual((1079, 2399), (device.max_x, device.max_y))
        self.assertTrue(device.protocol_b)

    def test_returns_none_when_no_node_has_touch_axes(self) -> None:
        listing = 'add device 1: /dev/input/event3\n  name: "gpio_keys"\n'
        self.assertIsNone(find_touch_device(FakeClient(listing), "X"))


class CoordinateMappingTest(unittest.TestCase):
    """Tam cam ung bao toa do theo chieu VAT LY cua no, khong theo chieu dang
    hien. May cam ngang ma anh xa thang thi cu vuot doc lai thanh vuot ngang
    va danh sach khong nhuc nhich."""

    def setUp(self) -> None:
        self.device = TouchDevice("/dev/input/event2", 1079, 2399)

    def test_landscape_screen_on_portrait_panel_rotates(self) -> None:
        self.assertEqual("rot90", self.device.resolved_mapping((1920, 1080)))

    def test_portrait_screen_on_portrait_panel_does_not_rotate(self) -> None:
        self.assertEqual("direct", self.device.resolved_mapping((1080, 2400)))

    def test_vertical_swipe_moves_one_panel_axis_only(self) -> None:
        screen = (1920, 1080)
        top = self.device.to_device_coords(960, 465, screen)
        bottom = self.device.to_device_coords(960, 945, screen)
        self.assertEqual(top[1], bottom[1])
        self.assertEqual(480, abs(top[0] - bottom[0]))


class SendEventMacroTest(unittest.TestCase):
    def setUp(self) -> None:
        self.device = TouchDevice("/dev/input/event2", 1079, 2399)
        self.client = FakeClient()
        scroll_sendevent(
            self.client,
            "X",
            (960, 945),
            (960, 465),
            (1920, 1080),
            touch=self.device,
            move_steps=8,
            hold_samples=10,
        )
        self.lines = self.client.scripts[0].split("; ")

    def test_whole_gesture_goes_in_a_single_shell_call(self) -> None:
        self.assertEqual(1, len(self.client.scripts))

    def test_finger_is_held_still_before_it_lifts(self) -> None:
        syn = "sendevent /dev/input/event2 0 0 0"
        lift = next(
            index
            for index, line in enumerate(self.lines)
            if f"{ABS_MT_TRACKING_ID} {TRACKING_ID_LIFT}" in line
        )
        held = 0
        for line in reversed(self.lines[:lift]):
            if line == syn:
                held += 1
            elif line.startswith("sleep"):
                continue
            else:
                break
        # 10 nhip giu, cong SYN cua buoc di chuyen cuoi cung
        self.assertEqual(11, held)

    def test_the_held_position_is_the_end_of_the_swipe(self) -> None:
        moves = [line for line in self.lines if f" {ABS_MT_POSITION_X} " in line]
        expected = self.device.to_device_coords(960, 465, (1920, 1080))[0]
        self.assertEqual(f"sendevent /dev/input/event2 3 {ABS_MT_POSITION_X} {expected}", moves[-1])

    def test_protocol_a_devices_use_syn_mt_report_instead_of_tracking_id(self) -> None:
        client = FakeClient()
        scroll_sendevent(
            client,
            "X",
            (960, 945),
            (960, 465),
            (1920, 1080),
            touch=TouchDevice("/dev/input/event1", 1079, 2399, protocol_b=False),
            move_steps=3,
            hold_samples=4,
        )
        self.assertIn("0 2 0", client.scripts[0])
        self.assertNotIn(f"3 {ABS_MT_TRACKING_ID}", client.scripts[0])

    def test_axis_codes_are_the_kernel_ones(self) -> None:
        self.assertEqual((53, 54, 57), (ABS_MT_POSITION_X, ABS_MT_POSITION_Y, ABS_MT_TRACKING_ID))


class MotionEventMacroTest(unittest.TestCase):
    def test_ends_with_repeated_moves_at_the_same_point_then_up(self) -> None:
        client = FakeClient()
        scroll_motionevent(
            client, "X", (960, 945), (960, 465), (1920, 1080), move_steps=6, hold_samples=5
        )
        lines = client.scripts[0].split("; ")
        self.assertTrue(lines[0].startswith("input motionevent DOWN 960 945"))
        self.assertEqual("input motionevent UP 960 465", lines[-1])
        # 5 nhip giu + buoc di chuyen cuoi cung, deu o dung mot toa do
        self.assertEqual(
            6, sum(1 for line in lines if line == "input motionevent MOVE 960 465")
        )


if __name__ == "__main__":
    unittest.main()
