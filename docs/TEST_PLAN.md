# TEST PLAN — Kế hoạch kiểm thử

> Cập nhật: 30/10/2026. Áp dụng cho app một tệp `index.html` + Supabase.

## 1. Phạm vi

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| Cú pháp và cấu trúc `index.html` | Tải đồng thời hàng nghìn người dùng |
| Sinh mã mặt hàng tự động | Kiểm thử xâm nhập (pentest) |
| Nghiệp vụ kho: nhập/xuất/nấu/chốt ca/hủy | Đa ngôn ngữ |
| Cấu hình giá đề xuất (quán/app) | |
| Giao diện native: khoá zoom, cỡ chữ 3 mức, vùng chạm 44px | Trình duyệt cũ thiếu `dvh` / `backdrop-filter` (giao diện vẫn dùng được, chỉ mất hiệu ứng) |
| Phân quyền theo vai trò | Đồng bộ offline nâng cao (chỉ có cache shell) |
| Đồng bộ Supabase và xung đột revision | |
| Sao lưu/khôi phục JSON | |

## 2. Kiểm thử tự động (bắt buộc sau mỗi lần sửa)

```bash
cd /Users/mikepham/Documents/Inventory_milktea
node tools/verify.js
```

Script kiểm tra **127 mục**, chia theo nhóm:

| Nhóm | Số mục | Nội dung |
|---|---|---|
| Cấu trúc tệp | 9 | Kích thước hợp lý, **đúng một** `</script></body></html>`, tệp kết thúc bằng `</html>`, cú pháp từng khối `<script>` bằng `vm.Script`, không có hàm khai báo trùng. |
| Sinh mã mặt hàng | 19 | Đủ 4 hàm, 13 trường hợp map danh mục → prefix, 4 trường hợp sinh mã kế tiếp, `syncItemCode` an toàn khi chưa có form. |
| Ô tìm nguyên liệu | 4 | Luật `[hidden] { display:none !important }`, lọc bằng `normalizePosKey`, ẩn nhóm rỗng, có thông báo “không tìm thấy”. |
| Cài đặt giá (hiện diện) | 8 | Có mục “Cấu hình giá đề xuất”, không còn `PRICING_POLICY`/caption cũ, `db.pricing` chuẩn hoá ngay khi nạp, đủ 8 hàm tính giá. |
| Số học giá đề xuất | 29 | Chạy hàm thật: mặc định 39.000/49.000, VAT không đổi giá, hao hụt/vận hành làm tăng giá, `same`, phí app ≥ 90 %, làm tròn, `sanitizePricing` với dữ liệu rác, giá vốn 0 không `NaN`, `defaultPricing` trả bản sao. |
| Service worker | 1 | `sw.js` có `CACHE`. |
| Giao diện native | 16 | Viewport khoá zoom + `viewport-fit=cover` (đúng một thẻ), meta iOS, `apple-touch-icon` 180px, `overscroll-behavior:none`, `user-select:none`, `--tap:44px`, input 16px, 3 mức `data-fs`, cuộn trong `.main`, overlay xoay dọc. |
| Bố cục trang | 2 | “＋ Thêm món” nằm cạnh ô tìm trong `.panel-head-tools`, không còn dòng hướng dẫn dài. |
| Phiếu kho & chốt ca | 4 | 4 phiếu một mặt hàng dùng `itemPickerHtml`, 4 chỗ dùng `mode:'flow-*'`, chốt ca lọc theo `sale_issue`, hai panel Công thức dùng chung kiểu. |
| Manifest / icon | 5 | `orientation: portrait`, `display: standalone`, icon 192/512, `id` ổn định, icon PNG có trong `SHELL`. |
| Toàn vẹn dữ liệu (P0) | 9 | `adjust` thay cho ghi đè tồn, phiếu `voided` vẫn giữ lịch sử, không xoá dữ liệu kiểm kê, bắt lỗi hết dung lượng, chống nhập trùng POS, chặn bấm lưu hai lần, bỏ phiếu huỷ khỏi đối soát, migration P0. |
| Chênh lệch theo kỳ | 4 | `varianceReport` thay `db.audits.at(-1)`, chọn kỳ + dòng tổng kết, xuất Excel dùng cùng engine, tính tồn đầu kỳ từ mốc kiểm kê. |
| POS nâng cao | 4 | Map size + topping, bỏ đơn huỷ mà không bỏ nhầm “Hoàn thành”, lưu lượt topping, có mục Cài đặt. |
| Mẻ nấu | 3 | Mã/sản lượng/người làm/hạn dùng, phiếu nấu gắn `batchId`, bảng mẻ nấu gần đây. |
| Vị trí bảo quản | 5 | Xuất kho trừ tồn + ghi nhận tại vị trí, dùng tại chỗ không đổi tồn, `at` dựng lại từ phiếu, có bảng Hàng ngoài kho, phiếu vị trí vào chênh lệch. |
| Kiểm kê nháp & nhật ký | 5 | Lưu nháp không đổi tồn, chốt tạo `adjust` + `approved`, bảng Phiếu kiểm kê có Chốt/Xoá, nhật ký có ghi và xem lại, dashboard có thẻ đối soát. |

