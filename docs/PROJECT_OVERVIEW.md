# PROJECT OVERVIEW — Mộc Inventory

> Cập nhật: 30/10/2026. Tài liệu này mô tả **đúng** hệ thống đang chạy, không phải thiết kế dự kiến.

## 1. Mục tiêu

Ứng dụng quản lý kho cho quán trà sữa, chạy hoàn toàn trên trình duyệt:

- Theo dõi tồn nguyên liệu thô (trà, sữa, bột, topping, bao bì…).
- Quản lý bán thành phẩm (BTP) nấu theo mẻ, có công thức, **mã mẻ và hạn dùng**.
- Ghi nghiệp vụ kho hằng ngày: nhập, xuất thô, nấu, đưa BTP ra quầy, thu hồi, hủy, hao hụt; ghi riêng **hàng đang ở quầy/tủ** so với trong kho.
- Đối soát với file bán hàng của POS (CSV/XLSX), có nhận diện **size/topping**, bỏ qua đơn huỷ và chống nhập trùng file.
- Kiểm kê **lưu nháp → chốt phiếu**, mỗi dòng lệch sinh phiếu điều chỉnh thay vì sửa tồn tay; xem **chênh lệch theo kỳ** và báo cáo kiểm kê.
- Mọi thao tác huỷ phiếu là **vô hiệu hoá** (giữ lịch sử), và có **nhật ký ai đổi cấu hình**.
- Gợi ý **giá bán tại quán** và **giá trên app giao đồ ăn** theo chính sách cấu hình được (hao hụt, vận hành, khấu hao, VAT, Food Cost, lợi nhuận mục tiêu, phí sàn).
- Dùng chung dữ liệu nhiều thiết bị qua Supabase, có phân quyền chủ quán / quản lý / nhân viên.
- Cài ra màn hình chính và dùng như app điện thoại: không zoom, không kéo tải lại, chữ và nút lớn, 3 mức cỡ chữ.

## 2. Người dùng và vai trò

| Vai trò | Quyền chính |
|---|---|
| `owner` (chủ quán) | Toàn quyền: cấu hình mặt hàng, danh mục, công thức, kiểm kê, nhập POS, tài khoản, thương hiệu. |
| `manager` (quản lý) | Xem dashboard, tồn kho, phiếu kho; tạo/sửa/vô hiệu hoá phiếu vận hành (kể cả phiếu vị trí). Không đổi cấu hình và không nhập POS/kiểm kê. |
| `employee` (nhân viên) | Xem dashboard, tồn kho, phiếu kho; chỉ **tạo** phiếu kho (và chỉ ghi “dùng” ở quầy/tủ). Không sửa/vô hiệu hoá phiếu đã lưu. |

Quyền được kiểm tra hai lớp: ẩn nút trên giao diện (`applyRolePermissions`) và chặn thật ở RPC `save_workspace_state` phía Supabase.

## 3. Sáu trang chức năng

| Trang | ID | Nội dung |
|---|---|---|
| Tổng quan | `page-dashboard` | KPI tồn kho, mặt hàng dưới ngưỡng, **thẻ đối soát kiểm kê** (thiếu/thừa, phiếu nháp), hoạt động gần nhất; 5 nút nghiệp vụ nhanh. |
| Tồn kho | `page-inventory` | Danh sách nguyên liệu/BTP, cảnh báo dưới định mức, bảng **Hàng ngoài kho (quầy/tủ)** + nút **Xuất / dùng / trả**. |
| Phiếu kho | `page-operations` | Phiếu theo ngày và loại; sửa phiếu, **vô hiệu hoá** (trừ nhân viên). |
| Món & BOM | `page-recipes` | Món POS, size, giá, định lượng cho một ly; giá vốn, Food Cost, giá đề xuất quán/app; bảng **Mẻ nấu gần đây** (hạn dùng, tần suất). |
| Đối soát | `page-reconcile` | Nhập file POS (size/topping, bỏ đơn huỷ), **chênh lệch kiểm kê theo kỳ**, **phiếu kiểm kê nháp/chốt**, so sánh xuất dùng với POS. |
| Cài đặt | `page-settings` | Mặt hàng, BTP, danh mục, nhà cung cấp, thương hiệu, giá đề xuất, **vị trí bảo quản**, **topping & tuỳ chọn POS**, **lịch sử thay đổi**, tài khoản và panel **Dữ liệu kho** chia nhóm mở–đóng. |

## 4. Công nghệ thực tế

- **Frontend:** một file `index.html` duy nhất (~311 KB, 300.132 ký tự, 219 hàm JavaScript thuần), CSS nhúng trong 12 khối `<style>`, 4 khối `<script>`, không có build step, không framework.
- **PWA:** `manifest.webmanifest`, `sw.js` (cache shell `moc-inventory-shell-v22`), `icon.svg` + `icon-192.png` + `icon-512.png` + `apple-touch-icon.png`.
- **Giao diện native:** một khối CSS cuối cùng chứa token cỡ chữ (`--fs-*`), khung cuộn `.main` và khoá hành vi web; 3 mức cỡ chữ lưu ở `localStorage['moc-display-v1']` (xem `ARCHITECTURE.md` mục 9).
- **Dữ liệu:** Supabase Postgres + Auth, toàn bộ workspace lưu trong **một bản ghi JSONB** (`workspace_state.state`).
- **Đồng bộ:** RPC `load_workspace_state` / `save_workspace_state` (và `replace_workspace_state` khi khôi phục JSON), có kiểm tra `_revision` để tránh ghi đè; server còn tự kiểm tra tồn khớp với phiếu.
- **Triển khai:** GitHub Pages qua `.github/workflows/deploy.yml` khi push lên `main`.
- **Chạy offline / không cấu hình:** nếu `supabase-config.js` trống, app dùng `localStorage` key `moc-inventory-v1` với dữ liệu demo — **chỉ khi mở tệp trực tiếp** (`file://`). Mở qua `http(s)://` mà chưa cấu hình Supabase sẽ bị chặn bằng màn hình “Chưa cấu hình dữ liệu dùng chung”.

### Không tồn tại trong dự án này

React, TypeScript, Express, MongoDB, Jest, `package.json`, `src/`, `server/`, API `/api/settings`. Mọi tài liệu cũ nhắc tới các thành phần này là **sai** và đã được thay thế.

## 5. Quy ước mã hàng (tóm tắt)

Mã sinh tự động theo danh mục, dạng `<PREFIX><3 chữ số>`:

| Danh mục | Prefix | Ví dụ |
|---|---|---|
| Trà | `NLTR` | `NLTR001` |
| Chất lỏng (sữa, syrup, nước, kem) | `NLCL` | `NLCL001` |
| Bột | `NLBT` | `NLBT001` |
| Topping / trân châu | `NLTP` | `NLTP001` |
| Trái cây / mứt / sinh tố | `NLTC` | `NLTC001` |
| Bao bì | `NLBB` | `NLBB001` |
| Khác (mặc định) | `NL` | `NL008` |
| Bán thành phẩm | `BTP` | `BTP003` |

Chi tiết quy tắc xem `BUSINESS_RULES.md`, cách cài đặt xem `ARCHITECTURE.md`.
