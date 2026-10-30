# CURRENT STATUS — Trạng thái dự án

> Cập nhật: 30/10/2026. Đây là tài liệu duy nhất ghi trạng thái; các tài liệu khác mô tả thiết kế.

## 1. Sự cố đã xử lý hôm nay

`index.html` từng bị hỏng nặng: đoạn `nextItemCode` bị cắt giữa regex, một thẻ `</script></body></html>` nằm giữa tệp, ~65 hàm bị lặp lại và phần đuôi cũ nằm **sau** `</html>`. Nguyên nhân gốc: dự án chưa có git, mọi thay đổi chỉ nằm trên một file 300 KB.

Cách xử lý:

1. Sao lưu bản hỏng → `backups/index.html.broken-20261028`.
2. Tải bản đang chạy trên GitHub Pages → `backups/index.html.prod-20261028` (220.861 ký tự, 147 hàm, cú pháp hợp lệ) và ghi đè `index.html`.
3. `git init`, thêm `.gitignore`, commit baseline.
4. Làm lại tính năng sinh mã sạch (không chép lại đoạn WIP lỗi).
5. Tăng cache service worker `v8 → v9`.

Kiểm chứng: 7 khác biệt giữa bản hỏng và bản production đều thuộc tính năng sinh mã, nên **không mất tính năng nào khác** khi khôi phục.

## 2. Đã hoàn thành

### 2.1 Hạ tầng
- [x] Git repository + commit baseline + commit tính năng.
- [x] `.gitignore` (`.DS_Store`, `backups/`, `node_modules/`).
- [x] `tools/verify.js` — 127 kiểm tra tự động, chạy bằng `node tools/verify.js` (exit code 1 nếu lỗi).

### 2.2 Sinh mã mặt hàng tự động
- [x] `rawCodePrefix()` map danh mục → `NLTR/NLCL/NLBT/NLTP/NLTC/NLBB/NL`, so khớp theo từ (tránh nhầm "Trái cây" thành "Trà").
- [x] `nextItemCode()` lấy max mã cùng loại + 1, pad 3 chữ số.
- [x] `syncItemCode()` cập nhật ô mã theo danh mục, chỉ khi người dùng chưa gõ tay.
- [x] Tự điền khi mở form thêm mới; giữ nguyên mã khi sửa; tự sinh nếu lưu với mã rỗng.
- [x] Sửa lỗi cũ: đọc `#f-cat` **sau** khi modal render (trước đây gây `TypeError` làm form không mở).

### 2.3 Tài liệu
- [x] Viết lại 6 tài liệu theo đúng hệ thống thật (vanilla JS PWA + Supabase); loại bỏ mô tả React/Express/MongoDB/Jest không tồn tại.
- [x] Quy ước chốt tài liệu theo lô: trong lúc làm chỉ ghi `docs/_PENDING.md`, khi chủ dự án yêu cầu “chốt docs” mới sửa các file tài liệu một lần (xem `ARCHITECTURE.md` mục 12.1).

### 2.4 Ô tìm kiếm nguyên liệu trong form BTP/món
- [x] Xác định nguyên nhân: `.ingredient-picker-option { display:flex }` **ghi đè** luật `[hidden] { display:none }` của trình duyệt, nên JS có đặt `hidden=true` mà danh sách vẫn hiện → cảm giác “ô tìm kiếm không dùng được”.
- [x] Thêm luật `.ingredient-picker-option[hidden] { display:none !important }` (giống cách `.nav button[hidden]` đang làm).
- [x] `filterIngredientPicker()` so khớp qua `normalizePosKey` → gõ **không dấu** (`tra`, `bot`) vẫn tìm được.
- [x] Ẩn luôn tiêu đề nhóm không còn mục nào; thêm thông báo “Không tìm thấy nguyên liệu phù hợp.”; reset cuộn về đầu.
- [x] Áp dụng cho cả form BTP (`addLine('recipe-lines','raw')`) và form món (`addLine('bom-lines','all')`).

