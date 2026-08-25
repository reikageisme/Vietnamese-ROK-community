# Biểu tượng trong game — quy ước tên

Rút từ bản cài Rise of Kingdoms trên máy (`game-assets/`, 89 MB, không vào git).
`scripts/pick-game-assets.mjs` chép sang `public/game/` những file web thật sự
hiển thị. Chạy lại script sau mỗi lần game cập nhật.

## Bảng tra

| Trong game | Tên file | Ghi chú |
|---|---|---|
| Chân dung chỉ huy | `img_icon_HeroProfile_<id>.png` | 168 file, nền trong suốt |
| Khung độ hiếm | `img_icon_HeroProfile_BG{Orange,Purple,Blue,Green}.png` | Huyền thoại / Sử thi / Tinh nhuệ / Cao cấp |
| Loại quân | `btn_BlackSmithsShopSystem{Infantry,Cavalry,Archer,Vehicle,Leadership,Integration}.png` | sáu viên kim cương đỏ |
| Kỹ năng chỉ huy | `img_HeroSkill<n>.png` | đã có sẵn khung vàng |
| Nút tài năng | `img_icon_NewTalent<n>.png`, `img_icon_HeroTalent<n>.png` | |
| Trang bị | `trangbi/img_icon_item_equip_<độ hiếm>_<n>.png` | 1 thường · 2 cao cấp · 3 tinh nhuệ · 4 sử thi · **5 huyền thoại** · 6 giới hạn mùa |
| Minh văn | `img_icon_HeroCarving_<n>.png` | tượng đá trắng |
| Vũ trang | `img_icon_Armament_<n>.png` | |
| Viền avatar | `anhvavien/img_icon_item_<n>.png` | viền hồ sơ, **không phải** trang bị |
| Đội hình | `img_icon_ItemTemplatFormationIcon<n>.png` | bản `…Silver` là bản chưa mở |

## Khung độ hiếm là một lớp riêng

Game xếp một ảnh nền khung lên dưới một ảnh chân dung nền trong suốt. Web làm
đúng như vậy — 168 chỉ huy cần 168 file, không phải 168 × 4 khung:

```css
.hero-portrait {
  background: url("/game/frame/legendary.png") center/contain no-repeat;
}
```

```html
<span class="hero-portrait"><img src="/game/hero/182.png" alt="" /></span>
```

## Còn thiếu: bản đồ id ảnh ↔ tên chỉ huy

`img_icon_HeroProfile_182.png` không tự khai mình là ai. Cần một lượt đối chiếu
một lần, ghi vào `content/armory/commanders.json`, rồi mọi trang dùng chung.

Trước khi có bản đồ đó, **đừng gán tên chỉ huy vào ảnh theo phỏng đoán** — một
cái tên sai gắn vào ảnh sẽ đi theo mọi trang và không ai phát hiện ra.

## Về bản quyền

Đây là tài sản của Lilith Games. Các trang cộng đồng vẫn dùng theo lệ, không
phải theo giấy phép. Trang đã có dòng tuyên bố miễn trừ; nếu Lilith yêu cầu gỡ
thì gỡ.
