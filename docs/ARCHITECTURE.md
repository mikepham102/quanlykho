# ARCHITECTURE — Kiến trúc thực tế

> Cập nhật: 28/10/2026.

## 1. Sơ đồ tổng thể

```
Trình duyệt (PWA, GitHub Pages)
┌──────────────────────────────────────────────────────────┐
│ index.html — toàn bộ UI + logic                          │
│  • db (object JS)  ← nguồn dữ liệu trong RAM             │
│  • renderAll()     ← vẽ lại 6 trang sau mỗi thay đổi     │
│  • openModal()/saveForm() ← form và nghiệp vụ            │
│  • save()          ← localStorage + đẩy lên cloud        │
└───────────────┬──────────────────────────────────────────┘
                │ supabase-js (ESM từ CDN)
                ▼
Supabase
┌──────────────────────────────────────────────────────────┐
│ Auth: đăng nhập email/mật khẩu, reset password           │
│ RPC:  current_workspace_role, load_workspace_state,      │
│       save_workspace_state, list_workspace_users,        │
│       change_workspace_role                              │
│ Bảng: profiles (vai trò), workspace_state (JSONB)        │
│ Edge Function: invite-user (dùng service_role ở server)  │
└──────────────────────────────────────────────────────────┘
```

Không có server ứng dụng riêng, không có build, không có bundler.

## 2. Bản đồ tệp

| Tệp | Vai trò |
|---|---|
| `index.html` | Toàn bộ ứng dụng: HTML, CSS, JS. Sửa trực tiếp. |
| `supabase-config.js` | `window.MOC_SUPABASE_CONFIG = { url, anonKey }`. Để trống → chế độ local. |
| `sw.js` | Service worker, cache shell. **Tăng số `CACHE` mỗi lần sửa `index.html`.** |
| `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Cài đặt PWA: `display: standalone`, `orientation: portrait`, icon PNG cho Android và iOS (180px, nền đặc). |
| `schema.sql` | Mô hình quan hệ tham khảo ban đầu — **không được chạy**, app không dùng. |
| `supabase/migrations/20261020_accounts_and_workspace.sql` | Tạo `profiles`, `workspace_state`, RLS và các RPC. Bắt buộc chạy. |
| `supabase/migrations/20261021_backfill_existing_user_profiles.sql` | Bổ sung hồ sơ vai trò cho tài khoản tạo trước migration. |
| `supabase/functions/invite-user/index.ts` | Edge Function mời tài khoản. |
| `.github/workflows/deploy.yml` | Deploy GitHub Pages khi push `main`. |
| `docs/` | Tài liệu. `docs/_PENDING.md` là sổ ghi thay đổi chờ chốt vào tài liệu. `backups/` (không commit) chứa bản sao lưu `index.html`. |

## 3. Mô hình dữ liệu trong RAM

`db` là một object duy nhất, chính là nội dung JSONB lưu trên Supabase:

```
db = {
  brand:        { name, branch, logo },
  pricing:      { …cấu hình giá đề xuất… },
  items:        [ item ],
  pos:          [ dish ],
  ops:          [ operation ],
  imports:      [ posImport ],
  audits:       [ audit ],
  suppliers:    [ string ],
  categories:   [ string ],
  favorites:    { raw: [], prep: [] },
  periodStart:  number,
  _revision:    number
}
```

Chi tiết từng trường xem `DATABASE_SCHEMA.md`.

## 4. Luồng khởi động

1. `index.html` nạp `supabase-config.js`, `@supabase/supabase-js` (CDN) và script chính.
2. Nếu **không** có cấu hình → `cloudMode = false`, dùng dữ liệu demo + `localStorage`, bỏ qua đăng nhập.
3. Nếu có cấu hình → hiện màn hình đăng nhập; sau khi đăng nhập:
   - `current_workspace_role` → `cloudRole`.
   - `load_workspace_state` → trả JSONB; nếu chưa có và vai trò là `owner` thì khởi tạo từ dữ liệu hiện có trên máy.
   - `applyRolePermissions()` ẩn trang/nút theo vai trò rồi `renderAll()`.
4. Mọi thay đổi gọi `save()`.

## 5. Luồng ghi dữ liệu

```
thao tác người dùng
   → sửa db trong RAM
   → save()
       ├─ localStorage.setItem('moc-inventory-v1', JSON.stringify(db))
       ├─ renderAll()
       └─ cloudMode: xếp hàng vào cloudSaveQueue
             → rpc('save_workspace_state', { p_state: db })
             → trả về số revision mới, gán db._revision
             → lỗi "đã đổi trên thiết bị khác" → toast cảnh báo