### 2.5 Cấu hình giá đề xuất (cấu hình được)

- [x] Gỡ hằng số `PRICING_POLICY` + `roundUpTo9k` cứng; thay bằng `PRICING_DEFAULTS` + `sanitizePricing` + `roundPrice` + `priceModel` (hàm thuần, không DOM).
- [x] `db.pricing` lưu cùng workspace (`localStorage` + `workspace_state`), chuẩn hóa ngay khi nạp nên dữ liệu cũ tự có mặc định.
- [x] Màn hình **Cài đặt → Cấu hình giá đề xuất**: hao hụt, vận hành/tháng, khấu hao/tháng, số ly/tháng, VAT, Food Cost & lợi nhuận quán, phí sàn + phí khác + chiết khấu app, lợi nhuận app, cách niêm yết app, bước/đuôi/giá tối thiểu; kèm hộp mô phỏng 3 thẻ và nút khôi phục mặc định.
- [x] Chỉ còn **một chỗ** cấu hình: đã bỏ dải “Đang áp dụng / Sửa cấu hình” (từng thêm rồi gỡ) và dải ở trang Công thức & món; trang Công thức chỉ hiển thị giá đề xuất trên thẻ món.
- [x] Công thức tách bạch: giá vốn × (1 + hao hụt) + vận hành/ly + khấu hao/ly; giá = max(ràng buộc Food Cost, ràng buộc lợi nhuận); VAT chỉ bóc tách để hiển thị, **không** đổi giá.
- [x] Thẻ món hiển thị giá quán/app, dải chính sách và nhãn trạng thái (Đạt mục tiêu / Thấp hơn đề xuất / Dưới giá thành); form món có nút “Dùng giá này”.
- [x] Bỏ hai caption cứng “FC 30% · App gồm 25% phí, 4,5% thuế” và “FC 30%, phí + thuế 29,5%”.
- [x] Giá trị mặc định tái tạo đúng giá cũ (vốn 8.855 đ → 39.000/49.000) nên không thay đổi giá đang bán.

### 2.6 Giao diện native trên điện thoại

- [x] Cài được ra màn hình chính đúng nghĩa: `apple-mobile-web-app-capable`, `status-bar-style`, `viewport-fit=cover`, icon PNG 180/192/512 + `apple-touch-icon`; manifest có `id`, `orientation: portrait`.
- [x] Khoá phóng to (meta + `gesturestart`), bỏ double-tap zoom và delay 300 ms (`touch-action`), tắt bôi đen/menu copy, chặn pull-to-refresh và nảy trang.
- [x] Mobile cuộn trong `.main` (`body{position:fixed}`), topbar sticky có blur, chừa safe-area trên/dưới/ngang; bottom nav 70px; modal thành bottom sheet.
- [x] Điện thoại nằm ngang hiện màn hình nhắc xoay dọc (tablet không bị ảnh hưởng).
- [x] Ba mức cỡ chữ **Chuẩn / Lớn / Rất lớn** trong menu tài khoản, lưu trên thiết bị (`moc-display-v1`), áp trước khi vẽ nên không nháy.
- [x] Vùng chạm tối thiểu 44px (form chính 48px), ô nhập 16px để iOS không tự zoom khi focus.

### 2.7 Đồng đều cách hiển thị dữ liệu

