# PENDING DOCS — Chưa chốt vào tài liệu

> Quy ước: mỗi thay đổi code chỉ thêm **một dòng** vào bảng dưới đây.
> Không sửa các file docs khác cho tới khi chủ dự án yêu cầu “chốt docs”.
> Khi chốt: đọc bảng này + `git log <mốc chốt>..HEAD`, sửa đúng mục bị ảnh hưởng, xoá các dòng đã chốt, cập nhật mốc bên dưới.

**Chốt gần nhất:** `05ca559` · 28/10/2026 · phiếu kho dùng chung bộ chọn mặt hàng, chốt ca theo món đã xuất, Cài đặt gọn lại và dữ liệu kho chia nhóm.

| Ngày | Phạm vi | Cần chốt vào docs |
|---|---|---|
| 28/10/2026 | P0 toàn vẹn dữ liệu (audit/void/adjust) | Kiểm kê không còn gán `qty` trực tiếp: mỗi dòng lệch tạo phiếu **`kind:'adjust'`** (`rawQty` có dấu) + `stocktakeId`; ô trống = chưa đếm; bắt buộc ≥1 dòng; audit lưu `counted/adjustments/operator`. Xoá phiếu → **vô hiệu hoá** (`status:'voided'`, giữ lịch sử, tính bù tồn), `deleteItem/deletePrep` bị chặn khi đã có giao dịch và **không sửa audits** nữa. `save()` bọc lỗi hết dung lượng; chặn double-submit; chống nhập trùng báo cáo POS (`strHash` + thay thế); bỏ phiếu huỷ khỏi so sánh POS. Migration mới `20261028_integrity_audit_adjust.sql`: `workspace_op_delta` hỗ trợ adjust/void, **áp kiểm tra tồn cho cả owner**, RPC `replace_workspace_state` cho khôi phục JSON. `verify.js` 97 → 106 mục; `sw.js` v18. Cần chốt vào `BUSINESS_RULES` §3/§7, `ARCHITECTURE` §10, `DATABASE_SCHEMA` §3, `TEST_PLAN` §4.3/§4.4, `CURRENT_STATUS`, `README`. |