```

Ghi tuần tự bằng `cloudSaveQueue` để hai lần lưu liên tiếp không ghi đè nhau. `lastCloudSnapshot` giữ bản cuối đã đồng bộ để gắn `createdBy` cho phiếu mới.

## 6. Phân quyền

- **Giao diện:** `applyRolePermissions()` gán `body.dataset.role`, ẩn nav `[data-page]` không được phép (`roleCanOpen`), chuyển về dashboard nếu trang hiện tại bị cấm.
- **Mở form:** `openModal()` chặn theo vai trò (ví dụ quản lý không mở được `item`, `recipe`, `audit`, `import`).
- **Sửa phiếu:** `roleCanEditOperations()` → `employee` không được sửa/xóa phiếu.
- **Server:** RPC `save_workspace_state` kiểm tra vai trò và chỉ cho phép nhân viên thêm phiếu, không sửa cấu hình.

## 7. Sinh mã mặt hàng tự động

Ba hàm nằm ngay trước `openModal()`:

| Hàm | Nhiệm vụ |
|---|---|
| `rawCodePrefix(category)` | Chuẩn hóa danh mục bằng `normalizePosKey` (bỏ dấu, lowercase), so khớp **theo từ** để tránh nhầm "Trái cây"/"Trân châu" thành "Trà", trả prefix. |
| `nextItemCode(prefix, type)` | Quét `db.items` cùng `type`, regex `^<prefix>(\d+)$`, lấy max rồi `+1`, pad 3 chữ số. |
| `syncItemCode(kind)` | Chỉ chạy khi ô mã có `dataset.autoCode === '1'`; đọc `#f-cat` **sau khi** modal đã render. |

Luồng trên giao diện:

1. Mở form thêm mới → `openModal` đặt `f-code.dataset.autoCode='1'` rồi gọi `syncItemCode`.
2. Người dùng nhập/đổi danh mục → `oninput="syncItemCode('raw')"` cập nhật mã ngay.
3. Người dùng tự gõ vào ô mã → `oninput` đặt `autoCode='0'`, dừng tự sinh.
4. Lưu: nếu ô mã rỗng, `saveForm` tự sinh trước khi kiểm tra trùng.
5. Mở form **sửa** → `record` tồn tại nên không bật auto, mã cũ giữ nguyên.

> Bài học: bản lỗi trước đây đọc `#f-cat` **trước** khi `#modal` có nội dung nên `null.value` làm hỏng form. Mọi truy cập DOM phải sau `m.innerHTML = ...`.

## 8. Cấu hình giá đề xuất

Khối tính giá là hàm thuần, **không đụng DOM**, khai báo ngay sau `const KEY` và **trước** `let db`, vì `sanitizePricing()` được gọi ngay trong dòng khởi tạo `db` (nếu đặt sau sẽ vướng TDZ của `const PRICING_DEFAULTS`).

