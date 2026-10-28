# HONGCHA Inventory

Ứng dụng quản lý kho trà sữa. Giao diện tĩnh được triển khai bằng GitHub Pages; khi cấu hình Supabase, tài khoản và dữ liệu kho được dùng chung giữa các thiết bị.

## Vai trò

- **Chủ quán:** toàn quyền cấu hình, dữ liệu, tài khoản và phân quyền.
- **Quản lý:** xem dashboard, tồn kho và phiếu kho; tạo, sửa, xóa phiếu vận hành. Không mở cấu hình mặt hàng, danh mục, công thức hoặc tài khoản.
- **Nhân viên:** xem dashboard, tồn kho và phiếu kho; ghi nghiệp vụ kho. Không sửa/xóa phiếu đã lưu hoặc thay đổi cấu hình.

Chủ quán có thể đặt tên thương hiệu, tên chi nhánh và logo tại **Cài đặt → Thương hiệu & chi nhánh**. Logo được thu nhỏ trong trình duyệt và lưu cùng workspace để các thiết bị dùng chung.

Các quyền ghi dữ liệu được kiểm tra lại bằng Supabase RPC, không chỉ ẩn nút trên giao diện. Tài khoản nhân viên được giới hạn thao tác tạo phiếu và các cập nhật tồn phải khớp với phiếu đó.

## Kết nối Supabase

1. Tạo project Supabase. Trong **Project Settings → API**, lấy Project URL và anon/public key.
2. Điền hai giá trị đó vào `supabase-config.js`. Đây là cấu hình công khai của trình duyệt; không đưa `service_role` key vào tệp này.
3. Chạy `supabase/migrations/20261020_accounts_and_workspace.sql` trong SQL Editor.
4. Tạo tài khoản chủ quán trong **Authentication → Users** (hoặc dùng luồng đăng ký do Supabase cung cấp), rồi chạy câu SQL bootstrap ở cuối migration, thay `OWNER_EMAIL` bằng email chủ quán. Chỉ chủ quán đầu tiên cần gán thủ công.
5. Cài Supabase CLI, đăng nhập và deploy Edge Function `invite-user`. Function cần secrets do Supabase quản lý; `SUPABASE_SERVICE_ROLE_KEY` chỉ được dùng ở Edge Function, không bao giờ gửi xuống trình duyệt.
6. Cấu hình **Authentication → URL Configuration**: đặt URL GitHub Pages làm Site URL và thêm URL đó vào Redirect URLs (bao gồm đường dẫn `index.html`) để nhận liên kết mời và khôi phục mật khẩu.

Màn hình đăng nhập có nút **Quên mật khẩu?**. Người dùng nhận email khôi phục, mở liên kết trên trang GitHub Pages, rồi đặt mật khẩu mới trong ứng dụng. Supabase chỉ chấp nhận chuyển hướng đã khai báo trong Redirect URLs.

Khi chủ quán đăng nhập lần đầu, nếu workspace chưa có dữ liệu, ứng dụng sẽ khởi tạo workspace từ dữ liệu trình duyệt đang mở. Để chuyển dữ liệu hiện có từ bản `file://` sang GitHub Pages, hãy tải bản sao lưu JSON trong bản cũ, đăng nhập chủ quán ở bản mới, rồi khôi phục tệp JSON trong Cài đặt. Sau đó Supabase là nguồn dữ liệu dùng chung.

## GitHub Pages

Workflow `.github/workflows/deploy.yml` triển khai nội dung repository khi có push lên nhánh `main`. Trong GitHub, bật **Settings → Pages → Build and deployment → GitHub Actions**. Sau khi có URL repository, kiểm tra nhánh mặc định trước khi dùng workflow.

## Chạy độc lập

Nếu `supabase-config.js` để trống, ứng dụng tiếp tục dùng `localStorage` như trước. Chế độ này không có tài khoản hoặc phân quyền; không dùng cấu hình trống khi phát hành bản dùng chung.

## Dữ liệu

- `schema.sql` giữ mô hình bảng PostgreSQL tham khảo ban đầu.
- Migration mới bổ sung hồ sơ vai trò, dữ liệu workspace JSON, RPC có kiểm tra quyền và quản lý tài khoản.
- Tệp cấu hình trình duyệt chỉ chứa URL và anon/public key. Khóa `service_role` chỉ lưu trong secrets của Supabase Edge Function.
