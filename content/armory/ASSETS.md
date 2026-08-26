# Biểu tượng trong game — quy ước tên

Rút từ bản cài Rise of Kingdoms trên máy (`game-assets/`, không vào git).

```bash
npm run pick-assets                 # chép ảnh cần dùng sang public/game/
npm run pick-assets -- --portraits  # thêm toàn bộ chân dung chỉ huy
npm run scan-assets                 # đọc cây thư mục đội phân loại → commanders-from-assets.json
```

`pick-assets` **tìm theo tên file, không theo đường dẫn**. Đội phân loại sắp xếp
lại thư mục là chuyện thường xuyên; bản trước hard-code `game-assets/all/` và đã
chết ngay lần sắp xếp đầu tiên. Tên file thì game đặt, không ai đổi.

## Bảng tra

| Trong game | Tên file | Ghi chú |
|---|---|---|
| Chân dung chỉ huy | `img_icon_HeroProfile_<id>.png` | ~160 file, nền trong suốt |
| Nền độ hiếm | `img_icon_HeroProfile_BG{Orange,Purple,Blue,Green}.png` | Huyền thoại / Sử thi / Tinh nhuệ / Cao cấp |
| Viền độ hiếm | `img_icon_HeroProfile_BGMask{,_Orange,_pink}.png` | xếp **trên** chân dung |
| Tượng chỉ huy | `img_icon_HeroCarving_<n>.png` | tượng đá — **không phải** minh văn |
| Loại quân | `btn_BlackSmithsShopSystem{Infantry,Cavalry,Archer,Vehicle,Leadership,Integration}.png` | sáu viên kim cương đỏ |
| Kỹ năng chỉ huy | `img_HeroSkill<n>.png`, `img_WakeUpHeroSkill<n>.png` | đã có sẵn khung vàng |
| Nút tài năng | `img_icon_NewTalent<n>.png`, `img_icon_HeroTalent<n>.png` | |
| Trang bị | `img_icon_item_equip_<độ hiếm>_<n>.png` | 1 thường · 2 cao cấp · 3 tinh nhuệ · 4 sử thi · **5 huyền thoại** · 6 giới hạn mùa |
| Khung ô trang bị | `img_EquipSlotSelectFX.png` | hình thoi phát sáng |
| Cột trang bị | `img_EquipBtnSelectFX4.png` | ba hình thoi chồng — đúng thứ tự các ô |
| Vũ trang | `img_icon_Armament_<n>.png` | xem ghi chú bên dưới |
| Đội hình | `img_ItemTemplatFormationIcon<n>.png` | bản `…Silver` là bản chưa mở |
| Viền avatar | `img_icon_item_<n>.png` (thư mục `anhvavien`) | viền hồ sơ, **không phải** trang bị |

## Ba lớp của một ô chỉ huy

Game xếp ba lớp; web làm y hệt, nên 160 chỉ huy cần 160 file chứ không phải 160 × 4:

```css
.hero { background: url("/game/frame/legendary.png") center/contain no-repeat; }
```
```html
<span class="hero">
  <img src="/game/hero/182.png" alt="" />
  <img class="ring" src="/game/frame/ring-gold.png" alt="" />
</span>
```

## Tám ô trang bị xếp theo mảng hình thoi

```
            Mũ
           Ngực
   Vũ khí       Găng tay
           Chân
 Phụ kiện 1     Phụ kiện 2
           Giày
```

Cột giữa chồng đỉnh chạm đỉnh; hai cặp bên nêm vào khe. Toạ độ nằm trong
`RIG` ở bản mẫu `docs/mockups/build-lab.html`.

## Hai chỗ chưa chắc — cần xác nhận

1. **Ảnh minh văn.** Thư mục `Trí phân loại/tướng/minh văn` đang chứa
   `img_icon_Armament_*`, mà trong game đó là bảng **Chọn Vũ Trang**. Minh văn
   là thứ khác. Chưa rõ ảnh minh văn thật tên gì.
2. **Viền huyền thoại.** Đang dùng `BGMask` (viền vàng mảnh) cho tướng cam.
   Còn `BGMask_Orange` là viền trắng bạc dày hơn. Cần đối chiếu với game.

## Chép ảnh của chỉ huy đã nhận diện

```bash
npm run pick-assets -- --commanders
```

Chỉ chép ảnh của chỉ huy **đã có id ảnh chân dung** trong `commanders-from-assets.json`.
Chép hết ~600 ảnh kỹ năng là thêm ~30 MB vào git, mà phần lớn trong số đó chưa gắn được
với ai. Danh sách lớn dần theo đúng nhịp đội phân loại xong từng tướng.

Trình chỉ mục nhận cả tiền tố "Bản sao của " mà Windows tự thêm khi chép file trong cùng
thư mục. Không có luật đó thì bốn ảnh kỹ năng của Tôn Tử P lặng lẽ biến mất khỏi web.

## Về bản quyền

Đây là tài sản của Lilith Games. Các trang cộng đồng vẫn dùng theo lệ, không
phải theo giấy phép. Trang đã có dòng tuyên bố miễn trừ; Lilith yêu cầu gỡ thì gỡ.
