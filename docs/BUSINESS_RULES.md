# BUSINESS RULES — Quy tắc nghiệp vụ

> Cập nhật: 28/10/2026. Mọi quy tắc dưới đây phản ánh code đang chạy trong `index.html`.

## 1. Mã mặt hàng

### 1.1 Sinh tự động khi tạo mới

- Mã = `prefix` + số thứ tự 3 chữ số (`padStart(3,'0')`), ví dụ `NLTR001`, `BTP004`.
- Prefix suy ra từ **danh mục** đã chuẩn hóa dấu tiếng Việt và chữ thường:

| Danh mục (khớp theo từ) | Prefix |
|---|---|
| bao bì | `NLBB` |
| trái cây, mứt, sinh tố | `NLTC` |
| topping, trân châu | `NLTP` |
| bột | `NLBT` |
| chất lỏng, sữa, syrup, siro, kem, nước | `NLCL` |
| trà | `NLTR` |
| còn lại / để trống | `NL` |
| bán thành phẩm (form riêng) | `BTP` |

- Thứ tự khớp là **cụ thể trước, chung sau**, và so khớp theo từ để "Trái cây"/"Trân châu" không bị nhận nhầm thành "Trà".
- Số kế tiếp = max các mã hiện có **cùng `type`** khớp `^prefix(\d+)$` + 1. Mã khác prefix không ảnh hưởng.

### 1.2 Ghi đè và bất biến

- Người dùng gõ tay vào ô mã → tắt tự sinh cho form đó; mã đã gõ được giữ nguyên.
- Đổi danh mục khi đang ở chế độ tự sinh → mã đổi theo danh mục mới.
- Mở form **sửa** → không tự sinh, mã cũ giữ nguyên kể cả khi đổi danh mục.
- Nếu lưu mà ô mã rỗng → hệ thống sinh mã rồi mới kiểm tra trùng.

### 1.3 Duy nhất

- Trùng mã (không phân biệt hoa/thường) bị chặn: “Mã mặt hàng đã tồn tại.”
- Mã món POS kiểm tra trùng sau khi bỏ dấu/khoảng trắng: “Mã món POS … đã tồn tại trên một món khác.”

## 2. Tồn kho

- Tồn chỉ thay đổi qua `saveForm` (phiếu kho), kiểm kê, sửa/xóa phiếu. Nhập file POS **không** đổi tồn.
- Không được để tồn âm: mọi thao tác kiểm tra trước và báo “vượt tồn kho” / “sẽ bị âm kho”.
- Nấu thành phẩm: kiểm tra đủ nguyên liệu theo `recipe × (số mẻ)`; thiếu thì chặn cả phiếu.
- Sửa/xóa phiếu: tính bù tồn rồi kiểm tra lại toàn bộ, nếu âm thì không cho lưu.

## 3. Chốt ca BTP

- **Chỉ được chốt những món đã xuất ra quầy trong ngày**: danh sách chốt ca lấy từ nghiệp vụ `sale_issue` của đúng ngày, không liệt kê toàn bộ BTP trong kho.
- Mỗi cặp `(ngày, mặt hàng)` hình thành một “closure”.
- Điều kiện: `sale_return + sale_waste ≤ sale_issue` trong cùng ngày, tính cả phần đã chốt ở lần trước.
- `sale_waste` không trừ tồn lần hai vì đã trừ lúc `sale_issue`.
- Thu hồi cộng lại tồn; hủy chỉ ghi nhận.
- Hàng hỏng/hết hạn **chưa từng đưa ra quầy** không nhập ở chốt ca mà ghi bằng nghiệp vụ **Hao hụt** (`waste`).

## 4. Định lượng và quy đổi đơn vị

- Một mặt hàng có `unit` (đơn vị kho) và tùy chọn `conversionUnit` + `conversionQty` (ví dụ 1 chai = 750 ml).
- BOM ghi theo `conversionUnit` nếu có, ngược lại theo `unit`.
- Khi trừ kho: `số lượng BOM × (1 / conversionQty)` quy về đơn vị kho.
- Nếu khai `conversionUnit` khác `unit` mà không có `conversionQty > 0` → chặn lưu.

### 4.1 Chọn mặt hàng trong phiếu kho