- [x] Dashboard: 4 chỉ số thành 4 dòng gọn (icon + nhãn trái, số phải), ẩn chú thích trên mobile; mỗi dòng 44px thay cho 2×2 thẻ có nhãn xuống dòng.
- [x] Tồn kho: 4 nút nghiệp vụ 2×2 cao 48px (trước 34px, chữ 9–10px); bộ lọc xếp dọc, cao 46px, chữ 16px (trước 3 cột chữ 10px).
- [x] Thang chữ dùng token: chữ dữ liệu tính bằng `calc(var(--fs-body) ± n)` nên đổi cỡ chữ là toàn bộ co giãn; nhãn nhỏ nhất 11px (trước có chỗ 8,5–9px).
- [x] Nhãn thẻ mobile, mã hàng, dòng phụ (nhà cung cấp/thời gian), thẻ nghiệp vụ, flow-entry, dayclose, cài đặt… đều quy về cùng thang.
- [x] Thẻ “Nguyên liệu cần chú ý” bỏ cột danh mục, pill trạng thái lên cùng dòng tên; “Hoạt động gần đây” tách dòng phụ; tab Phiếu kho có fade mép phải.

### 2.8 Phiếu kho: một kiểu chọn mặt hàng, chốt ca theo món đã xuất

- [x] Bộ chọn dùng chung `itemPickerHtml()` (nút chọn + menu tìm kiếm có nhóm) thay toàn bộ `<select>` thô ở Nhập kho, Xuất thô, Hao hụt, Nấu BTP và thay ô tìm + datalist ở Xuất đầu ca, Xuất bán, Nấu thành phẩm.
- [x] Phiếu một mặt hàng vẫn giữ `<select hidden>` để `saveForm()` không phải đổi; phiếu nhiều dòng thêm card có tồn + số lượng + xoá dòng; chặn chọn trùng.
- [x] **Chốt ca** chỉ liệt kê món có `sale_issue` trong ngày (`daycloseRows()`/`renderDaycloseRows()`), hiện “Đã xuất ra quầy” và “Còn lại” nếu đã chốt một phần; đổi ngày thì vẽ lại.
- [x] Hàng hỏng/hết hạn không qua quầy được chuyển sang nghiệp vụ **Hao hụt**, không nhập ở chốt ca.
- [x] Sửa lỗi menu chọn bị mở sẵn trên mobile do `display:flex` ghi đè `[hidden]`.

### 2.9 Cài đặt gọn lại và dữ liệu kho theo nhóm

- [x] Bỏ mục “Định lượng & quy đổi POS” (đã có trang Công thức & món trên menu) và bỏ dải cấu hình giá trùng lặp.
- [x] “Dữ liệu kho” chia 4 khối mở/đóng: **Nhập dữ liệu** (Excel/CSV + khôi phục JSON), **Xuất dữ liệu** (JSON toàn bộ + Excel theo nhóm), **Tải dữ liệu mẫu** (mẫu trống), **Vùng nguy hiểm** (khôi phục demo).
- [x] Mẫu Excel nay **chỉ có tiêu đề**; muốn xuất kèm dữ liệu dùng “Xuất Excel” (`xuat_<nhóm>_<ngày>.xlsx`).
- [x] Thêm hộp xác nhận trước khi nhập tệp; ghi rõ nhóm Giao dịch kho luôn ghi thêm phiếu, không gộp.

### 2.10 Toàn vẹn dữ liệu (P0, 28/10)

- [x] Kiểm kê không còn gán `qty` trực tiếp: mỗi dòng lệch sinh phiếu `adjust` (có dấu) + `stocktakeId`; ô trống = chưa đếm; bắt buộc ≥ 1 dòng.
- [x] Xoá phiếu = **vô hiệu hoá** (`status:'voided'`): giữ lịch sử, tính bù tồn, không còn ảnh hưởng báo cáo. Phiếu `adjust` không thể vô hiệu.
- [x] Xoá mặt hàng bị chặn khi đã có giao dịch; không còn sửa `audits` khi xoá.
- [x] `save()` bắt lỗi hết dung lượng (localStorage), chặn double-submit, chống nhập trùng báo cáo POS (`strHash` + thay thế), bỏ phiếu huỷ khỏi đối soát.
- [x] Migration `20261028`: `workspace_op_delta` hỗ trợ `adjust`/`voided`, **áp kiểm tra tồn cho cả owner**, thêm RPC `replace_workspace_state`.

