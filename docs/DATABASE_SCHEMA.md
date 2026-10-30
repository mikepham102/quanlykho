# DATABASE SCHEMA — Mô hình dữ liệu thật

> Cập nhật: 30/10/2026. Nguồn sự thật: `index.html` + migration mới nhất `supabase/migrations/20261030_stocktake_drafts.sql`.

## 1. Bảng trên Supabase

### `profiles`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | Khóa chính, trùng `auth.users.id`. |
| `email` | text | Email đăng nhập. |
| `role` | text | `owner` \| `manager` \| `employee`. |
| `created_at` | timestamptz | Mặc định `now()`. |

Dùng cho phân quyền. RLS bật; người dùng chỉ đọc được hồ sơ của mình và workspace.

### `workspace_state`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid | Một bản ghi duy nhất cho cả quán. |
| `state` | jsonb | Toàn bộ dữ liệu ứng dụng (xem mục 2). |
| `revision` | int | Tăng mỗi lần ghi, dùng phát hiện ghi đè. |
| `updated_at` | timestamptz | Thời điểm ghi cuối. |

> Không có bảng riêng cho mặt hàng, phiếu kho hay món POS. Tất cả nằm trong `state`. `schema.sql` ở thư mục gốc là **mô hình quan hệ tham khảo ban đầu, không được chạy** và app không đọc.

### Các RPC

| RPC | Tham số | Trả về |
|---|---|---|
| `current_workspace_role` | — | Vai trò của người đang đăng nhập. |
| `load_workspace_state` | — | `jsonb` state hiện tại (hoặc rỗng nếu chưa có). |
| `save_workspace_state` | `p_state jsonb` | Số revision mới; lỗi nếu sai quyền, revision cũ, phiếu không hợp lệ hoặc tồn lệch khỏi tổng phiếu. |
| `replace_workspace_state` | `p_state jsonb` | Số revision mới; **chỉ owner**, dùng khi khôi phục JSON, ghi thêm `_restoredBy`/`_restoredAt`. |
| `list_workspace_users` | — | Danh sách hồ sơ (chỉ chủ quán). |
| `change_workspace_role` | `p_user_id`, `p_role` | Cập nhật vai trò (chỉ chủ quán). |

`workspace_op_delta(jsonb)` không phải RPC cho client: là hàm SQL tính tác động tồn của một phiếu, dùng bên trong `save_workspace_state`.

Các bất biến server thực thi trong `save_workspace_state` (áp cho **mọi** vai trò, kể cả owner):

1. `_revision` phải khớp bản đang lưu (chống ghi đè).
2. `items`/`ops` phải là mảng.
3. `qty` của từng mặt hàng phải bằng `qty cũ + tổng chênh lệch phiếu` (sai số 0,000001); Δ âm làm tồn < 0 bị chặn.
4. Với non-owner: mọi trường của `items` trừ `qty`/`at` không được đổi; `ops` chỉ được thêm phiếu đúng loại và đúng nhóm hàng; `audits` chỉ được thêm phiếu `draft` do chính mình tạo; các khóa khác lấy từ bản cũ trên server.

Edge Function `invite-user` tạo tài khoản; chỉ nơi đây dùng `service_role`.

## 2. Cấu trúc `state` (JSONB)

```jsonc
{
  "brand":        { "name": "Mộc Inventory", "branch": "…", "logo": "data:image/…" },
  "pricing":      Pricing,        // cấu hình giá đề xuất (xem mục Pricing bên dưới)
  "items":        [ Item ],       // nguyên liệu thô + bán thành phẩm
  "pos":          [ Dish ],       // món bán trên POS
  "ops":          [ Operation ],  // sổ phiếu kho
  "imports":      [ PosImport ],  // file POS đã nhập
  "audits":       [ Audit ],      // các lần kiểm kê (draft | approved)
  "locations":    [ { "id": "loc_bar", "name": "Quầy bar" } ],
  "batches":      [ Batch ],      // mẻ nấu
  "posModifiers": [ PosModifier ],// topping / tuỳ chọn POS
  "auditTrail":   [ AuditLog ],   // nhật ký thay đổi cấu hình
  "suppliers":    [ "string" ],
  "categories":   [ "string" ],
  "favorites":    { "raw": ["id"], "prep": ["id"] },
  "periodStart":  1761000000000,  // mốc bắt đầu kỳ báo cáo
  "_revision":    42,
  "_restoredBy":  "uuid",         // chỉ có sau khi khôi phục JSON qua replace_workspace_state
  "_restoredAt":  "2026-10-30T…"
}
```

