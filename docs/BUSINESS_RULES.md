# BUSINESS RULES — Quy tắc nghiệp vụ

> Cập nhật: 30/10/2026. Mọi quy tắc dưới đây phản ánh code đang chạy trong `index.html`.

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

- Tồn chỉ thay đổi qua phiếu kho (`saveForm`), kiểm kê, sửa/vô hiệu hoá phiếu. Nhập file POS **không** đổi tồn.
- Không được để tồn âm: mọi thao tác kiểm tra trước và báo “vượt tồn kho” / “sẽ bị âm kho”. Server cũng chặn lại lần nữa.
- Nấu thành phẩm: kiểm tra đủ nguyên liệu theo `recipe × (số mẻ)`; thiếu thì chặn cả phiếu.
- Sửa phiếu: tính bù tồn rồi kiểm tra lại toàn bộ, nếu âm thì không cho lưu; ghi `editedAt`/`editedBy`/`history[]`.
- **Xoá phiếu = vô hiệu hoá**, không mất dữ liệu: phiếu giữ nguyên trong lịch sử với `status:'voided'`, tồn được tính bù, và phiếu đó không còn được tính ở chốt ca/chênh lệch/đối soát POS. Phiếu `adjust` của kiểm kê không thể vô hiệu.
- **Điều chỉnh kiểm kê** (`kind:'adjust'`) là loại phiếu duy nhất được phép mang `rawQty` có dấu (thiếu = số âm), dùng để đưa tồn về số đếm thực tế.
- Phiếu **vị trí** (`issue_location`, `return_location`, `use_location`) không tạo ra tồn mới: `use_location` không đổi `qty`, chỉ giảm số đang nằm ở quầy/tủ.
- Server `save_workspace_state` tự tính lại `qty = tồn cũ + tổng chênh lệch phiếu` cho **mọi vai trò** và từ chối nếu client gửi số khác. Nghĩa là không thể sửa tồn trực tiếp, kể cả bằng console.

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
- Cột nhận diện theo tiêu đề tiếng Việt/Anh: tên món, mã món, số lượng, và tuỳ chọn **Size / Topping / Trạng thái**.
- Mỗi dòng bán được nhân với `bom` của món tương ứng để ra tiêu thụ lý thuyết; phần topping nhân thêm định lượng của `db.posModifiers`.
- Dòng không khớp món nào được đếm vào `unmapped`; topping không khớp đi vào `modifierMissing`. Cả hai chỉ cảnh báo, không làm hỏng lần nhập.
- Dòng bị bỏ qua (không cộng vào tiêu thụ): trạng thái khớp `huỷ/hủy/cancel/refund/hoàn tiền/trả hàng/trả lại`, hoặc số lượng ≤ 0. Số lượng âm được đếm vào `cancelled`. Trạng thái “Hoàn thành” **không** bị coi là huỷ.
- **Chống nhập trùng**: mỗi lần nhập lưu `hash` (`strHash` của tên file, kỳ và các dòng). Nhập lại đúng file/kỳ đó (hoặc cùng tên file trong cùng kỳ) sẽ hỏi xác nhận rồi **thay thế** báo cáo cũ, không cộng dồn.
- Nhập POS **không** đổi tồn kho; chỉ dùng để so sánh với phiếu xuất thực tế.

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

### 7.1 Nhập số đếm

- Ô để trống = **chưa đếm**, không phải “đếm được 0”. Chỉ dòng có số hợp lệ ≥ 0 mới được ghi nhận.
- Phải có ít nhất một dòng, nếu không báo “Chưa đếm mặt hàng nào…”.
- Mỗi lần đếm lưu `counts` (thực tế), `system` (tồn tại đúng thời điểm đếm), `counted`, `operator`, `note`.

### 7.2 Lưu nháp

- Phiếu nháp có `status:'draft'`: **không** đổi tồn, **không** tạo phiếu điều chỉnh, **không** đổi `periodStart`.
- Dùng khi đếm chưa xong hoặc cần người khác xem lại; chỉ chủ quán chốt được.
- Chỉ phiếu nháp mới xoá được.

### 7.3 Chốt phiếu