**Điều kiện đạt:** in `TẤT CẢ PASS` và exit code `0`.

Nếu `verify.js` báo lỗi cú pháp, **không** sửa tiếp: khôi phục bằng `git checkout -- index.html` rồi làm lại từng bước nhỏ.

## 3. Kiểm thử giao diện bằng Chrome headless

Dùng để chắc chắn app khởi động và render được mà không cần đăng nhập:

```bash
cd /Users/mikepham/Documents/Inventory_milktea
python3 -m http.server 8123 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --user-data-dir=/tmp/chrome-moc \
  --virtual-time-budget=8000 --dump-dom http://127.0.0.1:8123/ > /tmp/dom.html
```

Kiểm tra trong `/tmp/dom.html`:

- Có `class="page active"` và đủ 6 vùng `id="page-*"`: dashboard, inventory, operations, recipes, reconcile, settings.
- Có form đăng nhập (`login-email`) khi đã cấu hình Supabase.
- Không có `Uncaught`, `SyntaxError`, `TypeError` trong log Chrome.

Muốn kiểm tra **chế độ local** (không đăng nhập), làm trên **bản sao** trong `/tmp` với `supabase-config.js` rỗng rồi mở bằng `file://`:

```bash
d=/tmp/moc-headless; rm -rf "$d"; mkdir -p "$d"
cp index.html sw.js manifest.webmanifest icon*.png apple-touch-icon.png "$d"/
printf 'window.MOC_SUPABASE_CONFIG={url:"",anonKey:""};' > "$d/supabase-config.js"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-sandbox --disable-gpu --user-data-dir=/tmp/chrome-moc2 \
  --virtual-time-budget=9000 --enable-logging=stderr \
  --dump-dom "file://$d/index.html" > /tmp/dom-local.html 2>/tmp/chrome-local.log
```

- **Không** dùng `http://` cho bản sao này: app cố ý chặn bằng màn hình “Chưa cấu hình dữ liệu dùng chung” (xem `ARCHITECTURE.md` mục 5).
- Trong `file://`, lỗi CORS của `manifest.webmanifest` là bình thường, không tính là lỗi app.
- Trong môi trường sandbox/CI, thêm `--no-sandbox`; thiếu cờ này Chrome có thể crash `Trace/BPT trap: 5` trước khi render.
- Có thể tiêm script tạm vào bản sao để mô phỏng thao tác (mở form, đổi danh mục, lưu) và đọc kết quả qua `data-test` trên `<body>`. Không sửa trực tiếp tệp thật để test.

Để đo đúng kích thước thiết bị (ví dụ 390×844 và 844×390), dùng một trang bao chứa `<iframe>` có kích thước cố định rồi copy `data-test` từ iframe ra trang cha: `--window-size` của Chrome headless không đảm bảo đúng viewport, còn media query thì luôn tính theo iframe. Harness hiện đo: cỡ chữ, chiều cao vùng chạm, tràn ngang, vị trí sticky/fixed, modal và menu chọn nguyên liệu.

## 4. Kiểm thử thủ công (bắt buộc trước khi phát hành)

### 4.1 Đăng nhập và phân quyền

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập sai mật khẩu | Báo lỗi, không vào app |
| 2 | Đăng nhập chủ quán | Vào dashboard, thấy đủ 6 mục nav |
| 3 | Đăng nhập nhân viên | Không thấy Cài đặt/Món & BOM; không sửa/xóa được phiếu |
| 4 | Đăng nhập quản lý | Không mở được form mặt hàng, công thức, kiểm kê, nhập POS |
| 5 | Quên mật khẩu | Nhận email, đặt lại được mật khẩu, đăng nhập lại thành công |

