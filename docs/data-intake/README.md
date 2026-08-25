# Nạp dữ liệu thô

```
rokfaq-nap-du-lieu.xlsx   bảng tính để điền
chan-dung-1..3.png        160 ảnh chân dung chỉ huy, có đánh số id
```

## Quy trình

```bash
npm i                 # lần đầu, để cài exceljs
npm run intake        # đọc bảng tính, xuất ra content/armory/*.json
npm test              # kiểm tra lại dữ liệu vừa xuất
```

`npm run intake` **không ghi file nào** nếu có lỗi. Nó in ra đúng sheet và đúng
dòng sai, sửa xong chạy lại. Ghi một nửa rồi báo lỗi là cách chắc chắn nhất để
web hiện ra dữ liệu thiếu mà không ai biết là thiếu.

## Bảng tính có gì

| Sheet | Nội dung |
|---|---|
| Hướng dẫn | màu ô, ba luật quan trọng |
| Chỉ huy | **đã điền sẵn 160 id ảnh** — chỉ cần gõ tên vào |
| Kỹ năng | 5 kỹ năng mỗi chỉ huy, kèm 5 mức nâng cấp |
| Tài năng | từng nút trong cây, chỉ số và mức cộng mỗi điểm |
| Trang bị | phần đầu panel: ô, cấp độ, bậc, tài năng đặc biệt |
| Chỉ số trang bị | khối *Thuộc Tính Trang Bị* |
| Biểu trưng | khối *Thuộc Tính Biểu Trưng* I–V |
| Minh văn | |
| Vũ trang | |
| Từ điển chỉ số | 46 khoá — các sheet khác chọn từ đây |
| Tên ảnh | file nào ứng với thứ gì trong game |

Hàng 1 là tiêu đề, hàng 2 là chú thích, hàng 3 là ví dụ. Dữ liệu bắt đầu từ hàng
4. Dòng ví dụ cứ để nguyên — trình nạp bỏ qua slug bắt đầu bằng `vi-du-`.

## Hai chỗ dễ sai nhất

**Cột `bậc trong ảnh` ở sheet Trang bị.** Mọi con số ở hai sheet chỉ số đọc theo
bậc này. Ghi sai bậc thì cả bảng năm bậc lệch, mà nhìn vào không thấy sai chỗ nào.

**Số trắng và số xanh.** Số trắng là giá trị ở bậc đang xem → cột `giá trị nền`.
Số xanh trong ngoặc là mức tăng mỗi lần nâng bậc → cột `mức tăng`. Điền hai số,
web suy ra cả năm bậc.

## Việc nên làm trước nhất

Mở `chan-dung-1.png`, nhìn số vàng dưới mỗi ảnh, gõ tên chỉ huy vào đúng dòng
trong sheet **Chỉ huy**. Làm một lần, mọi trang dùng chung mãi mãi — và cho tới
khi có bản đồ này thì không ai được gán tên chỉ huy vào ảnh theo phỏng đoán.