### 2.11 Chênh lệch theo kỳ và POS nâng cao (29/10)

- [x] `theoreticalOpening()` neo tồn đầu kỳ theo lần kiểm kê gần nhất; `varianceReport(from,to)` trả đủ đầu kỳ/nhập/nấu/xuất ròng/điều chỉnh/lý thuyết/thực tế/lệch.
- [x] Bảng chênh lệch có chọn kỳ + dòng tổng kết; `exportVariance()` tải CSV dùng **cùng** engine; đã bỏ công thức tautology và `db.audits.at(-1)`.
- [x] `db.posModifiers` + `findPosModifier`/`modifierConsumption` (khớp tên và bí danh không dấu); nhận diện cột Size/Topping/Trạng thái.
- [x] Dòng huỷ/hoàn bị bỏ qua theo trạng thái và theo số lượng ≤ 0; “Hoàn thành” không bị bỏ nhầm.
- [x] Panel **So sánh xuất dùng trên app với POS** ở trang Đối soát.

### 2.12 Mẻ nấu (29/10)

- [x] `db.batches` + `addBatch()`/`nextBatchCode()` (mã `ME-YYYYMMDD-NNN`): sản lượng thực tế/kế hoạch, người làm, `startedAt`/`expiresAt` theo `shelf` giờ.
- [x] Phiếu `prep` và các `stockout` khi nấu gắn `batchId`/`batchCode`.
- [x] Bảng **Mẻ nấu gần đây** (20 mẻ) + thẻ mobile: hạn dùng, tần suất nấu hôm nay.

### 2.13 Vị trí bảo quản (29/10)

- [x] `db.locations` (Quầy bar/Tủ mát/Khu pha chế) + 3 loại phiếu `issue_location`/`return_location`/`use_location`.
- [x] `item.at` là dữ liệu **dẫn xuất**, `rebuildLocationBalances()` dựng lại từ phiếu mỗi lần render.
- [x] Bảng **Hàng ngoài kho** + nút **Quầy & tủ**; chặn dùng/trả quá số đang ở vị trí; nhân viên chỉ ghi “dùng”.
- [x] Migration `20261029`: delta cho 3 loại phiếu, whitelist manager/employee, bỏ `at` khỏi so sánh cấu hình mặt hàng.

### 2.14 Kiểm kê nháp, nhật ký, thẻ đối soát (30/10)

- [x] `saveStocktake(draft)` tách khỏi `saveForm`: **Lưu nháp** không đổi tồn, không tạo phiếu; `approveStocktake()` chốt → sinh `adjust` theo tồn hiện tại và cảnh báo mặt hàng đã đổi từ lúc đếm; `deleteStocktake()` chỉ xoá nháp.
- [x] Bảng **Phiếu kiểm kê** (thiếu/thừa/trạng thái) + thẻ mobile; nút Chốt/Xoá cho phiếu nháp.
- [x] `db.auditTrail` + `logConfig()` cho mặt hàng/BTP/món POS/giá/vị trí/tuỳ chọn POS/vô hiệu hoá phiếu/chốt kiểm kê; xem ở Cài đặt → **Lịch sử thay đổi**.
- [x] Thẻ **Đối soát kiểm kê** trên dashboard (`renderReconCard`).
- [x] Migration `20261030`: non-owner chỉ thêm phiếu audit `draft` của chính mình, `audits` được giữ khi lưu.

## 3. Kết quả kiểm thử

