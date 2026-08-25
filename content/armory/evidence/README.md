# Ảnh chụp làm bằng chứng

Bỏ ảnh chụp panel trong game vào đây, đặt tên theo `slug` của món đồ:

```
evidence/ao-choang-hy-vong.png
evidence/ao-choang-hy-vong__bac-5.png
```

Rồi trỏ tới nó trong file dữ liệu:

```json
"verification": "SCREENSHOT",
"evidence": "evidence/ao-choang-hy-vong.png"
```

Có luật này vì `npm test` **từ chối** file nào khai `SCREENSHOT` hoặc `CONFIRMED`
mà không chỉ ra ảnh. Không có luật đó thì "đã kiểm chứng" chỉ là một chữ ai cũng
gõ được, và một con số sai trông y hệt một con số đúng.

Ảnh không lên web — chúng là hồ sơ để người sau đối chiếu lại số đã nhập.
