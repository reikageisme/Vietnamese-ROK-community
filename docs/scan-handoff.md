# Bàn giao: tool quét ROK trên máy 09

Viết cho một phiên Claude Code chạy **trực tiếp trên máy quét** (`C:\rok\ROK Forum`).
Đọc file này trước khi đụng vào `tools/rok-device-lab`.

Ngày đo: 31/08/2026. Thiết bị: `520007cc4bef354d`.

## Mục tiêu

Quét bảng Individual Power Rankings của một vương quốc ROK: mở hồ sơ từng
người, OCR, xuất xlsx/csv/jsonl, đẩy lên Collector. Thay thế RokTracker
(MIT, chạy trên BlueStacks) bằng bản chạy được trên nhiều máy cùng lúc.

## Những gì đã ĐO được, không phải đoán

**Thiết bị không có node cảm ứng.** `ls -l /dev/input/` chỉ ra event0..event5:
tai nghe, cảm biến tiệm cận, meta_event, gia tốc, sec_touchkey, gpio_keys.
Không có màn hình cảm ứng. Quyền thì đủ (`crw-rw---- system input`, shell ở
trong nhóm `1004(input)`) — chỉ là không có gì để ghi vào.

→ **`sendevent` không dùng được ở đây.** Không phải thiếu root. Không có node.
Nhiều khả năng đây là Android ảo hoá do phần mềm phone farm dựng.

**`input swipe` và `input motionevent` không điều khiển được.** Đo ba lần,
mỗi lần kéo đúng một dòng (120px), ở ba thời điểm khác nhau:

| | motionevent | swipe-slow | swipe |
|---|---|---|---|
| lần 1 | `None, -1, 2` | `1, 1, 1` | `None, None, None` |
| lần 2 | `None, -1, 2` | `1, 1, None` | `None, None, None` |
| lần 3 | `1, 0, 1` | `None, None, 0` | `None, None, 112` |

Cùng một lệnh, cùng toạ độ, ra 0 / 1 / 2 / −1 dòng, và một lần nhảy tới
hạng 112. Lần `1,1,1` là ăn may, đừng đọc nó như một kết quả.

Nguyên nhân: mỗi lệnh `input` là một tiến trình riêng, nên `downTime` đứt
quãng và Unity đọc ra một cú vẩy chứ không phải một cú kéo. Xem đầu
`rok_lab/gestures.py`.

**Giao diện game đang là TIẾNG ANH.** Ghi chú cũ nói tiếng Việt là sai. Tên
người chơi có tiếng Việt/Hàn, giao diện thì không.

**DPI/độ phân giải:** `1080x1920 @ 420`. RokTracker khai `1600x900 @ 450`.
Khác, nhưng KHÔNG phải nguyên nhân: đo trên ảnh thật thì khoảng cách dòng
đúng 120px = `0.1111 × 1080` như profile, và dòng 1 đúng ở `y ≈ 0.314`.
Đừng đổi độ phân giải — profile 1920×1080 hiện tại đã đúng phần khó nhất.

## Việc tiếp theo: cử chỉ chạm qua scrcpy

Đây là đường duy nhất còn lại, và nó không cần root.

scrcpy giữ **một socket duy nhất** tới một server sống liên tục trên máy,
bơm `MotionEvent` với `touch_id` nhất quán và mốc thời gian chính xác, qua
`injectInputEvent` — không qua `/dev/input`. Đó là thứ `input` không làm được.

Hình dạng cần dựng lại chính là macro của RokTracker:

    touch(x, y0, DOWN)
    for point in đường_đi:  touch(x, point, MOVE)
    for _ in range(12):     touch(x, y1, MOVE)     # GIỮ YÊN, đoạn quyết định
    touch(x, y1, UP)

Mười hai lần `MOVE` tại đúng một điểm trước khi nhấc làm vận tốc lúc nhả
bằng 0, nên danh sách dừng đúng chỗ ngón tay dừng.

Thư viện: `py-scrcpy-client` (`pip install scrcpy-client`), hàm `touch(x, y,
action)` thô — đừng dùng hàm `swipe` đóng gói của nó, nó không có đoạn giữ yên.

Chỗ cắm vào: thêm `"scrcpy"` vào `GESTURE_KINDS` và một nhánh trong
`perform_scroll` (`rok_lab/gestures.py`). Hạ tầng đã có sẵn, không cần sửa
`kingdom_scanner`.

Repo đã có `rok_lab/scrcpy.py` nhưng mới chỉ dùng scrcpy để XEM
(`cli.py live`), chưa dùng để điều khiển.

## Cách chấm điểm

    & $rok -m rok_lab.cli scroll-calibrate <serial> --rows 1 --repeat 3 --confirm

Nó đọc thứ hạng dòng đầu trước và sau mỗi lần vuốt. Ra `1, 1, 1` ba lần
liên tiếp mới tính là được. Rồi:

    & $rok -m rok_lab.cli kingdom-scan <serial> --kingdom 2812 --amount 6 `
      --name thu-nghiem --evidence all --confirm

Đọc `status`, `ranksMissing`, `missedByReason` trong JSON kết quả. `complete`
giờ đòi cả đủ số người LẪN thứ hạng liên tục.

## Đã sửa gì (4 commit ngày 31/08)

- **Đo độ lệch lưới sau mỗi lần chụp màn.** `imaging.row_grid_offset` tìm pha
  của khe tối giữa hai dòng. Danh sách dừng lệch bao nhiêu cũng được, miễn là
  BIẾT lệch bao nhiêu — cả ô cắt lẫn cú bấm đều dịch theo. Đo được +1px trên
  một ảnh và −44px trên ảnh khác, cách nhau ba lần vuốt.
- **Thu hẹp `ranking.rank*`** từ `0.125–0.203` (ôm trọn avatar) còn
  `0.118–0.154`, bật nhị phân hoá chữ trắng. Trước: 7/9 lần không đọc được
  thứ hạng. Sau: 6/9 đọc được.
- **`--rows-per-page` mặc định 1**, và gỡ hai chỗ hard-code "4 hàng/trang".
- **Thứ tự lui cử chỉ**: `swipe-slow` trước `motionevent`.
- **Bản ghi bị vứt phải khai lý do** (`missedByReason`). Trước đó nhánh lọc
  trùng `governorId` không có `else`: một lần chạy 14 lần bấm ra 2 bản ghi mà
  báo `missedRows: 0`.
- **Đếm người thiếu từ thứ hạng đã ghi**, không từ sổ sách cộng dồn. Trước đó
  bắt được hạng 109, 4, 1 rồi báo `status: complete, ranksMissing: 0`.

## Bẫy đã dẫm phải

- **Máy quét tự nó là máy ảo** (`systeminfo` báo `A hypervisor has been
  detected`). Giả lập Android gần như không chạy nổi ở đây.
- Chốt đối chiếu tên (`name_match_min`) là thứ duy nhất chặn được ghi nhầm
  người. Nó đã chặn 2 lần trong một bản quét 3 người. **Đừng nới nó ra.**
- Hạng 1–2–3 hiển thị bằng huy hiệu chứ không phải chữ số, nên OCR thứ hạng
  ở đỉnh bảng hay trượt. Không sao: `_page_top_rank` lấy theo đa số, chỉ cần
  3/6 dòng đọc được.
- Ô cắt `0.118–0.154` **chưa được kiểm với hạng 3 chữ số**. Nếu tới hạng 100+
  mà ra `None` thì hạ `0.118` xuống.
