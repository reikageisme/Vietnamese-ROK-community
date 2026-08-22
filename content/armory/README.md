# Dữ liệu kho trang bị

Số liệu ở đây là **dữ liệu, không phải code**. Game vá thì nhập lại, không deploy lại.

## Quy trình

1. **Chụp trong game.** Mỗi bậc một ảnh, chụp rõ bảng chỉ số. Ảnh talent chụp riêng.
2. **Đặt vào `armory-shots/`** ở gốc repo, đặt tên theo mẫu:

   ```
   armory-shots/<slug>__t<bậc>.png          ví dụ  mu-thanh-chien__t4.png
   armory-shots/<slug>__t<bậc>-talent.png   ví dụ  mu-thanh-chien__t4-talent.png
   ```

   Đặt đúng tên là đủ để biết ảnh nào thuộc món nào, bậc nào — không phải giải thích thêm.

3. **Gõ số vào `content/armory/equipment/<slug>.json`**, theo mẫu `_TEMPLATE.json`.
4. **Chạy `npm test`.** Bộ kiểm tra đọc mọi file trong thư mục này và chặn nếu sai.
5. **Chạy `npm run armory:import`** để đổ vào cơ sở dữ liệu. Lệnh này idempotent — chạy lại không nhân đôi dữ liệu.

`armory-shots/` không vào git (ảnh làm phình repo). Bằng chứng lâu dài sẽ nằm ở MinIO.

## Luật bắt buộc

- **Mọi chỉ số phải có trong `stat-definitions.json`.** Khoá lạ bị từ chối chứ không đoán. Chỉ số mới thì thêm vào từ điển trước.
- **Mọi file phải khai `patch`.** Không có ngoại lệ. Đây là thứ giữ cho build lưu tháng trước vẫn mở lại đúng như lúc lưu.
- **Khai `verification` khác `UNVERIFIED` thì bắt buộc kèm `evidence`.** Không có luật này thì "đã kiểm chứng" chỉ là một chữ ai cũng gõ được.
- **Talent có điều kiện phải ghi rõ điều kiện** trong `effect.trigger`. Talent kiểu "khi tấn công thành" không được cộng thẳng vào chỉ số nền — bộ tính tách nó ra cột riêng.

## Ba mức kiểm chứng

| Mức | Nghĩa |
|---|---|
| `UNVERIFIED` | Gõ từ trí nhớ hoặc nguồn thứ cấp. Hiện lên giao diện kèm cảnh báo. |
| `SCREENSHOT` | Có ảnh chụp trong game, đường dẫn ghi ở `evidence`. |
| `CONFIRMED` | Hai người đối chiếu độc lập, hoặc một người đối chiếu hai lần cách nhau. |

Một dòng chỉ số trên bàn thử chỉ đáng tin bằng **nguồn yếu nhất** góp vào nó. Đó là lý do mức này đi thẳng ra giao diện chứ không nằm im trong bảng.

## Không chép từ trang khác

Từng con số là dữ kiện của game, không ai độc quyền. Nhưng bê nguyên cơ sở dữ liệu đã biên soạn của trang khác về thì vừa rủi ro vừa hỏng danh tiếng trong một cộng đồng nhỏ. Lấy số từ trong game — chậm hơn, nhưng kiểm chứng được và là của mình.