| Hàm | Nhiệm vụ |
|---|---|
| `defaultPricing()` | Trả **bản sao** của `PRICING_DEFAULTS`. |
| `clampNumber(v, min, max, fallback)` | Ép số và kẹp khoảng; giá trị không phải số → `fallback`. |
| `sanitizePricing(raw)` | Chuẩn hóa toàn bộ `db.pricing`; bù mặc định cho dữ liệu cũ/JSON thiếu trường. |
| `pricingPolicy()` | `sanitizePricing(db.pricing)` — nơi duy nhất đọc cấu hình hiện hành. |
| `roundPrice(n, policy)` | Làm tròn lên theo `roundStep/roundTail/roundMin`. |
| `priceModel(cost, policy)` | Trả toàn bộ số liệu: chi phí/ly, giá thô, giá làm tròn, VAT, lãi trước/sau thuế, FC%, margin%. |
| `suggestedMenuPrices(cost)` | Vỏ tương thích: `{ store, foodApp, foodAppRaw, storeRaw, model }`. |
| `pricingCaption(policy)` | Chuỗi mô tả cấu hình, chỉ dùng trong thẻ món ở trang Công thức & món. |
| `roundUpTo9k(v)` | Giữ lại cho mã cũ; nay là `roundPrice` với tham số 10.000/9.000. |

Giao diện — **một chỗ duy nhất**: mục **Cài đặt → Cấu hình giá đề xuất** (chỉ chủ quán mở được).

| Hàm | Vị trí | Nhiệm vụ |
|---|---|---|
| `openPricingSettings()` | cạnh `openBrandSettings` | Dựng modal “Cấu hình giá đề xuất” 4 nhóm trường + ô mẫu + `#price-sim`, chặn nếu không phải owner. |
| `readPricingForm()` | nt | Đọc form, ô trống → mặc định (không đọc DOM trước khi modal render). |
| `renderPricingSim()` | nt | Vẽ 3 thẻ: cơ cấu chi phí, giá quán, giá app + cảnh báo. |
| `savePricingSettings()` | nt | Validate, ghi `db.pricing`, `localStorage`, đẩy cloud qua `cloudSaveQueue`, hoàn tác nếu lỗi. |
| `resetPricingSettings()` | nt | Nạp lại giá trị mặc định vào form (chưa ghi). |
| `applySuggestedPrice(v)` | nt | Điền giá đề xuất vào `#f-price` rồi `updateBomCostPreview()`. |

`recipeVariantContent()` và `updateBomCostPreview()` gọi `priceModel()` thay cho hằng số cũ, nên đổi cấu hình là mọi nơi cập nhật ngay sau `renderAll()`.

Trang Công thức & món **không** còn dải cấu hình hay nút sửa riêng: chỉ thẻ món hiển thị giá đề xuất + `pricingCaption()`. Cấu hình trước đây từng có dải `#recipe-policy-strip` rồi `#pricing-policy-strip` trong Cài đặt — cả hai đã gỡ để tránh trùng với chính mục “Cấu hình giá đề xuất”.

> Bài học: mọi hàm đọc form phải gọi **sau** `m.innerHTML = …`; `readPricingForm()` trả mặc định khi phần tử chưa tồn tại nên không ném lỗi.

## 9. Giao diện native trên điện thoại và thang chữ

Toàn bộ phần này nằm trong **một khối `<style>` cuối cùng** của `index.html`, ghi đè có chủ đích lên 13 khối CSS cũ (không sửa rải rác). Khối này chia 3 tầng: token → kiểu chữ dữ liệu → khung mobile.

### 9.1 Token cỡ chữ (3 mức)

| Biến | Chuẩn | Lớn (`data-fs="lg"`) | Rất lớn (`data-fs="xl"`) |
|---|---|---|---|
| `--fs-body` | 16px | 17.5px | 19px |
| `--fs-sm` | 12.5px | 14px | 15.5px |
| `--fs-xs` | 11px | 12.5px | 14px |
| `--fs-btn` | 15px | 16.5px | 18px |
| `--fs-title` | 16px | 17.5px | 19px |
| `--fs-h1` | 25px | 27px | 29px |
| `--fs-nav` | 11.5px | 12.5px | 13.5px |
| `--tap` / `--tap-lg` | 44px / 48px | – | – |

