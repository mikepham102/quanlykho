# HongCha Inventory

Ứng dụng quản lý kho trà sữa. Giao diện tĩnh được triển khai bằng GitHub Pages; khi cấu hình Supabase, tài khoản và dữ liệu kho được dùng chung giữa các thiết bị.

## Vai trò

- **Chủ quán:** toàn quyền cấu hình, dữ liệu, tài khoản và phân quyền.
- **Quản lý:** xem dashboard, tồn kho và phiếu kho; tạo, sửa, vô hiệu hoá phiếu vận hành (kể cả phiếu quầy/tủ). Không mở cấu hình mặt hàng, danh mục, công thức hoặc tài khoản.
- **Nhân viên:** xem dashboard, tồn kho và phiếu kho; ghi nghiệp vụ kho (ở quầy/tủ chỉ được ghi “dùng”). Không sửa/vô hiệu hoá phiếu đã lưu hoặc thay đổi cấu hình.

Chủ quán có thể đặt tên thương hiệu, tên chi nhánh và logo tại **Cài đặt → Thương hiệu & chi nhánh**. Logo được thu nhỏ trong trình duyệt và lưu cùng workspace để các thiết bị dùng chung.

Giá bán đề xuất được cấu hình tại **Cài đặt → Cấu hình giá đề xuất**: hao hụt nguyên liệu, chi phí vận hành và khấu hao mỗi tháng, số ly dự kiến, VAT, Food Cost và lợi nhuận mục tiêu, phí sàn và phí khác của app giao đồ ăn, cách làm tròn giá. Hệ thống hiển thị song song **giá tại quán** và **giá trên app**, kèm hộp mô phỏng để thấy ngay cơ cấu chi phí và lãi trước/sau thuế. Giá trị mặc định giữ nguyên cách tính cũ (giá vốn 8.855 đ → 39.000 đ tại quán, 49.000 đ trên app). Chi tiết công thức xem `docs/BUSINESS_RULES.md` mục 6.

Các quyền ghi dữ liệu được kiểm tra lại bằng Supabase RPC, không chỉ ẩn nút trên giao diện. Tài khoản nhân viên được giới hạn thao tác tạo phiếu và các cập nhật tồn phải khớp với phiếu đó.

Ngoài phiếu kho cơ bản, ứng dụng còn ghi được **hàng đang ở quầy/tủ** (tách khỏi tồn kho), **mã mẻ nấu kèm hạn dùng**, **kiểm kê lưu nháp rồi chốt thành phiếu điều chỉnh** (không sửa tồn tay), **báo cáo chênh lệch theo kỳ** và **nhật ký ai sửa cấu hình**. Chi tiết nghiệp vụ xem [BUSINESS_RULES.md](docs/BUSINESS_RULES.md) mục 7–11; kiến trúc xem [ARCHITECTURE.md](docs/ARCHITECTURE.md) mục 10.

## Cài như app trên điện thoại

1. Mở trang GitHub Pages trên điện thoại → trình đơn trình duyệt → **Thêm vào màn hình chính** (iOS: nút Chia sẻ → “Thêm vào MH chính”).
2. Nếu đã cài bản cũ, **xoá icon cũ rồi thêm lại** để nhận icon mới và chế độ toàn màn hình. Mở app 2 lần để service worker cập nhật bản mới.
3. Chạm **avatar ở góc trên phải → Cỡ chữ** để chọn *Chuẩn / Lớn / Rất lớn*. Lựa chọn lưu trên từng thiết bị, áp dụng cho mọi trang và không ảnh hưởng dữ liệu kho.

Khi đã cài ra màn hình chính, ứng dụng khoá phóng to, không kéo tải lại trang, không bôi đen chữ khi giữ tay, và nhắc xoay dọc nếu điện thoại đang nằm ngang. Chi tiết kỹ thuật xem `docs/ARCHITECTURE.md` mục 9.

## Kết nối Supabase

1. Tạo project Supabase. Trong **Project Settings → API**, lấy Project URL và anon/public key.
2. Điền hai giá trị đó vào `supabase-config.js`. Đây là cấu hình công khai của trình duyệt; không đưa `service_role` key vào tệp này.
3. Chạy `supabase/migrations/20261020_accounts_and_workspace.sql` trong SQL Editor.
4. Nếu tài khoản đã được tạo trước khi cài migration, chạy tiếp `supabase/migrations/20261021_backfill_existing_user_profiles.sql` để tạo hồ sơ vai trò còn thiếu.
4b. Chạy tiếp ba migration mới theo đúng thứ tự: `20261028_integrity_audit_adjust.sql`, `20261029_locations.sql`, `20261030_stocktake_drafts.sql`. Thiếu file cuối, phiếu vị trí (quầy/tủ) và phiếu kiểm kê nháp sẽ bị server từ chối dù giao diện vẫn cho bấm.
5. Tạo tài khoản chủ quán trong **Authentication → Users** (hoặc dùng luồng đăng ký do Supabase cung cấp), rồi gán vai trò bằng câu SQL bootstrap ở cuối migration, thay `OWNER_EMAIL` bằng email chủ quán. Chạy câu này sau bước backfill để cập nhật đúng hồ sơ.
6. Cài Supabase CLI, đăng nhập và deploy Edge Function `invite-user`. Function cần secrets do Supabase quản lý; `SUPABASE_SERVICE_ROLE_KEY` chỉ được dùng ở Edge Function, không bao giờ gửi xuống trình duyệt.
7. Cấu hình **Authentication → URL Configuration**: đặt `https://mikepham102.github.io/quanlykho/` làm Site URL và thêm `https://mikepham102.github.io/quanlykho/**` vào Redirect URLs. Luồng quên mật khẩu trong ứng dụng chuyển hướng cố định về địa chỉ GitHub Pages này.

