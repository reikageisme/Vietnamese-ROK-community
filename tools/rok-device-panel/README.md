# RokViet Device Panel

Bảng điều khiển nội bộ cho dàn 16 điện thoại cắm USB vào server Proxmox. Xem màn hình
từng máy, chạm/vuốt/gõ chữ qua trình duyệt, phát lệnh đồng loạt khi cần, và — phần quan
trọng nhất — **hiệu chỉnh profile bằng cách bấm và kéo thay vì đo pixel bằng tay**.

> Công cụ vận hành nội bộ. Không bao giờ mở ra Internet: ai vào được trang này là
> chạm được vào mọi tài khoản game đang đăng nhập trên cả dàn máy.

## Vì sao cần nó

`CharacterSwitcher` từ chối chạy nếu thiếu fingerprint — đó là thiết kế đúng, nó chặn
thao tác mù. Nhưng nghĩa là mọi màn hình mới, nhất là bản đồ KvK, đều phải hiệu chỉnh
tay: chụp ảnh, mở trình sửa ảnh, đo toạ độ pixel, chia cho chiều rộng, tự tính dhash.

Panel này biến việc đó thành: bấm lên ảnh → ra `[0.2708, 0.5741]`; kéo một khung → ra
`region` kèm `dhash` đã tính sẵn. Giá trị sinh ra dùng đúng hàm
`rok_lab.imaging.difference_hash` mà agent gọi lúc chạy thật, nên **khớp tuyệt đối**
với thứ `CharacterSwitcher` sẽ so lúc `wait-screen`.

## Chức năng

**Lưới** — 16 ô, mỗi ô một máy, làm mới luân phiên. Trạng thái ADB, pin, thời gian chụp,
lỗi gần nhất. Tick chọn máy để đưa vào nhóm phát lệnh.

**Máy** — ảnh lớn theo luồng MJPEG. Bấm để chạm, kéo để vuốt. Phím Back/Home/Recents/
Enter/Xoá/Vol/Đánh thức. Gửi chuỗi chữ. Mở hoặc tắt hẳn game. Tải ảnh PNG gốc.

**Hiệu chỉnh** — chuyển chuột sang chế độ chọn vùng, kéo một khung rồi lưu thành vùng
OCR hoặc dấu vân màn hình. Bảng "màn hình khớp lúc này" hiện đúng khoảng cách Hamming
mà agent sẽ thấy, nên biết ngay route sẽ đi qua hay dừng.

**Đồng bộ** — phát một lệnh tới nhiều máy cùng lúc. Mặc định khoá, phải bật công tắc
riêng và tự tắt sau 10 phút.

## Chạy trên Proxmox

### Chọn VM, đừng chọn LXC

Cho USB, **VM với PCIe passthrough cả controller USB** đáng tin hơn LXC nhiều. Trong LXC,
bind-mount `/dev/bus/usb` sẽ thành cũ khi điện thoại rút ra cắm lại — mà với 16 máy chạy
liên tục thì chuyện đó xảy ra hàng ngày. VM xử lý được hotplug ở tầng kernel.

Trong Proxmox: chọn VM → Hardware → Add → PCI Device → chọn USB controller (không phải
từng thiết bị USB). Cài Ubuntu Server + Docker vào VM đó.

### Dùng hub USB có nguồn riêng

16 điện thoại rút điện từ hub không nguồn sẽ gây sụt áp, và biểu hiện là thiết bị nhảy
`offline` ngẫu nhiên — trông y hệt lỗi phần mềm nhưng không phải. Đây là nguyên nhân
phổ biến nhất khi dựng dàn nhiều máy.

### Cài đặt

```bash
cd tools/rok-device-panel
cp .env.example .env
openssl rand -hex 24        # dán vào PANEL_TOKEN trong .env

docker compose up -d --build
docker compose logs -f panel
```

Từ máy quản trị:

```bash
ssh -N -L 5100:127.0.0.1:5100 -L 5037:127.0.0.1:5037 rokops@IP_SERVER
```

Mở `http://localhost:5100/?token=<PANEL_TOKEN>`. Token được lưu vào `sessionStorage`
và tự gắn vào mọi yêu cầu sau đó.

### Cấp quyền USB lần đầu

Lần đầu chạy, mỗi máy hiện hộp thoại *Allow USB debugging?*. Tick **Always allow from
this computer** rồi bấm Allow trên từng máy. Khoá RSA nằm trong volume `adb_keys` nên
lần sau khởi động lại container không phải làm lại — miễn là đừng xoá volume đó.

Nếu thiết bị hiện `no permissions`, host thiếu udev rule:

```bash
# trên VM chứa Docker, không phải trong container
sudo tee /etc/udev/rules.d/51-android.rules >/dev/null <<'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="04e8", MODE="0666", GROUP="plugdev"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

`04e8` là Samsung. Máy hãng khác thì tra bằng `lsusb`.

## Quan trọng: chỉ được có một adb server

Đây là chỗ dễ hỏng nhất khi chạy chung với scanner. **Hai adb server cùng giành
`/dev/bus/usb` sẽ đá nhau**, và triệu chứng là thiết bị nhảy offline ngẫu nhiên giữa
lúc quét — rất khó lần ra nguyên nhân.

Container này đã chạy adb server ở chế độ lắng nghe TCP. Agent quét phải **trỏ vào đúng
server đó** thay vì tự khởi động server riêng:

```bash
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
python -m rok_lab.cli agent-run config/agent.local.json
```

Nếu agent chạy ở máy khác, dùng IP Tailscale và sửa cổng publish trong
`docker-compose.yml` cho đúng — nhưng **không mở 5037 ra Internet**, adb server không
có xác thực.

## Băng thông USB là giới hạn thật

16 máy dùng chung một đường USB của host. Một ảnh `screencap -p` 1080p nặng khoảng
1,5–2,5 MB, nên chụp cả dàn ở tốc độ cao sẽ bão hoà USB 2.0 và **cướp băng thông của
scanner**.

Vì vậy panel chụp luân phiên. Với mặc định `GRID_INTERVAL_SECONDS=5`, cả 16 máy tiêu
tốn khoảng 6–8 MB/s — an toàn. Máy nào chụp chậm sẽ tự bị giãn chu kỳ, máy lỗi bị lùi
theo cấp số nhân.

Khi scanner đang chạy đợt quét quan trọng, bật **Tạm dừng chụp** ở thanh trên để trả
toàn bộ băng thông lại cho nó.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `GRID_INTERVAL_SECONDS` | 5 | Chu kỳ làm mới mỗi ô lưới |
| `FOCUS_INTERVAL_SECONDS` | 0.8 | Chu kỳ cho máy đang xem |
| `CAPTURE_WORKERS` | 3 | Số máy chụp song song |
| `SLOW_CAPTURE_SECONDS` | 3 | Quá ngưỡng này thì giãn chu kỳ máy đó |
| `GRID_WIDTH` / `FOCUS_WIDTH` | 420 / 1280 | Bề rộng ảnh gửi về trình duyệt |
| `BROADCAST_ENABLED` | true | Đặt `false` để khoá cứng chế độ đồng bộ |

## Về chế độ đồng bộ

Tính năng này có ích thật cho việc cài đặt: đăng nhập 16 tài khoản, bấm qua màn hình
cập nhật, đánh thức cả dàn. Nhưng cần nói thẳng một điều.

**Nhiều tài khoản nhận thao tác giống hệt nhau trong cùng một giây chính là mẫu hành vi
mà hệ thống chống gian lận tìm kiếm.** Tài liệu của chính dự án bạn đã ghi *"không phải
bot farm và không có cơ chế né phát hiện"* — chế độ đồng bộ đứng gần ranh giới đó hơn
bất cứ thứ gì khác trong repo.

Rủi ro cụ thể không phải đạo đức mà là kinh doanh: nếu tài khoản bị khoá, dịch vụ có thu
tiền của bạn đứt cho Kingdom đó, và lỗi P0-04 trong báo cáo rà soát nghĩa là đơn hàng
sẽ nằm hàng đợi vĩnh viễn chứ không tự hoàn tiền.

Vì vậy panel mặc định khoá chế độ này, bắt bật công tắc riêng, hỏi xác nhận, và tự tắt
sau 10 phút. Dùng cho cài đặt và hiệu chỉnh; việc thu thập dữ liệu cứ để scanner theo
lịch làm — nó quét từng máy một, và đó mới là hành vi bình thường.

Muốn khoá hẳn, không cho ai bật từ giao diện: đặt `BROADCAST_ENABLED=false`.

## Quy trình hiệu chỉnh bản đồ KvK

1. Mở tab **Máy**, chọn một điện thoại, dùng nút **Mở** để bật game.
2. Điều khiển tay tới đúng màn hình cần dạy cho agent.
3. Sang tab **Hiệu chỉnh**, chuyển chuột sang **Chọn vùng**.
4. Kéo một khung quanh phần *không đổi* của màn hình — tiêu đề, khung viền, biểu tượng
   cố định. **Đừng chọn vùng có số liệu hoặc tên người chơi**, chúng thay đổi liên tục
   và dhash sẽ không khớp lần sau.
5. Đặt tên màn hình, ví dụ `kvk-map`, bấm **Lưu dấu vân**.
6. Quay lại **Chạm / vuốt**, bấm vào từng nút cần dạy, đặt tên như `kvk.map.zoom-out`
   rồi **Lưu điểm**.
7. Bảng *Màn hình khớp lúc này* phải hiện `✓` với khoảng cách nhỏ. Nếu khoảng cách nhảy
   loạn giữa các lần chụp, vùng bạn chọn có phần động — chọn lại chỗ khác.
8. **Tải JSON** để xem lại, rồi **Ghi đè profile gốc** khi đã ưng. Bản cũ tự lưu thành
   `.bak`.
9. Dán các bước vào `scanRoutes` trong Fleet Control theo dạng
   `{"action":"wait-screen","screen":"kvk-map"}` và `{"action":"tap","point":"kvk.map.zoom-out"}`.

## Giới hạn đã biết

- Ảnh là `screencap`, không phải video thật. Máy đang xem đạt khoảng 1–2 khung/giây —
  đủ để điều khiển và hiệu chỉnh, không đủ để xem thao tác mượt. Muốn mượt thì phải
  chuyển sang scrcpy-server, đắt hơn nhiều về công sức và băng thông.
- `input text` không gõ được tiếng Việt có dấu. Dùng cho email, mật khẩu, mã số.
- Panel không đọc database của web. Nó làm việc trực tiếp với ADB, nên chạy được kể cả
  khi Postgres hay Fleet Control đang tắt — cố ý như vậy để còn dùng được lúc sự cố.
