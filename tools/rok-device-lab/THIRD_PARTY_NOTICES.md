# Thông báo thành phần bên thứ ba

Thiết kế các workflow Kingdom, Alliance, Honor và Seed cùng một số tọa độ
tham chiếu được nghiên cứu từ dự án **RokTracker 6.0.0**
(https://github.com/Cyrexxis/RokTracker), phát hành theo giấy phép MIT.

Hai điều học được từ mã nguồn đó, ghi lại vì chúng sửa đúng lỗi kéo danh sách
mà công cụ này mắc phải suốt nhiều ngày:

1. RokTracker không dùng `input swipe`. Nó phát lại một macro `sendevent` thu
   sẵn (`deps/inputs/*/kingdom_1_person_scroll.txt`), và điểm quyết định là
   một chuỗi `SYN_REPORT` **không kèm di chuyển** trước khi nhấc tay. Giữ yên
   ngón tay làm vận tốc tụt về 0, nên danh sách dừng đúng chỗ ngón tay dừng.
   `input swipe` luôn nhấc tay trong lúc còn đang di chuyển nên luôn còn quán
   tính — vuốt chậm chỉ làm nhẹ đi chứ không hết. `rok_lab/gestures.py` dựng
   lại đúng động tác đó, sinh theo thang đo của từng máy thay vì thu sẵn.

2. Bảng toạ độ bấm của nó là `Y = [285, 390, 490, 590, 605, 705, 805]`
   (`roktracker/kingdom/scanner.py`, `_get_gov_position`), nhưng hai giá trị
   cuối chỉ dùng cho người thứ 998 và 999 của cả bảng 1000. Suốt lần quét nó
   chỉ bấm bốn hàng trên. Đó là lý do `--rows-per-page` mặc định còn 4.

Không dịch ngược tệp thực thi nào; mã nguồn RokTracker là mã mở, đọc thẳng.

Copyright (c) 2021-2022 nikolakis1919<br>
Copyright (c) 2026 mausmeister<br>
Copyright (c) 2022-2026 Cyrexxis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