### `Pricing` (cấu hình giá đề xuất, `db.pricing`)

```jsonc
{
  "wastePct": 3,                // % hao hụt nguyên liệu cộng vào giá vốn
  "opexMonthly": 0,             // chi phí vận hành mỗi tháng (đ)
  "depreciationMonthly": 0,     // khấu hao thiết bị mỗi tháng (đ)
  "cupsMonthly": 0,             // số ly bán dự kiến mỗi tháng, dùng để chia opex/khấu hao
  "vatPct": 8,                  // VAT để bóc tách khi hiển thị, không dùng trong công thức
  "foodCostStore": 30,          // Food Cost mục tiêu tại quán (%)
  "profitStore": 20,            // lợi nhuận mong muốn tại quán (%)
  "appCommission": 25,          // phí sàn giao đồ ăn (%)
  "appOtherFee": 4.5,           // phí thanh toán/quảng cáo/thuế sàn (%)
  "appPromoDiscount": 0,        // chiết khấu khuyến mãi bình quân (%)
  "appProfit": 25,              // lợi nhuận mong muốn trên app (%)
  "appMode": "separate",        // "separate" | "same" (bằng giá tại quán)
  "roundStep": 10000,           // bước làm tròn (đ)
  "roundTail": 9000,            // đuôi giá (đ), luôn nhỏ hơn roundStep
  "roundMin": 9000              // giá tối thiểu (đ)
}
```

`db.pricing` không bắt buộc phải có trong JSON: khi nạp (`index.html`, ngay sau `db=…`) hệ thống chạy `db.pricing = sanitizePricing(db.pricing)`, tự bù mặc định và kẹp giá trị sai. Không có bảng Supabase riêng — cấu hình giá đi kèm `workspace_state.state`.

### `Item` (nguyên liệu thô và bán thành phẩm)

```jsonc
{
  "id": "uuid",
  "code": "NLTR001",        // duy nhất toàn bộ items, không phân biệt hoa/thường
  "name": "Trà đen",
  "type": "raw",            // "raw" | "prep"
  "cat": "Trà",             // prep luôn là "Bán thành phẩm"
  "unit": "g",              // đơn vị quản lý kho
  "qty": 1250,              // tồn hiện tại
  "min": 500,               // ngưỡng tối thiểu
  "cost": 180000,           // giá nhập trên 1 đơn vị kho (raw)
  "conversionUnit": "ml",   // tùy chọn: đơn vị dùng trong BOM
  "conversionQty": 750,     // tùy chọn: số đơn vị dùng trên 1 đơn vị kho
  "shelf": 24,              // prep: hạn dùng (giờ)
  "outputQty": 2000,        // prep: sản lượng 1 mẻ
  "recipe": [ { "item": "itemId", "qty": 200 } ], // prep: nguyên liệu cho 1 mẻ
  "at": { "loc_bar": 300 }  // số đang ở quầy/tủ — DẪN XUẤT từ phiếu, không phải tồn
}
```

Quy ước đơn vị: nếu có `conversionUnit`/`conversionQty`, BOM ghi theo đơn vị dùng (`ml`) và được quy đổi khi trừ kho (`ml → chai`). Không có thì BOM dùng chính `unit`.

### `Dish` (món POS)

```jsonc
{
  "id": "uuid",
  "code": "TS001",          // mã món, duy nhất theo normalizePosKey
  "name": "Trà sữa trân châu",
  "size": "L",
  "price": 35000,
  "bom": [ { "item": "itemId", "qty": 120 } ]   // định lượng 1 ly
}
```

### `Operation` (phiếu kho)

