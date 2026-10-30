# PENDING DOCS — Chưa chốt vào tài liệu

> Quy ước: mỗi thay đổi code chỉ thêm **một dòng** vào bảng dưới đây.
> Không sửa các file docs khác cho tới khi chủ dự án yêu cầu “chốt docs”.
> Khi chốt: đọc bảng này + `git log <mốc chốt>..HEAD`, sửa đúng mục bị ảnh hưởng, xoá các dòng đã chốt, cập nhật mốc bên dưới.

**Chốt gần nhất:** 30/10/2026 · mốc code `677fe21` · phiếu vị trí (quầy/tủ), mẻ nấu, kiểm kê nháp + chốt phiếu + nhật ký thay đổi + thẻ đối soát, chênh lệch theo kỳ, POS nâng cao (size/topping/đơn huỷ), toàn vẹn dữ liệu `adjust`/`voided`.

Ghi chú của lần chốt này:

- Mốc `05ca559` ghi trước đây nằm trên nhánh `backup/local-acb194a`, không thuộc `main`; mốc đúng của `main` trước lần chốt này là `75c8381` (docs + 106 test). Từ nay ghi mốc theo commit **trên `main`**.
- Đã rà soát ổn định 30/10 và ghi **12 rủi ro** vào `CURRENT_STATUS.md` mục 4 (#18–#29). Chưa sửa code; các mục P0 nằm ở `CURRENT_STATUS.md` mục 5.
- Chủ dự án xác nhận 30/10: **đã áp đủ** migration `20261029` + `20261030` trên Supabase. Vì vậy #19 và #21 là lỗi thật trên bản chạy, không phải giả định.

| Ngày | Phạm vi | Cần chốt vào docs |
|---|---|---|
| 30/10/2026 | Giao diện **Xuất đầu ca** (thẻ dòng hàng) | `.flow-entry-card` **một hàng, cao 50px**: bỏ mã hàng **và bỏ đơn vị sau ô số lượng** (đơn vị đã có ở “Tồn kho”); thứ tự trái→phải **tên · Tồn kho · ô số lượng 44×36 · nút ×** (× sát mép phải, ô ngay bên trái ×); tên dài bị ellipsis; `.flow-entry-list` dùng `grid-template-columns:minmax(0,1fr)` để tên dài không nới rộng thẻ. **Nền thẻ theo loại**, dùng đúng màu đã thống nhất ở bảng Tồn kho: `.flow-entry-raw` = `#f2f7fc`, `.flow-entry-prep` = `#f0f7f2`. **× xác nhận 2 bước**: bấm lần 1 đổi thành “Xoá?” (3 giây), bấm lần 2 mới xoá; bấm nút × khác hoặc quá 3 giây thì huỷ (`resetFlowRemove`). Áp cho `flow-raw`/`flow-sale`/`flow-prep` (Xuất đầu ca, Xuất BTP ra bán, Nấu thành phẩm) vì dùng chung `flowCardRows()`/`addFlowItem()`; `xEsc` cho tên; `aria-label` cho ô số lượng (kèm đơn vị) và nút xoá. **Nút thêm** lên cùng hàng tiêu đề mục 1/2, sát phải, chỉ còn “Thêm nguyên liệu”/“Thêm thành phẩm” (bỏ “＋” và dòng phụ) qua `itemPickerHtml({compact:true})` + `.flow-section-head`/`.flow-picker`; menu chọn vẫn bung và tự canh trong màn hình; nút ở Xuất BTP/Nấu thành phẩm cũng bỏ “＋”. `sw.js` v26; `verify.js` giữ 127 mục. |
