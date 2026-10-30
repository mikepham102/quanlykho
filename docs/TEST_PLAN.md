# TEST PLAN — Kế hoạch kiểm thử

> Cập nhật: 28/10/2026. Áp dụng cho app một tệp `index.html` + Supabase.

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

Script kiểm tra 97 mục:

1. Kích thước tệp hợp lý, **đúng một** `</script></body></html>`, tệp kết thúc bằng `</html>`.
2. Cú pháp từng khối `<script>` nội tuyến bằng `vm.Script`.
3. Không có hàm khai báo trùng (dấu hiệu tệp bị ghép lỗi).
4. Tồn tại đủ `normalizePosKey`, `rawCodePrefix`, `nextItemCode`, `syncItemCode`.
5. 13 trường hợp map danh mục → prefix.
6. 4 trường hợp sinh mã kế tiếp (kể cả bỏ qua mã khác prefix).
7. `syncItemCode` không ném lỗi khi form chưa tồn tại.
8. Ô tìm kiếm nguyên liệu: có luật `[hidden] { display:none !important }`, hàm lọc dùng `normalizePosKey`, ẩn tiêu đề nhóm rỗng, có thông báo “không tìm thấy”.
9. `sw.js` có khai báo `CACHE`.
10. Cấu hình giá: Cài đặt có mục “Cấu hình giá đề xuất”, không còn hằng số `PRICING_POLICY`/caption cũ, `db.pricing` được chuẩn hóa ngay khi nạp, đủ 8 hàm tính giá.
11. Số học giá đề xuất (chạy hàm thật tách từ `index.html`): mặc định 39.000/49.000, VAT không làm đổi giá, hao hụt và vận hành làm tăng giá, chế độ “bằng giá quán”, phí app ≥ 90 %, làm tròn, `sanitizePricing` với dữ liệu rác, giá vốn 0 không sinh `NaN`, `defaultPricing` trả bản sao.
12. Giao diện native: viewport khoá zoom + `viewport-fit=cover` (đúng **một** thẻ), meta iOS chạy toàn màn hình, `apple-touch-icon` 180px tồn tại, `overscroll-behavior:none`, `user-select:none`, `--tap:44px`, input 16px, 3 mức `data-fs`, mobile cuộn trong `.main`, overlay xoay dọc, icon PNG có trong `SHELL`, manifest `orientation/display/icons/id`.
13. Đồng đều hiển thị: dashboard dùng `.metric-line` và ẩn chú thích trên mobile, bộ lọc Tồn kho xếp dọc 46px chữ 16px, nút nghiệp vụ Tồn kho 48px, chữ dữ liệu dùng `calc(var(--fs-body) …)`.
14. Công thức & món: nút “＋ Thêm món” nằm cạnh ô tìm trong `.panel-head-tools`, không còn ở `page-head`, hai panel dùng chung một kiểu, không còn dòng hướng dẫn dài.
15. Phiếu kho & chốt ca: đủ 4 phiếu một mặt hàng dùng `itemPickerHtml` (không còn `<select id="f-item">` thô), 4 chỗ dùng bộ chọn `mode:'flow-*'`, không còn `addFlowLine`/`flow-*-search`; chốt ca lọc theo `sale_issue` và có `#dayclose-list`.
16. Cài đặt & dữ liệu: không còn 2 mục trùng (Định lượng & quy đổi POS, dải “Đang áp dụng”), đúng 3 khối `<details>` + vùng nguy hiểm, có `exportXlsx`, mẫu Excel là mẫu trống (`mode='template'`).

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

Với chế độ local (bỏ trống `supabase-config.js`), có thể tiêm script tạm vào **bản sao** trong `/tmp` để mô phỏng thao tác (mở form, đổi danh mục, lưu) và đọc kết quả qua `data-test` trên `<body>`. Không sửa trực tiếp tệp thật để test.

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

## 5. Tiêu chí nghiệm thu

- `node tools/verify.js` → `TẤT CẢ PASS`.
- 100% mục 4.1, 4.2, 4.2c, 4.6 và 4.7 PASS.
- Không có lỗi nghiêm trọng (âm kho, mất dữ liệu, không đăng nhập được) ở mục 4.3–4.5.
- Không có lỗi console khi thao tác bình thường.
- Trên điện thoại đã cài PWA: không zoom, không kéo tải lại, chữ dữ liệu ≥ 11px và nút bấm ≥ 44px.

## 6. Ghi nhận kết quả

| Ngày | Người test | `verify.js` | Thủ công | Ghi chú |
|---|---|---|---|---|
| 28/10/2026 | Tự động + headless | 97/97 PASS | Mục 4.2, 4.2b, 4.2c, 4.3 (24a–24f), 4.4 (27a–27f), 4.6, 4.7 PASS | Chưa test đăng nhập thật trên cloud và chưa thử trên máy thật |
