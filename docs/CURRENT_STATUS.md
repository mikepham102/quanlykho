# CURRENT STATUS — Trạng thái dự án

> Cập nhật: 28/10/2026. Đây là tài liệu duy nhất ghi trạng thái; các tài liệu khác mô tả thiết kế.

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
- [x] `tools/verify.js` — 97 kiểm tra tự động, chạy bằng `node tools/verify.js` (exit code 1 nếu lỗi).

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

## 3. Kết quả kiểm thử

| Hạng mục | Kết quả |
|---|---|
| `node tools/verify.js` | **97/97 PASS** |
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

| # | Vấn đề | Mức độ | Ghi chú |
|---|---|---|---|
| 1 | Toàn bộ app trong một `index.html` ~266 KB | Cao | Sửa dễ hỏng; đã có git + `verify.js` giảm rủi ro. Đề xuất tách `app.js`/`styles.css`. |
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
| 16 | Chưa có nhật ký thay đổi cấu hình | Thấp | Chỉ phiếu kho có `createdBy`; sửa giá/BOM không lưu lại ai sửa, khi nào. |
| 17 | Nhóm **Giao dịch kho** không gộp khi nhập lại | Trung bình | Mỗi lần nhập là ghi thêm phiếu; đã ghi rõ trong UI, muốn đúng trạng thái cũ thì khôi phục JSON. |

## 5. Việc tiếp theo (ưu tiên)

### P0 — Trước khi phát hành bản mới
1. `git push` lên `main` để GitHub Actions deploy.
2. Mở bản GitHub Pages trên điện thoại, kiểm tra service worker nhận `v17` (tải lại 2 lần nếu còn cache).
3. Đăng nhập chủ quán, chạy checklist thủ công trong `TEST_PLAN.md` mục 4.

### P1 — Ổn định
4. Tách `index.html` thành `styles.css`, `app.js`, `index.html` (giữ nguyên hành vi, kiểm tra bằng `tools/verify.js`).
5. Thêm test tự động cho `saveForm` bằng Playwright.
6. Cho phép cấu hình prefix trong Cài đặt (lưu vào `db.settings.prefixes`).

### P2 — Tính năng
7. Đồng nhất thương hiệu (title, manifest, logo mặc định).
8. Cảnh báo BTP sắp hết hạn dùng theo `shelf`.
9. Xuất báo cáo đối soát ra Excel.

## 6. Cách khôi phục khi có sự cố

```bash
cd /Users/mikepham/Documents/Inventory_milktea
git log --oneline            # xem các mốc
git checkout -- index.html   # quay lui thay đổi chưa commit
git reset --hard <commit>    # quay lui về mốc an toàn
node tools/verify.js         # kiểm tra lại
```

Bản production cũ luôn có tại `backups/index.html.prod-20261028`.
