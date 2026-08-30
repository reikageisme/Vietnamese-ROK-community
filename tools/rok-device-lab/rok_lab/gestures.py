"""Cac kieu vuot danh sach, va vi sao lai can nhieu hon mot kieu.

`input swipe` KHONG BAO GIO dung lai dung cho. Android noi suy tu diem dau
den diem cuoi roi nhac tay NGAY LUC NGON TAY VAN DANG DI CHUYEN, nen bo
cuon cua Unity nhan duoc mot van toc khac 0 va tiep tuc troi theo quan
tinh. Vuot cham chi lam van toc nho di chu khong lam no bang 0 — da thu
1500ms, 4000ms, deu con troi.

RokTracker (MIT, Cyrexxis/RokTracker) khong dung `input swipe`. No phat lai
mot macro `sendevent` thu san, va dac diem quan trong nhat cua macro do la
mot chuoi SYN_REPORT KHONG KEM DI CHUYEN o cuoi:

    3 54 190
    0 0 0
    3 54 125
    0 0 0
    0 0 0      <- giu yen
    0 0 0
    ... (11 lan)
    3 57 4294967295   <- roi moi nhac tay

Giu ngon tay dung yen truoc khi nhac lam van toc do duoc tut ve 0, nen
danh sach dung dung cho ngon tay dung. Do la thu `input swipe` khong dien
ta duoc.

O day co hai cach lam duoc dieu do tren may that:

  motionevent  - `input motionevent DOWN/MOVE/UP`, khong phu thuoc thiet bi,
                 nhung moi lenh la mot tien trinh rieng nen downTime cua
                 tung su kien khong lien tuc; da so view khong quan tam,
                 Unity cung khong, nhung khong dam bao 100%.
  sendevent    - dung y het RokTracker: ghi thang vao /dev/input/eventX.
                 Chac chan nhat, nhung phai doc duoc toa do goc cua man
                 hinh cam ung va phai co quyen ghi vao node do.

Khong doan xem cai nao chay duoc tren may nao. Dung `scroll-calibrate` de
do tren may that roi ghi ket qua vao ho so thiet bi.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, replace
from typing import Any

from .adb import AdbClient, AdbError

# Ma so trong linux/input-event-codes.h
EV_SYN = 0
EV_KEY = 1
EV_ABS = 3
SYN_REPORT = 0
SYN_MT_REPORT = 2
BTN_TOUCH = 330
ABS_MT_POSITION_X = 53
ABS_MT_POSITION_Y = 54
ABS_MT_TRACKING_ID = 57
TRACKING_ID_LIFT = 4294967295

# Thu tu nay CHINH LA thu tu lui khi kieu duoc chon khong chay duoc, nen no
# phai xep theo do tin cay do duoc chu khong theo do "dung ky thuat".
#
# Do tren may 09 (SM-A516B, khong root), keo dung mot dong, ba lan moi kieu:
#   sendevent    khong chay — getevent -p khong liet ke node cam ung nao
#   swipe-slow   1, 1, 1     (spread 0)
#   motionevent  None, -1, 2 (co lan danh sach chay NGUOC)
#   swipe        None, None, None
#
# Truoc day motionevent xep truoc swipe-slow, nen tren dan may khong root,
# lui tu sendevent la roi thang vao kieu tòe toe nhat. `input swipe` giu tay
# 4000ms cho mot quang 120px thi van toc luc nha gan bang 0 — ghi chu o dau
# file noi swipe luon con quan tinh la dung voi quang DAI, khong dung voi
# quang ngan mot dong.
GESTURE_KINDS = ("sendevent", "swipe-slow", "motionevent", "swipe")


@dataclass
class TouchDevice:
    """Node /dev/input/eventX cua man hinh cam ung va thang do cua no."""

    node: str
    max_x: int
    max_y: int
    # Giao thuc B dung ABS_MT_TRACKING_ID (may that, Samsung A51). Giao thuc A
    # dung SYN_MT_REPORT — chinh la kieu `0 2 0` trong macro BlueStacks cua
    # RokTracker. Sai giao thuc thi khong co su kien nao toi duoc game.
    protocol_b: bool = True
    # Tam cam ung khai bao toa do theo chieu VAT LY cua no, khong theo chieu
    # dang hien thi. May A51 cam ngang: man hinh 1920x1080 nhung tam cam ung
    # van bao 1080x2400. Neu anh xa thang thi cu vuot doc lai thanh vuot
    # ngang, danh sach khong nhuc nhich ma minh lai tuong la loi khac.
    #
    # Khong doan chieu xoay: "auto" chi chon diem xuat phat hop ly, con dung
    # hay khong thi `scroll-calibrate` do tren may that roi ghi lai.
    mapping: str = "auto"

    def resolved_mapping(self, screen: tuple[int, int]) -> str:
        if self.mapping != "auto":
            return self.mapping
        panel_portrait = self.max_y > self.max_x
        screen_portrait = screen[1] > screen[0]
        return "direct" if panel_portrait == screen_portrait else "rot90"

    def to_device_coords(
        self, x: int, y: int, screen: tuple[int, int]
    ) -> tuple[int, int]:
        width, height = screen
        if self.max_x <= 0 or self.max_y <= 0 or width <= 1 or height <= 1:
            return x, y
        mode = self.resolved_mapping(screen)
        if mode == "rot90":
            return (
                round(y * self.max_x / (height - 1)),
                self.max_y - round(x * self.max_y / (width - 1)),
            )
        if mode == "rot270":
            return (
                self.max_x - round(y * self.max_x / (height - 1)),
                round(x * self.max_y / (width - 1)),
            )
        return (
            round(x * self.max_x / (width - 1)),
            round(y * self.max_y / (height - 1)),
        )


_ADD_DEVICE = re.compile(r"^add device \d+:\s*(\S+)", re.MULTILINE)
_ABS_LINE = re.compile(
    r"([0-9a-fA-F]{4})\s*:\s*value\s+-?\d+,\s*min\s+-?\d+,\s*max\s+(-?\d+)"
)


def find_touch_device(client: AdbClient, serial: str) -> TouchDevice | None:
    """Tim node cam ung bang cach doc `getevent -pl`.

    Chon node nao khai bao CA ABS_MT_POSITION_X lan ABS_MT_POSITION_Y. May
    that thuong co vai node input (nut nguon, cam bien...), chi mot cai la
    man hinh.
    """
    try:
        listing = client.shell(serial, "getevent", "-p", timeout=30)
    except AdbError:
        return None

    blocks: list[tuple[str, str]] = []
    matches = list(_ADD_DEVICE.finditer(listing))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(listing)
        blocks.append((match.group(1), listing[match.end() : end]))

    for node, body in blocks:
        axes = {
            int(code, 16): int(maximum) for code, maximum in _ABS_LINE.findall(body)
        }
        if ABS_MT_POSITION_X in axes and ABS_MT_POSITION_Y in axes:
            return TouchDevice(
                node=node,
                max_x=axes[ABS_MT_POSITION_X],
                max_y=axes[ABS_MT_POSITION_Y],
                protocol_b=ABS_MT_TRACKING_ID in axes,
            )
    return None


def _run_script(client: AdbClient, serial: str, lines: list[str], timeout: float) -> None:
    # Gui CA chuoi lenh trong MOT lan `adb shell`. Neu goi tung dong mot thi
    # moi dong ton mot vong ket noi, dong tac keo bi dut quang va Unity doc
    # ra mot cai vuot giat cuc.
    client.shell(serial, "; ".join(lines), timeout=timeout)


def _interpolate(
    start: tuple[int, int], end: tuple[int, int], steps: int
) -> list[tuple[int, int]]:
    steps = max(2, steps)
    points: list[tuple[int, int]] = []
    for index in range(1, steps + 1):
        ratio = index / steps
        points.append(
            (
                start[0] + round((end[0] - start[0]) * ratio),
                start[1] + round((end[1] - start[1]) * ratio),
            )
        )
    return points


def scroll_sendevent(
    client: AdbClient,
    serial: str,
    start: tuple[int, int],
    end: tuple[int, int],
    screen: tuple[int, int],
    *,
    touch: TouchDevice,
    move_steps: int = 10,
    hold_samples: int = 12,
    step_delay: float = 0.03,
    hold_delay: float = 0.04,
) -> None:
    """Y het macro cua RokTracker, nhung sinh ra theo thang do cua may nay."""
    node = touch.node
    delay = f"sleep {step_delay:.3f}"
    hold = f"sleep {hold_delay:.3f}"

    def emit(x: int, y: int) -> list[str]:
        dev = touch.to_device_coords(x, y, screen)
        out = [
            f"sendevent {node} {EV_ABS} {ABS_MT_POSITION_X} {dev[0]}",
            f"sendevent {node} {EV_ABS} {ABS_MT_POSITION_Y} {dev[1]}",
        ]
        if not touch.protocol_b:
            out.append(f"sendevent {node} {EV_SYN} {SYN_MT_REPORT} 0")
        out.append(f"sendevent {node} {EV_SYN} {SYN_REPORT} 0")
        return out

    lines: list[str] = []
    if touch.protocol_b:
        lines.append(f"sendevent {node} {EV_ABS} {ABS_MT_TRACKING_ID} 1")
    lines.append(f"sendevent {node} {EV_KEY} {BTN_TOUCH} 1")
    lines.extend(emit(start[0], start[1]))
    lines.append(delay)

    for point in _interpolate(start, end, move_steps):
        lines.extend(emit(point[0], point[1]))
        lines.append(delay)

    # Doan quyet dinh: bao nhieu nhip nua nhung KHONG doi toa do. Giao thuc A
    # phai gui lai toa do cu moi nhip, giao thuc B chi can SYN_REPORT khong.
    for _ in range(max(1, hold_samples)):
        if touch.protocol_b:
            lines.append(f"sendevent {node} {EV_SYN} {SYN_REPORT} 0")
        else:
            lines.extend(emit(end[0], end[1]))
        lines.append(hold)

    if touch.protocol_b:
        lines.append(
            f"sendevent {node} {EV_ABS} {ABS_MT_TRACKING_ID} {TRACKING_ID_LIFT}"
        )
    else:
        lines.append(f"sendevent {node} {EV_SYN} {SYN_MT_REPORT} 0")
    lines.append(f"sendevent {node} {EV_KEY} {BTN_TOUCH} 0")
    lines.append(f"sendevent {node} {EV_SYN} {SYN_REPORT} 0")
    budget = 30 + (move_steps * step_delay + hold_samples * hold_delay) * 3
    _run_script(client, serial, lines, timeout=budget)


def scroll_motionevent(
    client: AdbClient,
    serial: str,
    start: tuple[int, int],
    end: tuple[int, int],
    screen: tuple[int, int],
    *,
    move_steps: int = 10,
    hold_samples: int = 8,
    step_delay: float = 0.0,
    hold_delay: float = 0.05,
) -> None:
    """Cung y tuong nhung dung `input motionevent`, khong can biet node nao.

    Moi lan goi `input` la mot tien trinh rieng (~80-150ms tren may that),
    nen ban than no da tao ra khoang nghi giua cac nhip; khong can sleep
    them o buoc di chuyen.
    """
    del screen  # `input` nhan thang toa do man hinh
    lines = [f"input motionevent DOWN {start[0]} {start[1]}"]
    for point in _interpolate(start, end, move_steps):
        lines.append(f"input motionevent MOVE {point[0]} {point[1]}")
        if step_delay > 0:
            lines.append(f"sleep {step_delay:.3f}")
    for _ in range(max(1, hold_samples)):
        lines.append(f"input motionevent MOVE {end[0]} {end[1]}")
        if hold_delay > 0:
            lines.append(f"sleep {hold_delay:.3f}")
    lines.append(f"input motionevent UP {end[0]} {end[1]}")
    budget = 30 + (move_steps + hold_samples) * 1.0
    _run_script(client, serial, lines, timeout=budget)


def scroll_swipe(
    client: AdbClient,
    serial: str,
    start: tuple[int, int],
    end: tuple[int, int],
    screen: tuple[int, int],
    *,
    duration_ms: int = 1500,
) -> None:
    """Cach cu. Giu lai de so sanh trong `scroll-calibrate`, khong phai de dung."""
    del screen
    client.swipe(serial, start, end, duration_ms)


def _release_touch(client: AdbClient, serial: str, touch: TouchDevice) -> None:
    """Nhac ngon tay ra sau mot chuoi sendevent bi dut."""
    node = touch.node
    lines = []
    if touch.protocol_b:
        lines.append(f"sendevent {node} {EV_ABS} {ABS_MT_TRACKING_ID} {TRACKING_ID_LIFT}")
    else:
        lines.append(f"sendevent {node} {EV_SYN} {SYN_MT_REPORT} 0")
    lines.append(f"sendevent {node} {EV_KEY} {BTN_TOUCH} 0")
    lines.append(f"sendevent {node} {EV_SYN} {SYN_REPORT} 0")
    try:
        _run_script(client, serial, lines, timeout=20)
    except (AdbError, OSError):
        pass


def perform_scroll(
    client: AdbClient,
    serial: str,
    start: tuple[int, int],
    end: tuple[int, int],
    screen: tuple[int, int],
    kind: str,
    *,
    touch: TouchDevice | None = None,
    mapping: str | None = None,
    settle: float = 1.6,
    **kwargs: Any,
) -> str:
    """Vuot mot lan theo kieu duoc chon. Tra ve kieu THUC SU da dung.

    Neu kieu duoc chon khong chay duoc tren may nay (vi du sendevent ma
    khong tim thay node cam ung) thi lui ve kieu ke tiep chu khong bo
    qua lan vuot — bo qua se lam lech ca danh sach.
    """
    order = [kind] + [name for name in GESTURE_KINDS if name != kind]
    last_error: Exception | None = None
    for candidate in order:
        try:
            if candidate == "sendevent":
                device = touch or find_touch_device(client, serial)
                if device is None:
                    raise AdbError("Khong tim thay node cam ung trong getevent -p.")
                if mapping:
                    device = replace(device, mapping=mapping)
                scroll_sendevent(
                    client, serial, start, end, screen, touch=device, **kwargs
                )
            elif candidate == "motionevent":
                scroll_motionevent(client, serial, start, end, screen, **kwargs)
            elif candidate == "swipe-slow":
                scroll_swipe(client, serial, start, end, screen, duration_ms=4000)
            else:
                scroll_swipe(client, serial, start, end, screen, duration_ms=1500)
        except (AdbError, OSError) as exc:
            last_error = exc
            if candidate == "sendevent" and touch is not None:
                _release_touch(client, serial, touch)
            continue
        time.sleep(settle)
        return candidate
    raise AdbError(f"Khong vuot duoc bang bat ky cach nao: {last_error}")
