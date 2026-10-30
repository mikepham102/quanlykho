# DATABASE SCHEMA — Mô hình dữ liệu thật

> Cập nhật: 28/10/2026. Nguồn sự thật: `index.html` + `supabase/migrations/20261020_accounts_and_workspace.sql`.

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
| `save_workspace_state` | `p_state jsonb` | Số revision mới; lỗi nếu sai quyền hoặc revision cũ. |
| `list_workspace_users` | — | Danh sách hồ sơ (chỉ chủ quán). |
| `change_workspace_role` | `p_user_id`, `p_role` | Cập nhật vai trò (chỉ chủ quán). |

Edge Function `invite-user` tạo tài khoản; chỉ nơi đây dùng `service_role`.

## 2. Cấu trúc `state` (JSONB)

```jsonc
{
  "brand":      { "name": "Mộc Inventory", "branch": "…", "logo": "data:image/…" },
  "pricing":    Pricing,         // cấu hình giá đề xuất (mục 2.1)
  "items":      [ Item ],        // nguyên liệu thô + bán thành phẩm
  "pos":        [ Dish ],        // món bán trên POS
  "ops":        [ Operation ],   // sổ phiếu kho
  "imports":    [ PosImport ],   // file POS đã nhập
  "audits":     [ Audit ],       // các lần kiểm kê
  "suppliers":  [ "string" ],
  "categories": [ "string" ],
  "favorites":  { "raw": ["id"], "prep": ["id"] },
  "periodStart": 1761000000000,  // mốc bắt đầu kỳ báo cáo
  "_revision":   42
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
  "recipe": [ { "item": "itemId", "qty": 200 } ]  // prep: nguyên liệu cho 1 mẻ
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
  "rawQty": 500,            // số dùng để tính toán
  "itemId": "uuid",
  "ref": "Nhà cung cấp A",
  "createdBy": "uuid",      // gắn tự động khi đồng bộ
  "createdByEmail": "a@b.c"
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
  "rows": [ { "name": "…", "code": "…", "qty": 10 } ]
}
```

Nhập POS **không** thay đổi tồn kho; chỉ dùng để đối soát.

### `Audit`

```jsonc
{
  "date": "2026-10-28T14:00:00.000Z",
  "counts": { "itemId": 1234 },   // số đếm thực tế
  "system": { "itemId": 1200 },   // số hệ thống trước kiểm kê
  "note": "Kiểm kê cuối ngày"
}
```

Lưu kiểm kê sẽ ghi đè `qty` bằng số thực tế và đặt lại `periodStart`.

## 3. Ràng buộc dữ liệu

| Ràng buộc | Nơi kiểm tra |
|---|---|
| `items[].code` duy nhất (không phân biệt hoa/thường) | `saveForm` (client) |
| `pos[].code` duy nhất sau `normalizePosKey` | `saveForm` (client) |
| Không cho tồn âm khi xuất/nấu/hủy/sửa/xóa phiếu | `saveForm`, `saveOperationEdit`, `deleteOperation` |
| `sale_return + sale_waste ≤ sale_issue` theo `day|itemId` | `validateOperationClosures` |
| `db.pricing` trong khoảng hợp lệ, đuôi giá < bước giá | `sanitizePricing`, `savePricingSettings` (client) |
| Revision khi ghi cloud | RPC `save_workspace_state` |

Server chỉ kiểm tra **quyền** và **revision**, không kiểm tra hình dạng JSON. Vì vậy mọi bất biến nghiệp vụ nằm ở client; nhập liệu sai qua SQL sẽ không được phát hiện.