- Token đặt trên `:root`; mức lớn/rất lớn đặt trên `html[data-fs="…"]` nên **không** cần sửa từng rule.
- Chữ dữ liệu (không phải tiêu đề) dùng `calc()` để co giãn theo mức: `calc(var(--fs-body) - 4px)` cho dòng phụ, `- 3px` cho nhãn, `- 2px` cho chữ chính trong thẻ. Không hard-code px cho chữ dữ liệu mới.
- Các selector trong khối native được viết dạng `:root .xxx` để thắng các luật cũ có 2 lớp (ví dụ `.grid2 .panel-sub{font-size:10px}`), tránh phải dùng `!important`.

### 9.2 Lưu và áp dụng lựa chọn

- `localStorage['moc-display-v1'] = { fs: 'normal' | 'lg' | 'xl' }` — **thuộc thiết bị**, không đồng bộ cloud, không nằm trong `db`.
- Một `<script>` nhỏ trong `<head>` đặt `document.documentElement.dataset.fs` **trước khi vẽ** để không nháy giao diện.
- Hàm: `displayPrefs()`, `applyDisplayPrefs()`, `fsLabel()`, `fontSizeControlHtml()`, `setFontSize(level)`; gọi lần đầu trong `initNativeShell()`.
- Giao diện đổi: menu tài khoản (mọi vai trò, vì trang Cài đặt chỉ chủ quán) — segmented 3 nút `Chuẩn / Lớn / Rất lớn` có `aria-pressed`.

### 9.3 Khung cuộn và vùng an toàn (≤640px)

- `body{position:fixed;inset:0;overflow:hidden}` + `.main{height:100%;overflow-y:auto;overscroll-behavior:contain}` → chỉ `.main` cuộn, hết bounce và pull-to-refresh.
- `.topbar` sticky + `backdrop-filter`, cao `56px + env(safe-area-inset-top)`; `.content` chừa `padding-bottom: calc(96px + env(safe-area-inset-bottom))` cho bottom nav.
- Bottom nav `70px + safe-area`, icon 21px, nhãn `--fs-nav` và `white-space:nowrap` (tránh xuống 2 dòng).
- Modal là **bottom sheet**: `.modal-back{align-items:flex-end;padding:0}`, `.modal{width:100%;max-height:92dvh;border-radius:22px 22px 0 0}`, `.modal-foot` sticky, nút chia đôi 48px.
- Menu chọn nguyên liệu cao cố định `min(410px, 100dvh - 120px)` **đúng bằng** giá trị `toggleIngredientPicker()` dùng để canh `top`, nếu đổi chiều cao phải đổi cả hai.
- `navigate()` reset cả `window.scrollTo(0,0)` và `.main.scrollTop = 0`.

### 9.4 Khoá hành vi web

| Hành vi | Cách chặn |
|---|---|
| Pinch zoom | `viewport … maximum-scale=1, user-scalable=no` + `gesturestart/gesturechange` → `preventDefault()` |
| Double-tap zoom, delay 300 ms | `touch-action: manipulation` cho nút/ô nhập, `pan-y` cho `body` |
| Bôi đen chữ, menu copy | `user-select:none` toàn trang; mở lại cho `input, textarea, select, [contenteditable]` |
| Pull-to-refresh, nảy trang | `overscroll-behavior:none` + khung cuộn `.main` ở mục 9.3 |
| Tự zoom khi focus ô nhập (iOS) | mọi `input/select/textarea` để **16px** trên mobile |
| Xoay ngang | `manifest.orientation: "portrait"` (Android) + overlay `body::before` khi `(orientation:landscape) and (max-height:520px)` (iOS bỏ qua manifest) |

### 9.5 Quy ước khi thêm giao diện mới