### 4.2 Sinh mã mặt hàng

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 6 | Mở Cài đặt → Thêm mặt hàng | Ô mã tự điền theo danh mục trống: `NLxxx` |
| 7 | Chọn danh mục `Trà` | Mã thành `NLTR001` (hoặc số kế tiếp) |
| 8 | Đổi danh mục sang `Bao bì` | Mã thành `NLBB001` |
| 9 | Gõ tay mã `TEST01`, rồi đổi danh mục | Mã giữ `TEST01` |
| 10 | Lưu mặt hàng | Xuất hiện trong Tồn kho với đúng mã |
| 11 | Thêm mặt hàng thứ hai cùng danh mục `Trà` | `NLTR002` |
| 12 | Thêm bán thành phẩm | Mã dạng `BTP00x` |
| 13 | Mở form sửa mặt hàng cũ | Mã cũ hiển thị, không tự đổi |
| 14 | Lưu trùng mã đã có | Chặn với thông báo “Mã mặt hàng đã tồn tại.” |
| 15 | Xóa trắng ô mã rồi lưu | Hệ thống tự sinh mã và lưu được |

### 4.2b Chọn nguyên liệu trong form BTP / món (ô tìm kiếm)

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| T1 | Thêm BTP → ＋ Thành phần → bấm “Chọn nguyên liệu” | Menu mở, ô tìm kiếm được focus, danh sách đủ nhóm |
| T2 | Gõ `tra` (không dấu) | Chỉ còn nguyên liệu khớp; tiêu đề nhóm không khớp biến mất |
| T3 | Gõ `Trà` (có dấu) | Kết quả giống T2 |
| T4 | Gõ `bot` | Còn nhóm Bột |
| T5 | Gõ `zzzz` | Danh sách trống, hiện “Không tìm thấy nguyên liệu phù hợp.” |
| T6 | Xóa ô tìm kiếm | Danh sách trở lại đầy đủ, thông báo rỗng biến mất |
| T7 | Bấm một nguyên liệu trong kết quả | Nút chọn hiện đúng tên + đơn vị, menu đóng, dòng BOM dùng đúng nguyên liệu |
| T8 | Làm lại T1–T7 ở form “Món” (＋ Thành phần BOM) | Hành vi giống hệt |

### 4.2c Cấu hình giá đề xuất

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| P1 | Cài đặt → Cấu hình giá đề xuất | Modal mở với giá trị mặc định (FC 30 %, VAT 8 %, phí sàn 25 %, phí khác 4,5 %, làm tròn 10.000/9.000); hộp mô phỏng với giá vốn mẫu 10.000 đ hiện **39.000 đ** tại quán, **49.000 đ** trên app |
| P2 | Đổi VAT 8 % → 20 % | Giá quán và giá app **không đổi**; chỉ dòng “VAT đã gồm” và “Lãi sau thuế” thay đổi |
| P3 | Đổi Food Cost 30 % → 20 % rồi Lưu | Giá đề xuất tăng (59.000/79.000 với giá vốn mẫu); nhãn trên thẻ món ở trang Công thức & món cập nhật ngay; toast “Đã lưu cấu hình giá đề xuất.” |
| P4 | Tải lại trang sau P3 | Cấu hình vẫn là FC 20 % (lưu trong `localStorage`/Supabase), giá đề xuất giữ nguyên |
| P5 | Đặt tổng phí sàn + phí khác + chiết khấu ≥ 90 % rồi Lưu | Chặn lưu, toast “Tổng phí sàn + phí khác + chiết khấu phải nhỏ hơn 90 %”, hộp mô phỏng hiện cảnh báo |
| P6 | Bấm “Khôi phục mặc định” | Form trở về mặc định nhưng **chưa** ghi; chỉ khi bấm “Lưu cấu hình” mới áp dụng |
| P7 | Mở form sửa món có BOM | Khung xem trước giá vốn có nút “Dùng giá này”; bấm → ô giá bán nhận đúng giá đề xuất, Food Cost/lãi gộp tính lại |
| P8 | Thẻ món có giá bán thấp hơn / bằng / dưới giá thành | Hiện đúng nhãn: “Thấp hơn đề xuất X đ” / “Đạt mục tiêu giá” / “Dưới giá thành X đ” |
| P9 | Trang Công thức & món | **Không** có dải cấu hình hay nút sửa riêng; cấu hình chỉ nằm trong Cài đặt |

