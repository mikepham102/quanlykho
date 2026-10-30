# PENDING DOCS — Chưa chốt vào tài liệu

> Quy ước: mỗi thay đổi code chỉ thêm **một dòng** vào bảng dưới đây.
> Không sửa các file docs khác cho tới khi chủ dự án yêu cầu “chốt docs”.
> Khi chốt: đọc bảng này + `git log <mốc chốt>..HEAD`, sửa đúng mục bị ảnh hưởng, xoá các dòng đã chốt, cập nhật mốc bên dưới.

**Chốt gần nhất:** `05ca559` · 28/10/2026 · phiếu kho dùng chung bộ chọn mặt hàng, chốt ca theo món đã xuất, Cài đặt gọn lại và dữ liệu kho chia nhóm.

| Ngày | Phạm vi | Cần chốt vào docs |
|---|---|---|
| 29/10/2026 | P1.3 mẻ nấu (batch) | `db.batches` + `addBatch()`/`nextBatchCode()` (mã `ME-YYYYMMDD-NNN`), lưu bán thành phẩm, sản lượng thực tế/kế hoạch, người làm (`actorLabel`), `startedAt`/`expiresAt` theo `shelf` giờ, `consumption[]`, `ops[]`; phiếu `prep` và các `stockout` khi nấu được gắn `batchId/batchCode`. Trang Công thức thêm bảng **Mẻ nấu gần đây** (mã, sản lượng, thời điểm, người làm, hạn dùng, tần suất hôm nay) + thẻ mobile. `verify.js` 114 → 117 mục; `sw.js` v20. |
| 28/10/2026 | P0 toàn vẹn dữ liệu (audit/void/adjust) | Kiểm kê không còn gán `qty` trực tiếp: mỗi dòng lệch tạo phiếu **`kind:'adjust'`** (`rawQty` có dấu) + `stocktakeId`; ô trống = chưa đếm; bắt buộc ≥1 dòng; audit lưu `counted/adjustments/operator`. Xoá phiếu → **vô hiệu hoá** (`status:'voided'`, giữ lịch sử, tính bù tồn), `deleteItem/deletePrep` bị chặn khi đã có giao dịch và **không sửa audits** nữa. `save()` bọc lỗi hết dung lượng; chặn double-submit; chống nhập trùng báo cáo POS (`strHash` + thay thế); bỏ phiếu huỷ khỏi so sánh POS. Migration `20261028_integrity_audit_adjust.sql`: `workspace_op_delta` hỗ trợ adjust/void, **áp kiểm tra tồn cho cả owner**, RPC `replace_workspace_state`. `verify.js` 97 → 106 mục; `sw.js` v18. |
| 29/10/2026 | P1.1 variance engine + P1.2 POS nâng cao | **Variance**: `theoreticalOpening()` neo theo kiểm kê gần nhất trước kỳ, `varianceReport(from,to)` trả đầu kỳ/nhập/nấu/xuất ròng/điều chỉnh/lý thuyết/thực tế/lệch; bảng có chọn kỳ + dòng tổng kết; `exportVariance` dùng cùng engine (bỏ công thức tautology, bỏ `db.audits.at(-1)`). **POS**: `db.posModifiers` + `findPosModifier/modifierConsumption` (khớp tên & bí danh không dấu), cột Size/Topping/Trạng thái tự nhận diện, dòng huỷ/hoàn bị bỏ qua (regex không khớp “Hoàn thành”), import lưu `cancelled/modifiers/modifierMissing`; UI **Cài đặt → Topping & tuỳ chọn POS**. `verify.js` 106 → 114 mục; `sw.js` v19. |
