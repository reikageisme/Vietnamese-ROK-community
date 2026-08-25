# Kho trang bị — dữ liệu

Thư mục này là **nguồn sự thật** của kho trang bị. Trang `/armory` đọc thẳng từ
đây, không qua cơ sở dữ liệu, nên `git pull` xong là có dữ liệu ngay.

```
stat-definitions.json   từ điển chỉ số — mọi khoá dùng ở nơi khác phải có ở đây
patches.json            phiên bản game
equipment/              mỗi món một file, tên file là slug
equipment/_TEMPLATE.json  mẫu để chép
evidence/               ảnh chụp trong game làm bằng chứng
```

## Cách chép một panel trang bị

Panel trong game cho **hai** số cho mỗi dòng, không cho bảng năm bậc:

```
Phòng thủ bộ binh        +12%  (+4%)
                          ↑      ↑
                        base   perTier
```

Số trắng là giá trị ở bậc đang xem, số xanh là mức tăng mỗi lần nâng bậc. Gõ hai
số đó, ghi bậc đang xem vào `baseTier`, web tự suy ra cả năm bậc.

Gõ hai số thay vì năm là bớt 60% chỗ gõ sai. Đây là lý do chính của cách làm này,
không phải để nhanh tay.

## Hai khối phải để riêng

Panel có hai khối và người chơi tra theo đúng thứ tự đó:

- `baseStats` — khối **Thuộc Tính Trang Bị**, có từ bậc I.
- `iconic` — khối **Thuộc Tính Biểu Trưng**, đánh số I–V. Mỗi bậc mở thêm đúng
  một dòng. Dòng cuối thường là một hiệu ứng **có tên** kèm lời mô tả chứ không
  phải một con số: khi đó bỏ `statKey`, điền `nameVi` và `descriptionVi`.

Gộp hai khối lại là sai cả về hiển thị lẫn về tính toán — dòng biểu trưng chưa mở
thì chưa được cộng vào đâu cả.

## Tài năng đặc biệt

Dòng "Tài năng đặc biệt (Bộ binh)" ở cuối panel là một hệ số nhân có điều kiện,
chỉ có hiệu lực khi chỉ huy mang tài năng cùng loại quân. Web **không** cộng nó
mặc định; có một ô để bật lên xem thử.

Hiện web chỉ nhân nó vào khối Thuộc Tính Trang Bị. Câu trong game không nói rõ có
nhân cả khối Biểu Trưng hay không, nên chưa đoán — và trang có ghi rõ điều đó.
Ai xác nhận được thì sửa `resolveEquipment` trong `src/modules/armory/equipment-model.ts`.

## Trước khi commit

```bash
npm test          # chặn chỉ số lạ, trùng bậc, thiếu bằng chứng
npm run typecheck
```