Màn hình đăng nhập có nút **Quên mật khẩu?**. Người dùng nhận email khôi phục, mở liên kết trên trang GitHub Pages, rồi đặt mật khẩu mới trong ứng dụng. Nếu mẫu email được tùy chỉnh, nút trong email cần dùng `{{ .ConfirmationURL }}` để Supabase xử lý token và chuyển về ứng dụng.

Đổi mật khẩu và quyền truy cập kho là hai bước riêng. Sau khi lưu mật khẩu, nếu đăng nhập báo chưa có dữ liệu kho dùng chung, hãy chạy backfill ở bước 4 và đặt đúng tài khoản chủ quán thành `owner` bằng câu SQL ở bước 5. Chủ quán đăng nhập sẽ khởi tạo workspace đầu tiên; tài khoản quản lý và nhân viên chỉ vào được sau đó.

Khi chủ quán đăng nhập lần đầu, nếu workspace chưa có dữ liệu, ứng dụng sẽ khởi tạo workspace từ dữ liệu trình duyệt đang mở. Để chuyển dữ liệu hiện có từ bản `file://` sang GitHub Pages, hãy tải bản sao lưu JSON trong bản cũ, đăng nhập chủ quán ở bản mới, rồi khôi phục tệp JSON trong Cài đặt. Sau đó Supabase là nguồn dữ liệu dùng chung.

## GitHub Pages

Workflow `.github/workflows/deploy.yml` triển khai nội dung repository khi có push lên nhánh `main`. Trong GitHub, bật **Settings → Pages → Build and deployment → GitHub Actions**. Sau khi có URL repository, kiểm tra nhánh mặc định trước khi dùng workflow.

## Chạy độc lập

Nếu `supabase-config.js` để trống, ứng dụng dùng `localStorage` như trước — nhưng **chỉ khi mở tệp trực tiếp** (`file://`). Mở qua `http(s)://` mà chưa cấu hình Supabase sẽ hiện màn hình “Chưa cấu hình dữ liệu dùng chung” và chặn truy cập, để tránh phát hành nhầm bản không có dữ liệu chung. Chế độ này không có tài khoản hoặc phân quyền; không dùng cấu hình trống khi phát hành bản dùng chung.

## Mã hàng tự động

Khi thêm mặt hàng mới, mã được sinh theo danh mục và ô mã tự cập nhật khi bạn đổi danh mục:

| Danh mục | Tiền tố | Ví dụ |
|---|---|---|
| Trà | `NLTR` | `NLTR001` |
| Chất lỏng (sữa, syrup, nước, kem) | `NLCL` | `NLCL001` |
| Bột | `NLBT` | `NLBT001` |
| Topping, trân châu | `NLTP` | `NLTP001` |
| Trái cây, mứt, sinh tố | `NLTC` | `NLTC001` |
| Bao bì | `NLBB` | `NLBB001` |
| Khác | `NL` | `NL008` |
| Bán thành phẩm | `BTP` | `BTP003` |

Gõ tay vào ô mã sẽ tắt tự động cho lần nhập đó. Mã của mặt hàng đã lưu không tự đổi khi sửa. Chi tiết xem `docs/BUSINESS_RULES.md`.

## Kiểm tra sau khi sửa giao diện

Toàn bộ ứng dụng nằm trong `index.html`, nên sau mỗi lần sửa hãy chạy:

```bash
node tools/verify.js
```

Script kiểm tra cú pháp, cấu trúc tệp, hàm trùng, logic sinh mã, ô tìm kiếm nguyên liệu, công thức giá đề xuất, giao diện native, bộ chọn mặt hàng trong phiếu kho, toàn vẹn dữ liệu (adjust/void), chênh lệch theo kỳ, POS nâng cao, mẻ nấu, vị trí bảo quản và kiểm kê nháp (**127 mục**). Sau đó tăng `CACHE` trong `sw.js` để trình duyệt nhận bản mới.

Tài liệu **không** cần sửa sau mỗi thay đổi: chỉ thêm một dòng vào `docs/_PENDING.md`, và cập nhật các file trong `docs/` khi có yêu cầu “chốt docs” (xem `docs/ARCHITECTURE.md` mục 12.1).

## Git và sao lưu

Repository đã được khởi tạo; mỗi thay đổi nên được commit. Thư mục `backups/` (không commit) giữ bản `index.html` trước khi sửa và bản production đã biết là tốt. Khi cần quay lui: `git checkout -- index.html`.

## Dữ liệu

- `schema.sql` giữ mô hình bảng PostgreSQL tham khảo ban đầu.
- Migration mới bổ sung hồ sơ vai trò, dữ liệu workspace JSON, RPC có kiểm tra quyền và quản lý tài khoản.
- Tệp cấu hình trình duyệt chỉ chứa URL và anon/public key. Khóa `service_role` chỉ lưu trong secrets của Supabase Edge Function.