- Mỗi phiếu chỉ được chọn mặt hàng **đúng nhóm**: nhập kho/xuất thô chỉ nguyên liệu thô; nấu BTP và xuất bán chỉ bán thành phẩm; hao hụt cho phép cả hai (chọn đúng mặt hàng thực tế bị hỏng).
- Một mặt hàng chỉ xuất hiện **một lần** trong cùng một phiếu nhiều dòng; chọn lại báo “Mặt hàng này đã có trong danh sách.”
- Phiếu một mặt hàng (nhập, xuất thô, hao hụt, nấu BTP) lưu đúng một mặt hàng; phiếu nhiều dòng (xuất đầu ca, xuất bán, nấu thành phẩm) cộng dồn theo từng dòng.

## 5. Đối soát POS

- Hỗ trợ CSV (tự nhận dấu `,` hoặc `;`, UTF-8) và XLSX.
- Cột nhận diện theo tiêu đề tiếng Việt/Anh: tên món, mã món, số lượng.
- Mỗi dòng bán được nhân với `bom` của món tương ứng để ra tiêu thụ lý thuyết.
- Dòng không khớp món nào được đếm vào `unmapped`, không làm hỏng lần nhập.

## 6. Cấu hình giá đề xuất

Toàn bộ thông số nằm trong `db.pricing`, sửa tại **Cài đặt → Cấu hình giá đề xuất** (chỉ chủ quán). Giá trị mặc định được chọn để tái tạo đúng cách tính cũ: giá vốn 8.855 đ → **39.000 đ** tại quán và **49.000 đ** trên app.

| Thông số | Khóa | Mặc định | Khoảng hợp lệ |
|---|---|---|---|
| Hao hụt nguyên liệu | `wastePct` | 3 % | 0–50 |
| Chi phí vận hành / tháng | `opexMonthly` | 0 đ | 0–1e12 |
| Khấu hao thiết bị / tháng | `depreciationMonthly` | 0 đ | 0–1e12 |
| Số ly dự kiến / tháng | `cupsMonthly` | 0 ly | 0–1e7 |
| VAT | `vatPct` | 8 % | 0–30 |
| Food Cost mục tiêu (quán) | `foodCostStore` | 30 % | 0–95 (0 → về 30) |
| Lợi nhuận mong muốn (quán) | `profitStore` | 20 % | 0–90 |
| Phí sàn app | `appCommission` | 25 % | 0–60 |
| Phí & thuế khác trên app | `appOtherFee` | 4,5 % | 0–30 |
| Chiết khấu khuyến mãi | `appPromoDiscount` | 0 % | 0–30 |
| Lợi nhuận mong muốn (app) | `appProfit` | 25 % | 0–90 |
| Cách niêm yết giá app | `appMode` | `separate` | `separate` \| `same` |
| Bước giá | `roundStep` | 10.000 đ | 1.000–100.000 |
| Đuôi giá | `roundTail` | 9.000 đ | 0–90.000, luôn < bước |
| Giá tối thiểu | `roundMin` | 9.000 đ | 0–1.000.000 |

### 6.1 Công thức

```
chi phí/ly  K = giá vốn BOM × (1 + hao hụt%) + vận hành/ly + khấu hao/ly
vận hành/ly     = chi phí vận hành tháng ÷ số ly tháng
khấu hao/ly     = khấu hao tháng ÷ số ly tháng

Giá tại quán = max( K ÷ FC%,        K ÷ (1 − LN quán%) )
h            = 1 − (phí sàn% + phí khác% + chiết khấu%) ÷ 100
Giá app      = max( K ÷ (FC% × h),  K ÷ ((1 − LN app%) × h) )
```

- Chế độ `appMode = "same"` → giá app = giá tại quán (không cộng bù phí sàn).
- `cupsMonthly = 0` → vận hành và khấu hao mỗi ly = 0 (không chia cho 0).
- `h ≤ 0,05` hoặc `h × (1 − LN app%) ≤ 0,02` → không xác định được giá app, hiển thị “—”.
- Giá vốn bằng 0 → không có giá đề xuất, không sinh `NaN`.
- Mọi tỷ lệ % tính trên **giá niêm yết**; giá đề xuất luôn là mức cao hơn giữa ràng buộc Food Cost và ràng buộc lợi nhuận.

### 6.2 Làm tròn giá

```
roundPrice(n) = max(giá tối thiểu, ceil((n − đuôi) ÷ bước) × bước + đuôi)
```