| Hạng mục | Kết quả |
|---|---|
| `node tools/verify.js` | **127/127 PASS** |
| Chrome headless 30/10, chế độ local `file://` | 6 trang render, 1 trang active, không lỗi console (chỉ CORS manifest) |
| Chrome headless 30/10, `http://` với config rỗng | Hiện đúng màn hình khoá “Chưa cấu hình dữ liệu dùng chung” |
| Bản GitHub Pages so với máy | `index.html` giống hệt, `CACHE=v22` |
| Test đơn vị hàm sinh mã (13 danh mục + 4 mã kế tiếp) | PASS |
| Chrome headless, chế độ local | 6 trang render, không lỗi console |
| Mở form thêm mới | `NL008` (seed có `NL001–NL007`) |
| Chọn danh mục `Trà` | `NLTR001` |
| Đổi sang `Bao bì` | `NLBB001` |
| Gõ tay `MANUAL1` rồi đổi danh mục | giữ `MANUAL1` |
| Lưu mặt hàng danh mục Trà | lưu `NLTR001`, xuất hiện trong tồn kho |
| Mở form BTP | `BTP003` (seed có `BTP001–BTP002`) |
| Mở form sửa | mã `NL001` giữ nguyên dù đổi danh mục |
| Lưu trùng mã `NL001` | chặn, báo “Mã mặt hàng đã tồn tại.” |
| Tìm `tra` trong picker | 3/7 nguyên liệu hiện, 3/6 nhóm hiện |
| Tìm `bot` | còn “Bột kem béo” |
| Tìm `zzzz` | 0 mục + thông báo “Không tìm thấy nguyên liệu phù hợp.” |
| Xóa ô tìm | trả lại đủ 7 mục, 6 nhóm, thông báo ẩn |
| Bấm chọn nguyên liệu | nút hiện đúng tên, menu đóng, dòng BOM nhận đúng nguyên liệu |
| Mở Cấu hình giá đề xuất, giá vốn mẫu 10.000 | 39.000 đ tại quán, 49.000 đ trên app |
| Đổi VAT 8 % → 20 % | giá quán/app không đổi, chỉ dòng VAT/lãi sau thuế đổi |
| Đổi Food Cost 30 % → 20 % rồi Lưu | 59.000/79.000; dải chính sách và nhãn thẻ món cập nhật |
| Lưu chính sách | `db.pricing` + `localStorage` ghi đúng, toast xác nhận |
| Phí sàn + phí khác + chiết khấu ≥ 90 % | chặn lưu, giữ chính sách cũ |
| “Khôi phục mặc định” | form về 30/3/9.000 nhưng chưa ghi vào `db` |
| Nút “Dùng giá này” ở form món | điền 47.000 đ vào ô giá bán |
| Headless 390×844: thân trang | 16px, `body` fixed, `.main` cuộn, topbar sticky 56px |
| Headless 390×844: vùng chạm | nút 48px, tab 44px, nút nghiệp vụ 48px, xoá dòng BOM 44px, nav 70px |
| Headless 390×844: dashboard | 4 dòng chỉ số 44px, nhãn 13px/số 22px, chú thích ẩn |
| Headless 390×844: bộ lọc Tồn kho | 1 cột, chữ 16px, cao 47px |
| Headless 390×844: modal | rộng 390px, bo trên 22px, footer sticky, input 16px |
| Headless 844×390 | overlay “Xoay điện thoại theo chiều dọc”, app ẩn |
| Headless 1280×800 (desktop) | layout cũ: body static, modal 600px, không tràn ngang |
| Đổi cỡ chữ Lớn / Rất lớn | 17.5px / 19px, lưu `moc-display-v1`, không tràn ngang |
| Nhập kho: bộ chọn chung | 7 lựa chọn, chọn xong nút hiện “Ly nhựa 500ml”, lưu phiếu +100 |
| Nấu thành phẩm | Chọn BTP → thêm 1 dòng, nhãn “Sản lượng nấu” |
| Xuất đầu ca | 2 bộ chọn, mỗi bộ thêm đúng danh sách (1 thô + 1 BTP) |
| Chốt ca | Trống khi chưa xuất; sau 2 phiếu xuất → đúng 2 dòng (500 ml / 200 g) |
| Cài đặt → Dữ liệu kho | 4 khối mở/đóng, mẫu Excel chỉ có tiêu đề, có nút xuất Excel theo nhóm |