### 4.3 Nghiệp vụ kho

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 16 | Tạo phiếu nhập 500 g | Tồn tăng 500, phiếu hiện trong danh sách |
| 17 | Xuất quá tồn | Chặn với “vượt tồn hiện tại” |
| 18 | Nấu BTP thiếu nguyên liệu | Chặn, báo nguyên liệu không đủ |
| 19 | Nấu đủ nguyên liệu | BTP tăng, nguyên liệu giảm theo công thức |
| 20 | Đưa BTP ra quầy | BTP giảm ngay |
| 21 | Chốt ca: thu hồi + hủy > đã xuất | Chặn |
| 22 | Sửa phiếu kho | Tồn được tính bù đúng |
| 23 | Xóa phiếu kho | Tồn hoàn lại, không âm |
| 24 | Tải lại trang | Toàn bộ phiếu và tồn còn nguyên |
| 24a | Mở Nhập kho / Xuất thô / Hao hụt / Nấu BTP | Cùng một kiểu chọn: bấm nút → menu tìm kiếm có nhóm → nút hiện tên + đơn vị; không còn ô select hệ thống |
| 24b | Ghi nhận hao hụt | Danh sách chọn có cả nguyên liệu thô và BTP |
| 24c | Xuất đầu ca / Nấu thành phẩm | Bấm “＋ Thêm …” → chọn → dòng mới xuất hiện; chọn lại cùng mặt hàng bị chặn |
| 24d | Chốt ca khi hôm nay chưa xuất gì | Danh sách trống + gợi ý dùng “Xuất đầu ca” |
| 24e | Chốt ca sau khi xuất 2 món ra quầy | Chỉ hiện 2 món đó, đúng số đã xuất; đổi ngày thì danh sách đổi theo |
| 24f | Hủy hàng hỏng chưa từng ra quầy | Không nhập ở chốt ca; dùng “Ghi nhận hao hụt” |

### 4.4 Đối soát, kiểm kê và dữ liệu

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 25 | Nhập file POS CSV | Hiện bảng xem trước, không đổi tồn |
| 26 | Lưu file POS | Có bản ghi đối soát, cảnh báo số dòng không khớp |
| 27 | Kiểm kê chênh lệch | Tồn cập nhật theo số thực tế, có log chênh lệch |
| 27a | Cài đặt → Dữ liệu kho (thu gọn) | 4 dòng mở/đóng: Nhập dữ liệu · Xuất dữ liệu · Tải dữ liệu mẫu · Vùng nguy hiểm; chỉ mở khi bấm |
| 27b | Nhập dữ liệu → chọn tệp Excel | Có hộp xác nhận nêu tên tệp + nhóm trước khi ghi; dòng trùng mã cập nhật, mã mới thêm |
| 27c | Xuất dữ liệu → Xuất Excel theo nhóm | Tải `xuat_<nhóm>_<ngày>.xlsx` có dữ liệu hiện tại |
| 27d | Tải dữ liệu mẫu | Tệp `mau_*.xlsx` **chỉ có tiêu đề**, không kèm dữ liệu cũ |
| 27e | Vùng nguy hiểm → Khôi phục dữ liệu mẫu | Hỏi xác nhận rồi thay toàn bộ bằng dữ liệu demo |
| 27f | Cài đặt | Không còn mục “Định lượng & quy đổi POS” và không còn dải “Đang áp dụng” |

### 4.5 Đồng bộ và sao lưu

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 28 | Sửa trên máy A, mở máy B | Máy B thấy dữ liệu mới sau khi tải lại |
| 29 | Hai máy sửa cùng lúc | Một bên nhận cảnh báo dữ liệu đã đổi |
| 30 | Xuất JSON rồi khôi phục | Dữ liệu trở về đúng bản đã xuất |
| 31 | Cài PWA lên điện thoại | Mở offline vẫn hiện giao diện (dữ liệu cloud cần mạng) |

### 4.6 Cài như app trên điện thoại (native)