Với mặc định (bước 10.000, đuôi 9.000): 30.403 → 39.000; 32.836 → 39.000; 9.500 → 19.000. Luôn làm tròn **lên**, không bao giờ thấp hơn giá thô.

### 6.3 VAT

- VAT **không** tham gia công thức tính giá. Đổi VAT không làm đổi giá đề xuất.
- VAT chỉ được bóc tách để tham khảo: `VAT = P × v ÷ (1 + v)`, `doanh thu chưa thuế = P − VAT`, `lãi sau thuế = lãi trước thuế − VAT`.
- Nhãn “Phí & thuế khác trên app” là phí của sàn (thanh toán, quảng cáo, thuế sàn), **không** phải VAT của quán.

### 6.4 Chuẩn hóa và kiểm tra

- `sanitizePricing()` kẹp mọi trường vào khoảng ở bảng trên; giá trị không phải số → mặc định. Hàm chạy ngay khi nạp dữ liệu (`db.pricing = sanitizePricing(db.pricing)`) nên dữ liệu cũ hoặc file JSON thiếu trường vẫn dùng được.
- Food Cost ≤ 0 → về 30 %. Đuôi giá ≥ bước giá → đuôi = bước − 1.000.
- Khi lưu: tổng phí sàn + phí khác + chiết khấu ≥ 90 % bị chặn; đuôi giá ≥ bước giá bị chặn.

### 6.5 Hiển thị

- Thẻ món (trang Công thức & món): giá đề xuất tại quán, giá app, dòng mô tả cấu hình (`pricingCaption`) và nhãn trạng thái **Đạt mục tiêu giá** / **Thấp hơn đề xuất X đ** / **Dưới giá thành X đ**.
- Không còn dải cấu hình riêng ở trang Công thức & món; mọi thay đổi làm ở **Cài đặt → Cấu hình giá đề xuất**.
- Form thêm/sửa món và BOM: phần xem trước giá vốn có nút **Dùng giá này** để điền giá đề xuất vào ô giá bán.
- Hộp mô phỏng trong màn hình cấu hình hiển thị cơ cấu chi phí 1 ly, giá quán và giá app kèm VAT, lãi trước/sau thuế.

### 6.6 Phân quyền

Chỉ `owner` xem và sửa cấu hình giá đề xuất; `manager`/`employee` không thấy trang Cài đặt. Nếu gọi hàm khi không đủ quyền, hệ thống báo “Chỉ chủ quán được thay đổi cấu hình giá đề xuất.”

## 7. Kiểm kê

- Ghi lại `system` (trước kiểm kê) và `counts` (thực tế) cho từng mặt hàng.
- Lưu kiểm kê cập nhật `qty = counts` và đặt `periodStart = now`.

## 8. Phân quyền

| Hành động | owner | manager | employee |
|---|---|---|---|
| Xem dashboard / tồn kho / phiếu | ✅ | ✅ | ✅ |
| Tạo phiếu kho | ✅ | ✅ | ✅ |
| Sửa / xóa phiếu kho | ✅ | ✅ | ❌ |
| Thêm/sửa mặt hàng, BTP, công thức | ✅ | ❌ | ❌ |
| Nhập POS, kiểm kê | ✅ | ❌ | ❌ |
| Danh mục, nhà cung cấp, thương hiệu, cấu hình giá đề xuất | ✅ | ❌ | ❌ |
| Quản lý tài khoản, phân quyền | ✅ | ❌ | ❌ |

Nhân viên chỉ được **thêm** phiếu; mọi sửa đổi cấu hình bị RPC từ chối ở server.

## 9. Đồng bộ và xung đột

- Ghi cloud tuần tự qua hàng đợi; revision tăng sau mỗi lần ghi.
- Nếu thiết bị khác đã ghi trước, lần ghi sau nhận lỗi và hiện cảnh báo “Dữ liệu đã đổi trên thiết bị khác” → tải lại để lấy bản mới.
- Chế độ local (`supabase-config.js` trống) không có tài khoản, không phân quyền, dữ liệu chỉ nằm trên máy.

## 10. Sao lưu

- Cài đặt có xuất/nhập JSON toàn bộ `db`.
- Trước khi khôi phục, dữ liệu hiện tại bị ghi đè — nên xuất bản sao lưu trước.
- `backups/` chỉ để cứu hộ file code, không chứa dữ liệu người dùng.