1. Dùng lại `.btn`, `.btn.small`, `.tab`, `.field`, `.panel-title`, `.pill`, `.metric-line` — không tự đặt cỡ chữ px mới.
2. Mọi control bấm được phải cao ≥ `--tap` (44px), form chính ≥ `--tap-lg` (48px).
3. Chữ dữ liệu dùng `calc(var(--fs-body) ± n)`; nhãn nhỏ nhất là `--fs-xs` (11px).
4. Bảng trên mobile phải chuyển thành thẻ hoặc danh sách dòng, không cuộn ngang.
5. Icon: `icon.svg` (nguồn), `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180, nền đặc). Thêm file mới phải khai báo trong `SHELL` của `sw.js`.

## 10. Phiếu kho: chọn mặt hàng và chốt ca

Mọi phiếu kho dùng **cùng một bộ chọn**: nút hiển thị mặt hàng đã chọn + menu tìm kiếm có nhóm, giống ô “Chọn nguyên liệu” của form BTP. Không còn `<select>` thô hay ô tìm + datalist.

| Hàm | Nhiệm vụ |
|---|---|
| `itemPickerRows(kind)` | Sinh danh sách phẳng `{x, group, u, extra, search}` cho `kind = 'raw' \| 'prep' \| 'all'`; nhóm = danh mục nguyên liệu hoặc “Bán thành phẩm”. |
| `itemPickerHtml(opts)` | Trả HTML `.field` + `.ingredient-picker`: nút chọn, menu (search + options), và `<select id>` ẩn khi `mode='select'`. |
| `pickItemOption(option, id, mode)` | Đóng menu; `mode='select'` → gán select + `syncItemPickerTrigger()` + phát `change`; mode `flow-*` → `addFlowItem()`. |
| `syncItemPickerTrigger(picker)` | Đổi nút thành tên mặt hàng + đơn vị dùng (`ml; kho: chai`). |
| `addFlowItem(mode, id)` | Thêm `.flow-entry-card` (tồn, số lượng, nút xoá) vào đúng danh sách; chặn trùng mặt hàng. |

Ánh xạ phiếu → tham số:

| Phiếu | `kind` | `mode` | Đích |
|---|---|---|---|
| Nhập kho / Xuất thô | `raw` | `select` (`f-item`) | một mặt hàng + số lượng |
| Ghi nhận hao hụt | `all` | `select` (`f-item`) | một mặt hàng + số lượng |
| Nấu BTP (form riêng) | `prep` | `select` (`f-item`) | một BTP + sản lượng |
| Xuất đầu ca | `raw` + `prep` | `flow-raw` + `flow-sale` | `#flow-raw-lines`, `#flow-sale-lines` |
| Xuất BTP ra bán | `prep` | `flow-sale` | `#flow-sale-lines` |
| Nấu thành phẩm | `prep` | `flow-cook` | `#flow-prep-lines` |

Vì phiếu đơn vẫn giữ `<select id="f-item">` ẩn, `saveForm()` đọc `val('f-item')` như cũ. Phiếu nhiều dòng đọc input theo class `.flow-raw` / `.flow-sale` / `.flow-prep`.

### 10.1 Chốt ca chỉ theo món đã xuất ra quầy

- `daycloseRows(day)` lấy `sale_issue` trong ngày (theo `o.day` hoặc ngày của `o.date`) và trừ `sale_return` + `sale_waste` để biết **còn lại tại quầy**. Chỉ mặt hàng có `issued > 0` mới hiện.
- `renderDaycloseRows()` vẽ lại danh sách; được gọi khi mở modal và trong `onchange` của `#f-day`.
- Không có món nào → hiện gợi ý dùng **Xuất đầu ca** trước khi chốt.
- Hàng hỏng/hết hạn **không qua quầy** thuộc nghiệp vụ **Ghi nhận hao hụt**, không nhập ở chốt ca.
- `saveForm('dayclose')` vẫn tự tính lại `issued` và chặn nếu `thu hồi + hủy + đã chốt trước đó > đã xuất`.