## 4. Vấn đề đã biết

> Trạng thái 30/10: chủ dự án xác nhận **đã áp đủ** migration 20261029 + 20261030. Vì vậy #19 và #21 **đang là lỗi thật trên bản chạy**, không còn là giả định; #18 và #20 cũng đang mở.

| # | Vấn đề | Mức độ | Ghi chú |
|---|---|---|---|
| 1 | Toàn bộ app trong một `index.html` ~311 KB (300.132 ký tự, 219 hàm) | Cao | Sửa dễ hỏng; đã có git + `verify.js` 127 mục giảm rủi ro. Đề xuất tách `app.js`/`styles.css`. |
| 2 | Chưa có test tự động cho luồng UI (chỉ harness tạm) | Trung bình | Có thể thêm Playwright sau khi tách tệp. |
| 3 | Mã hàng cũ (`NL001–NL007`, `TS001`) không theo prefix mới | Thấp | Tồn tại song song; mã cũ giữ nguyên, mặt hàng mới dùng prefix mới. |
| 4 | Không cấu hình được prefix trong Cài đặt | Thấp | Hiện là hằng số trong code; nếu cần, lưu vào `db.settings` (chưa có). |
| 5 | Tiêu đề tab là “HongCha — Quản lý kho”, brand là “MỘC INVENTORY” | Thấp | Chỉ là nhãn; đổi `<title>` và `manifest` nếu muốn đồng nhất. |
| 6 | Server không kiểm tra hình dạng JSON | Trung bình | Chỉ client đảm bảo bất biến; sửa DB trực tiếp có thể làm hỏng dữ liệu. |
| 7 | `schema.sql` gây hiểu nhầm | Thấp | Đã ghi rõ là tham khảo, không chạy; có thể chuyển vào `docs/`. |
| 8 | Không có `package.json` | Thấp | `tools/verify.js` chỉ dùng module lõi của Node. |
| 9 | Menu chọn nguyên liệu không tự đóng khi bấm ra ngoài | Thấp | Chỉ đóng khi chọn xong hoặc mở menu khác. Có thể thêm listener `click`/`Escape` nếu cần. |
| 10 | Ô tìm kiếm khớp theo chuỗi con, chưa xếp hạng | Thấp | Gõ `tra` cũng khớp “cát **trắ**ng”; danh sách ngắn nên dễ nhìn, có thể thêm xếp hạng theo tên sau. |
| 11 | iOS bỏ qua `orientation` trong manifest | Thấp | Đã có overlay nhắc xoay dọc khi điện thoại nằm ngang (`max-height:520px`); tablet không bị ảnh hưởng. |
| 12 | `user-scalable=no` không có hiệu lực với tab Safari thường | Thấp | Khi đã “Thêm vào màn hình chính” thì có hiệu lực; thêm `gesturestart` chặn pinch làm lớp hai. |
| 13 | Khoá zoom là đánh đổi accessibility | Trung bình | Bù bằng nền 16px, 3 mức cỡ chữ trong menu tài khoản và ô nhập 16px. |
| 14 | Chưa test trên máy thật (iOS/Android) | Cao | Mới kiểm bằng Chrome headless với iframe 390×844; cần chạy mục 4.6 của `TEST_PLAN.md` trước khi phát hành. |
| 15 | Chưa có mẫu Excel nhập **kiểm kê (audit)** | Trung bình | Kiểm kê chỉ nhập qua form; muốn nhập số đếm hàng loạt phải bổ sung template + parser. |
| 16 | Nhật ký thay đổi chỉ giữ 300 dòng, không xuất được | Thấp | Có từ 30/10 (`db.auditTrail`), nhưng cắt còn 300 và chỉ hiện 100 dòng; chưa có xuất CSV để lưu trữ lâu dài. |
| 17 | Nhóm **Giao dịch kho** không gộp khi nhập lại | Trung bình | Mỗi lần nhập là ghi thêm phiếu; đã ghi rõ trong UI, muốn đúng trạng thái cũ thì khôi phục JSON. |
| 18 | **XSS lưu trữ**: ghi chú phiếu (`op.ref`) và tên mặt hàng được chèn thô vào `innerHTML` | **Cao** | Nhân viên gõ `<img onerror=…>` vào “Lý do xuất”, chủ quán mở Phiếu kho là script chạy bằng phiên owner (đọc/sửa toàn bộ kho, mời tài khoản). Đã có `xEsc()` nhưng chỉ dùng 3 chỗ. |
| 19 | **Non-owner không lưu được sau khi có phiếu kiểm kê** (chỉ sau khi áp migration 20261030) | **Cao** | `load_workspace_state` vẫn trả `audits:[]` cho manager/employee, còn `save_workspace_state` bắt buộc giữ đủ phiếu audit cũ ⇒ mọi lần lưu của nhân viên bị từ chối, poll 15s xoá thay đổi. Phải sửa trước/sau khi áp 20261030. |
| 20 | Lưu cloud lỗi bị **poll 15s ghi đè** thay đổi chưa đồng bộ | Cao | `refreshCloudWorkspace` thay cả `db` khi revision server cao hơn, không có cờ “đang có thay đổi chưa gửi” ⇒ mất phiếu vừa nhập nếu mạng chập chờn/conflict. |
| 21 | Mẻ nấu của non-owner bị server bỏ im lặng | Trung bình | Server chỉ merge `ops`/`items`/`audits`; `batches` do nhân viên tạo bị mất ⇒ phiếu có `batchId` trỏ tới mẻ không tồn tại, mất hạn dùng. |
| 22 | Phiếu kiểm kê **nháp** vẫn được dùng làm mốc tính tồn/chênh lệch | Trung bình | `theoreticalOpening`/`varianceReport` không lọc `status:'draft'` ⇒ báo cáo lệch ngay cả khi chưa chốt. |
| 23 | Chốt phiếu nháp ghi đè giao dịch phát sinh sau lúc đếm | Trung bình | `approveStocktake` đặt `qty = counts` tuyệt đối, chỉ cảnh báo sau khi đã lưu ⇒ hàng bán trong khoảng đếm→chốt bị xoá khỏi tồn. Nên chặn khi có thay đổi. |
| 24 | Ô “Tồn hiện tại” trong form mặt hàng sửa kho trực tiếp | Trung bình | Cloud: RPC từ chối (“Số tồn chỉ được thay đổi theo phiếu kho”) nhưng giao diện đã hiện số mới, 15s sau quay lại ⇒ tưởng đã lưu. Local: sai lịch sử, không sinh `adjust`. |
| 25 | Khôi phục JSON cũ bị từ chối vì `_revision` | Trung bình | `replace_workspace_state` đòi `_revision` khớp bản đang lưu; bản sao lưu từ hôm trước không khôi phục được. Chỉ khôi phục được bản vừa xuất. |
| 26 | Server chưa chặn manager sửa/xoá phiếu cũ | Trung bình | Chỉ kiểm phiếu mới/phiếu bị đổi; phiếu bị xoá khỏi mảng (kèm sửa `qty`) lọt qua ⇒ mất dấu vết thay vì `voided`. Chốt ca (`return+waste ≤ issue`) cũng chỉ kiểm ở client. |
| 27 | Dashboard lấy “Món bán hôm nay” theo ngày UTC | Thấp | 00:00–06:59 giờ VN hiển thị số của hôm trước (`toISOString()`), lệch với ngày nghiệp vụ. |
| 28 | `item.at` không được server kiểm tra | Thấp | Chỉ là dữ liệu dẫn xuất và luôn được dựng lại ở client, nhưng một client lỗi có thể lưu `at` sai cho tới lần render sau. |
| 29 | Migration: **đã áp đủ** 20261029 + 20261030 (chủ dự án xác nhận 30/10) | Đã đóng | Nhờ vậy phiếu vị trí và kiểm kê nháp chạy được, nhưng #19 và #21 trở thành lỗi thật. Cần chạy `TEST_PLAN.md` 4.1 + 4.8–4.13 với cả 3 vai trò để xác nhận trên dữ liệu thật. |