- Với mỗi mặt hàng lệch, hệ thống tạo một phiếu `adjust`: `rawQty = số đếm − tồn hiện tại` (có dấu), `qty` đặt bằng số đếm, gắn `stocktakeId`. Không còn ghi đè `qty` trực tiếp.
- Đặt `periodStart = now` để mở kỳ báo cáo mới.
- Nếu tồn đã thay đổi kể từ lúc đếm (có phiếu khác chen vào), hệ thống **vẫn chốt theo số đếm** nhưng cảnh báo số mặt hàng đã thay đổi.
- Phiếu đã chốt **không xoá được**; muốn sửa thì kiểm kê lại để sinh điều chỉnh mới.
- Phiếu `adjust` không thể bị vô hiệu hoá, để lịch sử điều chỉnh luôn khớp với số đếm.

### 7.4 Hiển thị và đối chiếu

- Trang Đối soát có bảng **Phiếu kiểm kê** (thiếu/thừa/trạng thái) và danh sách thẻ trên mobile.
- “Lệch” trong bảng kiểm kê = `thực tế − hệ thống tại lúc đếm` (trước điều chỉnh), khác với “chênh lệch theo kỳ” ở mục 8 (so với tồn lý thuyết).

## 8. Chênh lệch theo kỳ

Công thức cho từng mặt hàng trong khoảng `from → to`:

```
đầu kỳ    = tồn tại lần kiểm kê gần nhất trước kỳ + mọi phiếu sau mốc đó đến hết ngày trước kỳ
            (nếu chưa từng kiểm kê: tồn hiện tại − tổng hiệu ứng phiếu từ from)
nhập      = Σ stockin
nấu (+)   = Σ prep (sản lượng BTP nhập kho)
xuất ròng = Σ (stockout + sale_issue + waste + issue_location) − Σ (sale_return + return_location)
điều chỉnh= Σ adjust
lý thuyết = đầu kỳ + nhập + nấu − xuất ròng + điều chỉnh
thực tế   = số đếm của lần kiểm kê cuối trong kỳ (nếu có)
chênh lệch= thực tế − system của lần kiểm kê đó; nếu phiếu kiểm kê không có system thì thực tế − lý thuyết
```

- Phiếu đã vô hiệu hoá bị loại khỏi mọi số hạng.
- `use_location` không xuất hiện vì không đổi tồn kho.
- **So sánh xuất dùng với POS** (trang Đối soát) là báo cáo khác: POS kỳ vọng vs phiếu `stockout`/`sale_issue` − `sale_return`/`sale_waste`, dùng để phát hiện bán mà không ghi xuất.
- Xuất báo cáo: `exportVariance()` tải CSV `moc-chenh-lech-<from>_<to>.csv`.

## 9. Vị trí bảo quản (quầy / tủ)

- Ba nghiệp vụ: **xuất ra vị trí** (`issue_location`: −kho, +vị trí), **trả về kho** (`return_location`: +kho, −vị trí), **dùng tại chỗ** (`use_location`: −vị trí, kho không đổi).
- Số đang ở quầy/tủ (`item.at`) là **dữ liệu dẫn xuất** từ phiếu, dựng lại mỗi lần vẽ màn hình; không sửa tay được và không dùng để tính tồn.
- Không cho dùng/trả quá số đang có tại vị trí; xuất ra vị trí không được vượt tồn kho. Xoá vị trí bị chặn khi còn hàng ở đó.
- Nhân viên chỉ được ghi **dùng tại chỗ**; xuất ra vị trí và trả về kho do chủ quán/quản lý làm.
- Đây là cách ghi “hàng đã ra quầy nhưng chưa bán hết” mà không làm sai tồn kho.

## 10. Mẻ nấu (batch)

- Mỗi lần nấu BTP tạo một mẻ có mã `ME-YYYYMMDD-NNN` (theo ngày, tăng dần trong ngày).
- Mẻ lưu: BTP, sản lượng thực tế và kế hoạch, ngày, giờ bắt đầu, **hạn dùng = giờ bắt đầu + số giờ bảo quản (`shelf`)**, người làm, ghi chú, danh sách nguyên liệu đã dùng.
- Sản lượng thực tế có thể khác kế hoạch; tồn BTP tăng theo **sản lượng thực tế**.
- Phiếu nấu và các phiếu xuất nguyên liệu của lần nấu đó được gắn `batchId`/`batchCode` để truy vết.
- Bảng **Mẻ nấu gần đây** hiện 20 mẻ, trạng thái hạn dùng (Quá hạn / Còn N giờ) và tần suất nấu hôm nay theo từng BTP.

