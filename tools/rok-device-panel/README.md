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

**Máy** — hình chạy bằng **H.264 lấy từ bộ mã hoá phần cứng** của chính điện thoại,
30–60 khung/giây. Bấm để chạm, kéo để vuốt. Phím Back/Home/Recents/Enter/Xoá/Vol/
Đánh thức. Gửi chuỗi chữ. Mở hoặc tắt hẳn game. Tải ảnh PNG gốc.

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

Rule phải đặt ở nơi **kernel tạo ra device node**, tức host Proxmox — không phải trong
LXC hay trong container Docker:

```bash
# trên host pve
cat > /etc/udev/rules.d/51-android.rules <<'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="04e8", MODE="0666"
EOF
udevadm control --reload-rules
udevadm trigger --subsystem-match=usb --action=add
```

`04e8` là Samsung. Máy hãng khác thì tra bằng `lsusb`.

Đừng làm theo gợi ý "thêm user vào nhóm plugdev" trong thông báo lỗi của adb — nhóm
không ánh xạ qua namespace của LXC unprivileged, chỉ có `MODE="0666"` mới ăn.

### Nếu chạy trong LXC thay vì VM

Cần thêm vào `/etc/pve/lxc/<CTID>.conf` trên host pve:

```
lxc.cgroup2.devices.allow: c 189:* rwm
lxc.mount.entry: /dev/bus/usb dev/bus/usb none bind,optional,create=dir
```

Bind cả thư mục chứ không bind từng node: mỗi lần điện thoại reset USB nó nhận số
device mới, node cũ biến mất và node mới sinh ra.

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

## Vì sao hình lại mượt

Ban đầu panel dùng `screencap`, và nó có trần cứng ở 2–3 khung/giây: điện thoại phải
tự nén một ảnh PNG 1080p cho mỗi khung, mất 250–400ms. Không server nào chữa được —
việc đó xảy ra trên máy Android, không phải trên host.

Bản hiện tại dùng `screenrecord`, tức chính bộ mã hoá H.264 phần cứng trong con chip:

| | screencap | screenrecord |
|---|---|---|
| Nén ở đâu | CPU điện thoại | Bộ mã hoá phần cứng |
| Nhịp | 2–3/giây | **30–60/giây** |
| Băng thông USB | ~4–5 MB/s | **~0,5 MB/s** |
| Độ trễ hình | ~600ms | **50–100ms** |

Nhiều khung hình hơn *mà* tốn ít băng thông hơn, vì H.264 chỉ truyền phần khác biệt
giữa các khung thay vì gửi lại toàn bộ màn hình mỗi lần.

Không dùng giao thức scrcpy vì nó đổi theo từng phiên bản — số socket, thứ tự header,
cách đóng gói khung. `screenrecord` có sẵn trong Android, dùng đúng bộ mã hoá đó,
nhưng chỉ trả về một luồng byte Annex-B thẳng ra stdout, không có gì để đoán sai.

Giới hạn: `screenrecord` tự dừng sau 180 giây. Panel chạy lại tiến trình ở giây thứ
170 và báo trình duyệt dựng lại bộ giải mã, nên bạn chỉ thấy một nhịp khựng rất ngắn.
Máy nào không chạy được `screenrecord` sẽ tự rơi về chế độ ảnh tĩnh, không báo lỗi chặn.

### Hiệu chỉnh vẫn dùng ảnh tĩnh, và đó là cố ý

Khi bạn chuyển sang **Chọn vùng**, panel tự tắt video và quay về `screencap`.

Bắt buộc phải vậy: `dhash` băm pixel thật, mà H.264 nén mất dữ liệu. dhash của một
khung video **khác** dhash của ảnh PNG mà agent chụp lúc chạy thật, nên fingerprint
lấy từ video sẽ trượt ngay khi `wait-screen` chạy. Ai "tối ưu" chỗ này bằng cách lấy
luôn khung video sẽ phá hỏng toàn bộ profile mà không hiểu vì sao.

Các endpoint hiệu chỉnh cũng tự chụp ảnh mới theo yêu cầu, nên dù vòng `screencap`
đang nghỉ thì `dhash`, xem trước vùng và bảng đối chiếu vẫn luôn dùng ảnh đúng thời điểm.

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
| `FOCUS_INTERVAL_SECONDS` | 0 | Chu kỳ ảnh tĩnh cho máy đang xem (0 = liên tục) |
| `CAPTURE_WORKERS` | 3 | Số máy chụp song song |
| `SLOW_CAPTURE_SECONDS` | 3 | Quá ngưỡng này thì giãn chu kỳ máy đó |
| `GRID_WIDTH` / `FOCUS_WIDTH` | 400 / 960 | Bề rộng ảnh tĩnh gửi về trình duyệt |
| `BROADCAST_ENABLED` | true | Đặt `false` để khoá cứng chế độ đồng bộ |
| `H264_ENABLED` | true | Đặt `false` để luôn dùng ảnh tĩnh |
| `H264_BITRATE` | 6000000 | Bitrate luồng hình, 6 Mbps ≈ 0,75 MB/s |
| `H264_SIZE` | trống | Để trống là giữ nguyên độ phân giải và hướng thật |

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

- **Độ trễ chạm vẫn khoảng 200–400ms.** Hình đã mượt nhưng cú chạm thì chưa, vì
  `input tap` của Android khởi động một JVM cho mỗi lần gọi. Panel hiện vẽ một gợn
  sóng ngay tại điểm bấm để bạn biết lệnh đã được ghi nhận, nhưng máy vẫn đáp sau
  chừng đó thời gian. Sửa triệt để cần `sendevent` hiệu chỉnh riêng cho từng đời
  máy — và làm sai thì cú chạm rơi nhầm chỗ trên tài khoản game thật, nên chưa làm.
- Trình duyệt phải hỗ trợ WebCodecs (Chrome/Edge/Cốc Cốc bản mới). Không có thì tự
  rơi về ảnh tĩnh.
- `input text` không gõ được tiếng Việt có dấu. Dùng cho email, mật khẩu, mã số.
- Panel không đọc database của web. Nó làm việc trực tiếp với ADB, nên chạy được kể cả
  khi Postgres hay Fleet Control đang tắt — cố ý như vậy để còn dùng được lúc sự cố.