## 5. Việc tiếp theo (ưu tiên)

### P0 — Trước khi phát hành bản mới
1. **Sửa #19** (mask `audits` trong `load_workspace_state`): migration 20261030 đã áp ⇒ kể từ khi có **một** phiếu kiểm kê, mọi lần lưu của quản lý/nhân viên bị server từ chối. Đây là việc gấp nhất; nếu chưa sửa, nên tạm chỉ dùng tài khoản chủ quán để ghi phiếu.
2. **Sửa #18** (escape `o.ref`, `o.name`, email, tên hàng… ở mọi sink `innerHTML`) vì đây là lỗ hổng cho phép nhân viên chạy script trong phiên chủ quán.
3. Đăng nhập **cả 3 vai trò**, lưu thử một phiếu mỗi loại **sau khi** đã có một phiếu kiểm kê, để xác nhận #19 đã hết.
4. `git push` lên `main` để GitHub Actions deploy; mở bản GitHub Pages trên điện thoại, tải lại 2 lần để nhận `CACHE` mới.
5. Chạy checklist thủ công `TEST_PLAN.md` mục 4 (tối thiểu 4.1, 4.8–4.13).

### P1 — Ổn định
6. **Sửa #20**: thêm cờ “có thay đổi chưa gửi”, tạm dừng poll khi lưu lỗi, chỉ xoá payload khi RPC thành công.
7. **Sửa #21** (merge `batches` cho non-owner) và **#22/#23** (lọc audit nháp, chặn chốt khi tồn đã đổi).
8. **Sửa #25** (khôi phục JSON: dùng `_revision` hiện tại, validate `Array.isArray`) — nếu không, sao lưu cũ không dùng được đúng lúc cần nhất.
9. **Sửa #24** (ô tồn trong form mặt hàng chỉ đọc khi sửa) và **#26** (server chặn manager xoá phiếu cũ, kiểm chốt ca ở SQL).
10. Tách `index.html` thành `styles.css`, `app.js`, `index.html` (giữ nguyên hành vi, kiểm tra bằng `tools/verify.js`).
11. Thêm test tự động cho `saveForm` bằng Playwright.
12. Cho phép cấu hình prefix trong Cài đặt (lưu vào `db.settings.prefixes`).

### P2 — Tính năng
13. Đồng nhất thương hiệu (`<title>` “HongCha — Quản lý kho” vs brand “MỘC INVENTORY”, manifest, logo mặc định).
14. Cảnh báo BTP sắp hết hạn trên dashboard (bảng mẻ nấu đã có hạn dùng, nhưng chưa có cảnh báo chủ động).
15. Xuất báo cáo đối soát ra Excel.
16. Dọn dữ liệu cũ: giới hạn số phiếu/imports, hoặc xuất lưu trữ theo năm — workspace là **một** JSONB nên phình dần.

## 6. Cách khôi phục khi có sự cố

```bash
cd /Users/mikepham/Documents/Inventory_milktea
git log --oneline            # xem các mốc
git checkout -- index.html   # quay lui thay đổi chưa commit
git reset --hard <commit>    # quay lui về mốc an toàn
node tools/verify.js         # kiểm tra lại
```

Bản production cũ luôn có tại `backups/index.html.prod-20261028`.

> Khôi phục **dữ liệu** (JSON trong Cài đặt) là việc khác: hiện chỉ khôi phục được bản có `_revision` trùng bản đang lưu (xem #25). Trước khi khôi phục, luôn xuất JSON hiện tại để có đường lùi.