## 11. Nhật ký thay đổi cấu hình

- Ghi lại ai đổi gì, khi nào cho: mặt hàng, BTP, món POS/BOM, cấu hình giá đề xuất, vị trí, tuỳ chọn POS, vô hiệu hoá phiếu, chốt/xoá phiếu kiểm kê.
- Giữ tối đa **300** dòng gần nhất; xem 100 dòng mới nhất ở **Cài đặt → Lịch sử thay đổi**.
- Không ghi từng lần đổi tồn — việc đó đã có sổ phiếu kho (`db.ops`).
- Nhật ký nằm trong cùng JSONB workspace nên đồng bộ theo thiết bị, không phải log server.

## 12. Phân quyền

| Hành động | owner | manager | employee |
|---|---|---|---|
| Xem dashboard / tồn kho / phiếu | ✅ | ✅ | ✅ |
| Tạo phiếu kho (nhập, xuất, nấu, xuất bán, chốt ca, hao hụt) | ✅ | ✅ | ✅ |
| Ghi phiếu vị trí (quầy & tủ) | ✅ xuất/dùng/trả | ✅ xuất/dùng/trả | ✅ **chỉ dùng** |
| Sửa / vô hiệu hoá phiếu kho | ✅ | ✅ | ❌ |
| Thêm/sửa mặt hàng, BTP, công thức, món POS | ✅ | ❌ | ❌ |
| Nhập POS, kiểm kê (nháp và chốt) | ✅ | ❌ | ❌ |
| Vị trí bảo quản, tuỳ chọn POS, danh mục, nhà cung cấp, thương hiệu, cấu hình giá | ✅ | ❌ | ❌ |
| Xem lịch sử thay đổi | ✅ | ❌ | ❌ |
| Quản lý tài khoản, phân quyền | ✅ | ❌ | ❌ |

- Nhân viên chỉ được **thêm** phiếu; mọi sửa đổi cấu hình bị RPC từ chối ở server.
- `employee` không sửa/xoá phiếu đã lưu, kể cả phiếu của chính mình.
- Migration 20261030 cho phép non-owner **thêm** phiếu kiểm kê nháp của chính mình ở tầng server, nhưng giao diện hiện chỉ mở màn hình kiểm kê cho owner — đây là chỗ dành sẵn cho tương lai, không phải quyền đang dùng.

## 13. Đồng bộ và xung đột

- Ghi cloud tuần tự qua hàng đợi; revision tăng sau mỗi lần ghi.
- Nếu thiết bị khác đã ghi trước, lần ghi sau nhận lỗi và hiện cảnh báo “Dữ liệu đã đổi trên thiết bị khác” → tải lại để lấy bản mới.
- Ứng dụng tự hỏi bản mới mỗi **15 giây** (`refreshCloudWorkspace`); bỏ qua khi đang mở form để không đè dữ liệu đang nhập.
- Chế độ local (`supabase-config.js` trống): chỉ chạy khi mở tệp trực tiếp (`file://`); dữ liệu nằm ở `localStorage`, không tài khoản, không phân quyền. Mở qua `http(s)://` mà chưa cấu hình Supabase sẽ bị **khoá** bằng màn hình “Chưa cấu hình dữ liệu dùng chung” — cố ý, để không phát hành nhầm bản không có dữ liệu chung.

## 14. Sao lưu

- Cài đặt có xuất/nhập JSON toàn bộ `db`; khôi phục đi qua RPC `replace_workspace_state` (chỉ owner) và ghi lại `_restoredBy`/`_restoredAt`.
- Trước khi khôi phục, dữ liệu hiện tại bị ghi đè — nên xuất bản sao lưu trước.
- `backups/` chỉ để cứu hộ file code, không chứa dữ liệu người dùng.
- Toàn bộ workspace nằm trong **một** bản ghi JSONB, nên mọi thứ (kể cả `auditTrail`) tăng kích thước theo thời gian; nên xuất JSON định kỳ và dọn phiếu cũ nếu file phình to.