Chuẩn bị: mở bản GitHub Pages trên điện thoại, **xoá icon cũ** rồi “Thêm vào màn hình chính”, mở 2 lần để service worker nhận `CACHE` mới.

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| N1 | Mở app đã cài (không có thanh địa chỉ) | Toàn màn hình, không có thanh Safari/Chrome; nội dung không nằm dưới tai thỏ hay home indicator |
| N2 | Pinch 2 ngón | Không zoom; bố cục không đổi |
| N3 | Double-tap vào nút | Không zoom, phản hồi ngay (không trễ 300 ms) |
| N4 | Kéo danh sách xuống khi đang ở đầu trang | Không tải lại trang, không nảy lộ nền |
| N5 | Giữ ngón tay lên chữ | Không bôi đen, không hiện menu copy; trong ô nhập vẫn chọn/copy bình thường |
| N6 | Xoay ngang điện thoại | Hiện màn hình “Xoay điện thoại theo chiều dọc” (Android có thể tự khoá dọc); tablet không bị ảnh hưởng |
| N7 | Mở form nhập kho, chạm ô số lượng | Bàn phím mở, ô nhập không bị che, trang không tự phóng to |
| N8 | Mở một form bất kỳ trên điện thoại | Modal là bottom sheet toàn chiều rộng, nút Lưu/Hủy nằm trong tầm ngón tay và không bị che |
| N9 | Menu tài khoản → Cỡ chữ: Lớn / Rất lớn | Toàn bộ chữ dữ liệu tăng đồng bộ, không tràn ngang; tải lại trang vẫn giữ mức đã chọn |

### 4.7 Đồng đều hiển thị dữ liệu

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| D1 | Dashboard | 4 chỉ số là 4 dòng gọn: nhãn bên trái, số bên phải; không có thẻ cao trống, không xuống dòng lệch |
| D2 | Tồn kho | 4 nút nghiệp vụ xếp 2×2 cao 48px; 3 ô lọc xếp dọc, chữ 16px, cao 46px |
| D3 | Thẻ nguyên liệu cần chú ý | Tên + pill trạng thái cùng dòng; số liệu tồn/ngưỡng thẳng hàng, nhãn 11px |
| D4 | Phiếu kho / Công thức & món | Chữ tên 14–15px, dòng phụ 12px; không còn chỗ nào 9–10px ở nội dung dữ liệu |
| D5 | Bảng desktop (≥641px) | Giữ mật độ gọn: ô 15px, nút 44px, modal 600px |

### 4.8 Vị trí bảo quản (quầy / tủ)

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| L1 | Tồn kho → **Quầy & tủ** → chọn *Xuất ra quầy*, 1 chai sữa, vị trí Quầy bar | Tồn kho giảm đúng số, bảng **Hàng ngoài kho** hiện dòng ở Quầy bar |
| L2 | Mở lại, chọn *Dùng tại chỗ* nhiều hơn số đang ở quầy | Chặn: “Số lượng vượt tồn đang ở …” |
| L3 | *Trả về kho* một phần | Tồn kho tăng lại, số ở quầy giảm tương ứng |
| L4 | Đăng nhập nhân viên, mở **Quầy & tủ** | Chỉ chọn được *Dùng tại chỗ*, không xuất/trả |
| L5 | Cài đặt → Vị trí bảo quản → xoá vị trí còn hàng | Bị chặn; xoá vị trí rỗng thì được và có ghi nhật ký |
| L6 | Sửa/vô hiệu hoá phiếu vị trí | Số “Ngoài kho” được tính lại ngay, không âm |

### 4.9 Mẻ nấu

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| B1 | Nấu BTP với sản lượng thực tế khác kế hoạch | Tồn BTP tăng theo **thực tế**; bảng Mẻ nấu gần đây có mã `ME-YYYYMMDD-001`, đúng người làm |
| B2 | Xem cột hạn dùng | Đúng bằng giờ nấu + số giờ bảo quản; quá hạn hiện pill đỏ |
| B3 | Nấu lần 2 trong cùng ngày | Mã tăng `…-002`; cột tần suất hôm nay của BTP đó = 2 |
| B4 | Mở phiếu xuất nguyên liệu của mẻ | Phiếu nấu và các phiếu xuất thô đều gắn cùng `batchId` |

### 4.10 Kiểm kê nháp → chốt

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| K1 | Kiểm kê, nhập vài số, bấm **Lưu nháp** | Không đổi tồn, không sinh phiếu; bảng Phiếu kiểm kê hiện trạng thái Nháp |
| K2 | Chốt phiếu nháp | Mỗi dòng lệch sinh một phiếu **Điều chỉnh kiểm kê**; tồn = số đếm; phiếu chuyển Đã chốt |
| K3 | Bán/xuất hàng sau khi đếm nhưng trước khi chốt | Khi chốt có cảnh báo N mặt hàng đã thay đổi từ lúc đếm |
| K4 | Thử xoá phiếu đã chốt | Bị chặn, hướng dẫn kiểm kê lại |
| K5 | Thử vô hiệu hoá phiếu điều chỉnh | Bị chặn |
| K6 | Nhập số đếm nhưng để trống hết | Báo “Chưa đếm mặt hàng nào…” và không lưu |