> Lỗi đã gặp: `display:flex` cho `.ingredient-picker-menu` trên mobile ghi đè `[hidden]` làm mọi menu mở sẵn. Luôn kèm `.ingredient-picker-menu[hidden]{display:none!important}` khi thêm `display` cho phần tử có `hidden`.

## 11. Nhập và xuất dữ liệu (Cài đặt → Dữ liệu kho)

Panel chia 4 khối `<details class="settings-group">` để không chiếm chỗ:

| Khối | Hàm | Ghi chú |
|---|---|---|
| **Nhập dữ liệu** | `importDataFile(event)` → `importCsvData()`; `restoreData(event)` | Hỏi xác nhận trước khi nhập; import chạy trên bản clone nên lỗi giữa chừng không ghi gì; ghép theo mã. Nhóm **Giao dịch kho** luôn ghi thêm phiếu, không gộp. |
| **Xuất dữ liệu** | `exportData()`; `exportXlsx(type)` | JSON = toàn bộ workspace; Excel kèm dữ liệu, tên `xuat_<nhóm>_<ngày>.xlsx`. |
| **Tải dữ liệu mẫu** | `downloadXlsxTemplate(type, 'template')` | Mẫu **chỉ có tiêu đề** để tránh nhập trùng dữ liệu cũ. |
| **Vùng nguy hiểm** | `resetDemo()` | Thay toàn bộ bằng dữ liệu demo, có xác nhận. |

`downloadXlsxTemplate(type, mode)` dùng chung một bộ sinh OOXML (`templateSheetXml`, `zipStored`): `mode='template'` → không kèm dòng dữ liệu; `mode='export'` → kèm `templateRows(type)` và không hỏi xác nhận.

Chưa có: mẫu nhập **kiểm kê (audit)**, nhật ký thay đổi cấu hình, báo cáo tồn kho theo ngày (xem `CURRENT_STATUS.md` mục 4).

## 12. Quy ước sửa `index.html`

Vì toàn bộ app nằm trong một file, mỗi lần sửa phải:

1. Sao lưu: `cp index.html backups/index.html.$(date +%Y%m%d-%H%M)`.
2. Sửa xong chạy kiểm tra cú pháp (xem `TEST_PLAN.md`, mục 2).
3. Tăng `CACHE` trong `sw.js` để người dùng nhận bản mới.
4. Thêm **một dòng** vào `docs/_PENDING.md`.
5. Commit git — **không bao giờ** để file chỉ tồn tại trên đĩa.

### 12.1 Tài liệu chỉ chốt theo lô

Không sửa `ARCHITECTURE.md`, `BUSINESS_RULES.md`, `DATABASE_SCHEMA.md`, `TEST_PLAN.md`, `CURRENT_STATUS.md`, `README.md` sau mỗi thay đổi code — làm vậy tốn công mà giá trị thấp.

- **Trong lúc làm việc:** chỉ ghi một dòng vào `docs/_PENDING.md` (ngày · phạm vi · điều gì đã khác so với tài liệu).
- **Khi chủ dự án yêu cầu “chốt docs”:** đọc `_PENDING.md` + `git log <mốc chốt>..HEAD`, chỉ sửa **đúng mục bị ảnh hưởng** trong các file tài liệu, cập nhật dòng “Cập nhật: <ngày>” ở đầu file đã sửa, xoá các dòng đã chốt và cập nhật **Chốt gần nhất** trong `_PENDING.md`, rồi commit riêng `docs: chốt tài liệu <phạm vi>`.
- **Ngoại lệ:** nếu thay đổi làm sai lệch nghiêm trọng hướng dẫn vận hành (ví dụ đổi cách đăng nhập, đổi migration), ghi rõ mức độ trong `_PENDING.md` để lần chốt kế tiếp ưu tiên.