```jsonc
{
  "id": "uuid",
  "kind": "stockin",        // xem bảng loại bên dưới
  "day": "2026-10-28",      // ngày nghiệp vụ (dùng để chốt ca, đối soát)
  "date": "2026-10-28T03:12:00.000Z",
  "name": "Trà đen · Nhập hàng",
  "qty": "+ 500 g",         // chuỗi hiển thị
  "rawQty": 500,            // số dùng để tính toán (adjust: có dấu)
  "itemId": "uuid",
  "ref": "Nhà cung cấp A",
  "createdBy": "uuid",      // gắn tự động khi đồng bộ
  "createdByEmail": "a@b.c",

  // tuỳ chọn theo loại nghiệp vụ
  "locationId": "loc_bar",  // phiếu vị trí
  "batchId": "uuid",        // phiếu nấu / xuất nguyên liệu của một mẻ
  "batchCode": "ME-20261030-001",
  "stocktakeId": "uuid",    // phiếu adjust sinh từ kiểm kê

  // vết sửa / huỷ
  "status": "voided",       // vắng mặt = hiệu lực
  "voidedAt": "2026-10-30T…",
  "voidedBy": "email",
  "voidReason": "Người dùng vô hiệu hoá phiếu",
  "editedAt": "2026-10-30T…",
  "editedBy": "email",
  "history": [ { "at": "…", "by": "email", "before": { "rawQty": 400 } } ]
}
```

| `kind` | Nhãn | Tác động tồn |
|---|---|---|
| `stockin` | Nhập kho | `+ rawQty` |
| `stockout` | Xuất thô | `− rawQty` |
| `prep` | Nấu thành phẩm | `+ rawQty` (BTP), đồng thời sinh `stockout` cho từng nguyên liệu |
| `sale_issue` | Đưa BTP ra quầy | `− rawQty` (đã trừ kho ngay) |
| `sale_return` | Thu hồi cuối ca | `+ rawQty` |
| `sale_waste` | Hủy cuối ca | `0` (đã trừ lúc `sale_issue`) |
| `waste` | Hao hụt | `− rawQty` |
| `adjust` | Điều chỉnh kiểm kê | `+ rawQty` (có dấu; thiếu = âm) |
| `issue_location` | Xuất ra quầy/tủ | `− rawQty` (đồng thời `+` tại vị trí) |
| `return_location` | Trả từ quầy/tủ về kho | `+ rawQty` (đồng thời `−` tại vị trí) |
| `use_location` | Dùng tại quầy/tủ | `0` (chỉ `−` tại vị trí) |

Phiếu có `status:'voided'` được `workspace_op_delta` trả về `0`, nên không còn tác động tồn dù vẫn nằm trong lịch sử. `adjust` không thể bị vô hiệu hoá.

### `PosImport`

```jsonc
{
  "id": "uuid",
  "filename": "pos-28-10.csv",
  "sheet": "",
  "date": "2026-10-28",
  "dateEnd": "2026-10-28",
  "total": 480,                  // tổng ly bán
  "consumed": 12,                // số mặt hàng được quy đổi
  "unmapped": 2,                 // số dòng không khớp món nào
  "unmappedRows": [ { "name": "…", "qty": 3 } ],
  "consumptions": { "itemId": 1250.5 },  // tiêu thụ lý thuyết theo đơn vị kho
  "consumptionUnit": "stock",
  "rows": [ { "name": "…", "code": "…", "size": "L", "mods": "Trân châu", "qty": 10 } ],
  "cancelled": 3,                   // số dòng bị bỏ vì trạng thái huỷ hoặc số lượng âm
  "modifiers": { "Trân châu": 12 }, // số lượt topping đã khớp
  "modifierMissing": [ "Thạch dừa" ],// topping không khớp db.posModifiers
  "hash": "…"                       // strHash để phát hiện nhập trùng
}
```

Nhập POS **không** thay đổi tồn kho; chỉ dùng để đối soát.

### `Audit`

```jsonc
{
  "id": "uuid",                     // dùng làm stocktakeId
  "date": "2026-10-30T14:00:00.000Z",
  "counts": { "itemId": 1234 },     // số đếm thực tế (ô trống = không có khóa)
  "system": { "itemId": 1200 },     // tồn tại đúng lúc đếm
  "counted": { "itemId": true },
  "note": "Kiểm kê cuối ngày",
  "adjustments": [ { "itemId": "uuid", "delta": 34 } ], // tổng hợp, chi tiết nằm ở phiếu adjust
  "operator": "email",
  "status": "draft",                // "draft" | "approved"
  "createdBy": "uuid",
  "approvedAt": "2026-10-30T…",     // null khi còn nháp
  "approvedBy": "uuid"
}
```