### 4.11 Chênh lệch theo kỳ

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| V1 | Chọn kỳ rồi bấm **Tính lại** | Bảng hiện đầu kỳ, nhập, nấu, xuất ròng, điều chỉnh, lý thuyết, thực tế, chênh lệch |
| V2 | Kỳ có 1 lần kiểm kê | Dòng “Thực tế” lấy đúng số đếm; tổng kết có thiếu/thừa |
| V3 | Kỳ chưa có kiểm kê | Cột thực tế trống, không lỗi |
| V4 | Bấm **Tải báo cáo** | Tải CSV `moc-chenh-lech-<from>_<to>.csv` đúng số trên bảng |
| V5 | Vô hiệu hoá một phiếu xuất trong kỳ | Chênh lệch tự tính lại, phiếu huỷ không còn ảnh hưởng |
| V6 | Panel “So sánh xuất dùng trên app với POS” | Hiện chênh lệch app − POS theo mặt hàng, không đổi tồn |

### 4.12 POS nâng cao

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| R1 | Cài đặt → Topping & tuỳ chọn POS → thêm “Trân châu”, định lượng 30 g | Lưu được; sửa/xoá có ghi nhật ký |
| R2 | Nhập file POS có cột Topping | Số topping khớp được cộng vào tiêu thụ lý thuyết; topping lạ vào `modifierMissing` |
| R3 | File có cột Trạng thái: “Hoàn thành” và “Đã huỷ” | Chỉ bỏ dòng huỷ; dòng “Hoàn thành” vẫn tính |
| R4 | Nhập lại đúng file đó | Bản ghi cũ được **thay thế**, không cộng dồn |
| R5 | Nhập file có dòng số lượng âm | Dòng đó bị bỏ, có đếm vào số đơn huỷ |

### 4.13 Vô hiệu hoá phiếu và nhật ký

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| Q1 | Quản lý vô hiệu hoá một phiếu xuất | Phiếu còn trong lịch sử, có nhãn “Đã huỷ”, tồn được tính bù |
| Q2 | Vô hiệu hoá phiếu làm tồn âm | Bị chặn |
| Q3 | Sửa phiếu kho | Lưu `editedAt`/`editedBy`; đổi ngày/số lượng làm chốt ca tính lại |
| Q4 | Cài đặt → Lịch sử thay đổi | Thấy dòng vừa phát sinh (ai, việc gì, chi tiết), mới nhất ở đầu |
| Q5 | Đổi giá/BOM rồi xem lại nhật ký | Có dòng tương ứng; không có dòng cho từng lần đổi tồn |

## 5. Tiêu chí nghiệm thu

- `node tools/verify.js` → `TẤT CẢ PASS (127 mục)`.
- 100% mục 4.1, 4.2, 4.2c, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.13 PASS.
- Không có lỗi nghiêm trọng (âm kho, mất dữ liệu, không đăng nhập được) ở mục 4.3–4.5, 4.12.
- Không có lỗi console khi thao tác bình thường.
- Trên điện thoại đã cài PWA: không zoom, không kéo tải lại, chữ dữ liệu ≥ 11px và nút bấm ≥ 44px.
- Sau khi áp migration mới: đăng nhập **cả ba vai trò** và lưu một phiếu mỗi loại — đây là bước bắt buộc vì mới chỉ kiểm chứng bằng đọc SQL, chưa chạy trên project thật.

## 6. Ghi nhận kết quả

| Ngày | Người test | `verify.js` | Thủ công | Ghi chú |
|---|---|---|---|---|
| 28/10/2026 | Tự động + headless | 97/97 PASS | Mục 4.2, 4.2b, 4.2c, 4.3 (24a–24f), 4.4 (27a–27f), 4.6, 4.7 PASS | Chưa test đăng nhập thật trên cloud và chưa thử trên máy thật |
| 30/10/2026 | Tự động + headless | **127/127 PASS** | Headless `file://` chế độ local: 6 trang, 1 trang active, không lỗi console (chỉ CORS manifest). Chưa chạy lại 4.1–4.13 trên cloud | Phát hiện rủi ro XSS lưu trữ, nháp kiểm kê làm mốc tính tồn, poll ghi đè khi lưu lỗi — xem `CURRENT_STATUS.md` mục 4 |