- `draft` **không** đổi tồn và **không** tạo phiếu. Chốt phiếu sinh một phiếu `adjust` cho mỗi dòng lệch (xem mục Operation) và đặt `periodStart = now`.
- Giao diện hiện chỉ mở kiểm kê cho owner; server (migration 20261030) cho non-owner thêm `draft` của chính mình nhưng không sửa/xoá phiếu đã có.

### `Batch` (mẻ nấu)

```jsonc
{
  "id": "uuid",
  "code": "ME-20261030-001",     // nextBatchCode: ME-YYYYMMDD-NNN
  "prepItemId": "uuid",
  "prepName": "Trà sữa nền",
  "unit": "ml",
  "actualQty": 1950,             // sản lượng thực tế
  "plannedQty": 2000,            // sản lượng theo công thức
  "day": "2026-10-30",
  "startedAt": "2026-10-30T01:00:00.000Z",
  "expiresAt": "2026-10-31T01:00:00.000Z", // startedAt + shelf giờ
  "shelfHours": 24,
  "operator": "email",
  "note": "",
  "consumption": [ { "itemId": "uuid", "qty": 300 } ], // nguyên liệu đã dùng (đơn vị kho)
  "ops": [ "opId" ]
}
```

### `PosModifier` (topping / tuỳ chọn POS)

```jsonc
{
  "id": "uuid",
  "name": "Trân châu",
  "aliases": [ "tran chau", "TC" ],
  "itemId": "uuid",   // mặt hàng bị trừ khi bán món có topping này
  "qty": 30           // định lượng mỗi lượt, theo đơn vị dùng của mặt hàng
}
```

### `AuditLog` (nhật ký thay đổi cấu hình)

```jsonc
{
  "id": "uuid",
  "at": "2026-10-30T…",
  "by": "email",              // actorLabel()
  "action": "Cập nhật cấu hình giá",
  "detail": "Food Cost 30% → 25%"
}
```

Tối đa 300 dòng, mới nhất ở đầu; xem 100 dòng gần nhất ở Cài đặt → Lịch sử thay đổi. Không ghi thay đổi tồn (đã có `ops`).

## 3. Ràng buộc dữ liệu

| Ràng buộc | Nơi kiểm tra |
|---|---|
| `items[].code` duy nhất (không phân biệt hoa/thường) | `saveForm` (client) |
| `pos[].code` duy nhất sau `normalizePosKey` | `saveForm` (client) |
| `qty = tồn cũ + tổng chênh lệch phiếu`, sai số 0,000001 | **RPC** `save_workspace_state` (mọi vai trò) |
| Không cho tồn âm khi xuất/nấu/hủy/vô hiệu hoá phiếu | client + RPC |
| Không dùng/trả quá số đang ở vị trí; xuất ra vị trí ≤ tồn | `saveForm` (client) |
| `sale_return + sale_waste ≤ sale_issue` theo `day|itemId` | `validateOperationClosures` (client) |
| Phiếu `adjust` không được vô hiệu hoá | `deleteOperation` (client) |
| Non-owner không đổi cấu hình `items`, chỉ thêm phiếu đúng loại | **RPC** |
| Non-owner chỉ thêm `audit` `draft` của chính mình | **RPC** (migration 20261030) |
| `db.pricing` trong khoảng hợp lệ, đuôi giá < bước giá | `sanitizePricing`, `savePricingSettings` (client) |
| Revision khi ghi cloud / khôi phục | **RPC** `save_workspace_state`, `replace_workspace_state` |

Server **không** kiểm tra hình dạng đầy đủ của JSON: tên, đơn vị, giá, BOM, `at`, `batches`, `posModifiers`, `auditTrail` do client ghi. Với owner, server giữ nguyên toàn bộ; với **non-owner**, server chỉ merge `ops`/`items`/`audits` nên `batches` (và `auditTrail`) do vai trò đó tạo sẽ bị bỏ — xem `CURRENT_STATUS.md` #21. Vì vậy dữ liệu cấu hình sai vẫn có thể lọt qua nếu sửa trực tiếp bằng SQL hoặc bằng console của owner; chỉ **tồn kho và quyền** được bảo vệ ở server.
