#!/usr/bin/env node
// Kiểm tra sức khỏe index.html sau mỗi lần sửa.
// Dùng: node tools/verify.js
// Không cần cài package nào.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
const src = fs.readFileSync(FILE, 'utf8');

let failed = 0;
const results = [];
function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
  if (!ok) failed++;
}
function assertEq(label, got, want) {
  check(`${label} = ${got}`, got === want, got === want ? '' : `mong đợi ${want}`);
}

// 1. Cấu trúc tệp -----------------------------------------------------------
check(`kích thước hợp lý (${src.length} ký tự)`, src.length > 100000 && src.length < 400000);
check(`đúng 1 thẻ đóng </script></body></html>`, (src.match(/<\/script><\/body><\/html>/g) || []).length === 1);

// 2. Cú pháp từng khối script nội tuyến -----------------------------------
const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
check(`tìm thấy khối script nội tuyến (${blocks.length})`, blocks.length > 0);
blocks.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `inline-${i}.js` });
    check(`cú pháp khối script #${i + 1} (${code.length} ký tự)`, true);
  } catch (e) {
    check(`cú pháp khối script #${i + 1}`, false, e.message);
  }
});

const app = blocks[blocks.length - 1] || '';

// 3. Không có hàm khai báo trùng (dấu hiệu file bị ghép lỗi) ---------------
const names = [...app.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
check(`không có hàm trùng (${names.length} hàm)`, dupes.length === 0, dupes.join(', '));
check('tệp kết thúc đúng </html>', src.trimEnd().endsWith('</html>'));

// 4. Hàm sinh mã ------------------------------------------------------------
function extractFn(name) {
  const start = app.indexOf(`function ${name}(`);
  if (start < 0) return null;
  let depth = 0;
  for (let i = app.indexOf('{', start); i < app.length; i++) {
    if (app[i] === '{') depth++;
    else if (app[i] === '}') {
      depth--;
      if (depth === 0) return app.slice(start, i + 1);
    }
  }
  return null;
}

const parts = ['normalizePosKey', 'rawCodePrefix', 'nextItemCode', 'syncItemCode'].map(extractFn);
check('đủ 4 hàm sinh mã', parts.every(Boolean));

if (parts.every(Boolean)) {
  const db = {
    items: [
      ...Array.from({ length: 7 }, (_, i) => ({ type: 'raw', code: 'NL' + String(i + 1).padStart(3, '0') })),
      { type: 'raw', code: 'NLTR001' },
      { type: 'prep', code: 'BTP001' },
      { type: 'prep', code: 'BTP002' },
      { type: 'raw', code: 'TS001' },
    ],
  };
  const document = { getElementById: () => null };
  const api = new Function(
    'db',
    'document',
    parts.join('\n') + '\nreturn {rawCodePrefix,nextItemCode,syncItemCode};'
  )(db, document);

  const cases = [
    ['Trà', 'NLTR'], ['Trà đen', 'NLTR'], ['Trái cây', 'NLTC'], ['Trân châu', 'NLTP'],
    ['Topping', 'NLTP'], ['Bột', 'NLBT'], ['Bột trà xanh', 'NLBT'], ['Sữa đặc', 'NLCL'],
    ['Chất lỏng', 'NLCL'], ['Bao bì', 'NLBB'], ['Ly nhựa', 'NL'], ['Nguyên liệu', 'NL'], ['', 'NL'],
  ];
  cases.forEach(([cat, want]) => assertEq(`prefix("${cat}")`, api.rawCodePrefix(cat), want));

  assertEq('nextItemCode(NLTR,raw)', api.nextItemCode('NLTR', 'raw'), 'NLTR002');
  assertEq('nextItemCode(NL,raw)', api.nextItemCode('NL', 'raw'), 'NL008');
  assertEq('nextItemCode(BTP,prep)', api.nextItemCode('BTP', 'prep'), 'BTP003');
  assertEq('nextItemCode(NLBB,raw)', api.nextItemCode('NLBB', 'raw'), 'NLBB001');
  check('syncItemCode an toàn khi chưa có form', api.syncItemCode('raw') === undefined);
}

// 4b. Ô tìm kiếm nguyên liệu trong picker ------------------------------------
check(
  'picker ẩn option bằng [hidden] (không bị display:flex ghi đè)',
  /\.ingredient-picker-option\[hidden\][^{]*\{\s*display:\s*none\s*!important/.test(src)
);
const filterFn = extractFn('filterIngredientPicker') || '';
check('filterIngredientPicker dùng normalizePosKey (tìm được không dấu)', filterFn.includes('normalizePosKey('));
check('filterIngredientPicker ẩn tiêu đề nhóm rỗng', filterFn.includes('ingredient-picker-group'));
check(
  'picker có thông báo "không tìm thấy"',
  filterFn.includes('ingredient-picker-empty') && /\.ingredient-picker-empty\s*\{/.test(src)
);

// 4c. Chính sách giá & giá đề xuất (cấu hình trong Cài đặt) ------------------
check(
  'Cài đặt có mục "Cấu hình giá đề xuất"',
  src.includes('onclick="openPricingSettings()"') && src.includes('savePricingSettings') && src.includes('<b>Cấu hình giá đề xuất</b>')
);
check(
  'cấu hình giá chỉ còn một mục trong Cài đặt',
  !src.includes('pricing-policy-strip') && !src.includes('recipe-policy-strip') && !src.includes('Chính sách giá đang áp dụng')
);
check(
  'Cài đặt không lặp lại mục Định lượng & quy đổi POS',
  !src.includes('Định lượng &amp; quy đổi POS') && !src.includes('Định lượng & quy đổi POS')
);
check(
  'Dữ liệu kho chia nhóm nhập/xuất/mẫu + vùng nguy hiểm',
  (src.match(/<details class="settings-group"/g) || []).length === 3 &&
    src.includes('settings-group danger') &&
    src.includes('exportXlsx(') &&
    src.includes('Sao lưu toàn bộ (JSON)')
);
check(
  'mẫu Excel tải xuống là mẫu trống (xuất mới kèm dữ liệu)',
  /mode='template'/.test(src) && /withData\?templateRows\(type\):\[\]/.test(src)
);
check('đã bỏ chính sách giá hard-code cũ', !src.includes('PRICING_POLICY') && !src.includes('FC 30%'));
check('db.pricing được chuẩn hóa ngay khi nạp dữ liệu', src.includes('db.pricing=sanitizePricing(db.pricing)'));

const pricingConst = (app.match(/const PRICING_DEFAULTS=\{[\s\S]*?\};/) || [])[0];
const pricingFns = ['clampNumber', 'defaultPricing', 'sanitizePricing', 'priceNum', 'roundPrice', 'roundUpTo9k', 'priceModel', 'suggestedMenuPrices'].map(extractFn);
check('đủ 8 hàm tính giá', Boolean(pricingConst) && pricingFns.every(Boolean));

if (pricingConst && pricingFns.every(Boolean)) {
  const price = new Function(
    pricingConst + '\n' + pricingFns.join('\n') +
    '\nreturn {defaultPricing,sanitizePricing,roundPrice,roundUpTo9k,priceModel,suggestedMenuPrices};'
  )();
  const d = price.defaultPricing();
  const m = price.priceModel(8855, d);
  assertEq('giá đề xuất tại quán (mặc định)', m.store, 39000);
  assertEq('giá đề xuất trên app (mặc định)', m.app, 49000);
  assertEq('chi phí/ly sau hao hụt 3%', Math.round(m.totalCost), 9121);
  assertEq('VAT 8% bóc tách từ 39.000', Math.round(m.storeVat), 2889);
  assertEq('lãi sau thuế tại quán', Math.round(m.storeProfitAfterTax), 26990);
  check('Food Cost tại quán không vượt mục tiêu', m.storeFoodCostPct <= 30);

  const vat18 = price.priceModel(8855, price.sanitizePricing({ ...d, vatPct: 18 }));
  assertEq('VAT không làm đổi giá quán', vat18.store, m.store);
  assertEq('VAT không làm đổi giá app', vat18.app, m.app);
  check('VAT 18% làm tăng phần thuế bóc tách', vat18.storeVat > m.storeVat);

  const waste = price.priceModel(8855, price.sanitizePricing({ ...d, wastePct: 10 }));
  check('hao hụt làm tăng giá vốn/ly', waste.totalCost > m.totalCost);
  check('hao hụt làm tăng giá thô', waste.storeRaw > m.storeRaw);

  const opex = price.priceModel(8855, price.sanitizePricing({ ...d, opexMonthly: 12000000, cupsMonthly: 1000 }));
  assertEq('vận hành chia đều mỗi ly', Math.round(opex.opexPerCup), 12000);
  check('vận hành làm tăng giá đề xuất', opex.store > m.store);
  const noCups = price.priceModel(8855, price.sanitizePricing({ ...d, opexMonthly: 12000000, cupsMonthly: 0 }));
  assertEq('chưa nhập số ly thì không chia vận hành', noCups.opexPerCup, 0);

  const same = price.priceModel(8855, price.sanitizePricing({ ...d, appMode: 'same' }));
  assertEq('chế độ "bằng giá quán" -> giá app = giá quán', same.app, same.store);

  const tooHigh = price.priceModel(8855, price.sanitizePricing({ ...d, appCommission: 60, appOtherFee: 30, appPromoDiscount: 30 }));
  assertEq('tổng phí app >= 90% -> không có giá app', tooHigh.app, 0);
  check('cờ appValid = false khi phí app quá cao', tooHigh.appValid === false);

  assertEq('roundPrice(32.836)', price.roundPrice(32836, d), 39000);
  assertEq('roundPrice(8.500) không thấp hơn giá tối thiểu', price.roundPrice(8500, d), 9000);
  assertEq('roundPrice(9.500)', price.roundPrice(9500, d), 19000);
  assertEq('roundUpTo9k tương thích cũ', price.roundUpTo9k(9500), 19000);

  const garbage = price.sanitizePricing({ foodCostStore: 0, profitStore: 150, roundStep: 500, roundTail: 99999, wastePct: 'abc' });
  assertEq('sanitize: Food Cost 0 -> mặc định', garbage.foodCostStore, 30);
  assertEq('sanitize: chặn lợi nhuận 150%', garbage.profitStore, 90);
  assertEq('sanitize: chặn bước giá quá nhỏ', garbage.roundStep, 1000);
  assertEq('sanitize: đuôi giá phải nhỏ hơn bước', garbage.roundTail, 0);
  assertEq('sanitize: hao hụt không phải số -> mặc định', garbage.wastePct, 3);

  const zero = price.suggestedMenuPrices(0);
  assertEq('giá vốn 0 -> không có giá đề xuất', zero.store + zero.foodApp, 0);
  check('giá vốn 0 không sinh NaN', !Object.values(price.priceModel(0, d)).some(v => typeof v === 'number' && Number.isNaN(v)));

  d.wastePct = 99;
  assertEq('defaultPricing trả bản sao độc lập', price.defaultPricing().wastePct, 3);
}

// 5. Service worker đã tăng cache ------------------------------------------
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check('sw.js có khai báo CACHE', /const CACHE = 'moc-inventory-shell-v\d+';/.test(sw));

// 6. Giao diện native trên điện thoại --------------------------------------
const viewportMeta = (src.match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || '';
check(
  'viewport khoá zoom + chừa vùng tai thỏ',
  /maximum-scale=1/.test(viewportMeta) && /user-scalable=no/.test(viewportMeta) && /viewport-fit=cover/.test(viewportMeta)
);
assertEq('số thẻ viewport', (src.match(/name="viewport"/g) || []).length, 1);
check('meta iOS cho phép chạy toàn màn hình', src.includes('name="apple-mobile-web-app-capable" content="yes"'));
check('meta thanh trạng thái trong suốt', src.includes('name="apple-mobile-web-app-status-bar-style" content="black-translucent"'));
check(
  'apple-touch-icon PNG 180x180 tồn tại',
  src.includes('rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png"') && fs.existsSync(path.join(ROOT, 'apple-touch-icon.png'))
);
check('chặn nảy trang / pull-to-refresh', /overscroll-behavior:none/.test(src));
check('tắt bôi đen chữ toàn trang', /body\{[^}]*user-select:none/.test(src));
check('vùng chạm tối thiểu 44px', /--tap:44px/.test(src) && /\.btn\{min-height:var\(--tap-lg\)/.test(src));
check('input 16px để iOS không tự zoom khi focus', /input:not\(\[type="checkbox"\]\)[^{]*\{font-size:16px\}/.test(src));
check(
  '3 mức cỡ chữ lưu trên thiết bị',
  /html\[data-fs="lg"\]\{--fs-body:17\.5px/.test(src) && /html\[data-fs="xl"\]\{--fs-body:19px/.test(src) && src.includes('moc-display-v1')
);
check(
  'mobile cuộn trong .main thay vì cả trang',
  /body\{position:fixed;inset:0/.test(src) && /\.main\{height:100%;overflow-y:auto/.test(src)
);
check('nhắc xoay dọc khi điện thoại nằm ngang', /orientation:landscape\) and \(max-height:520px/.test(src));
check(
  'dashboard dùng .metric-line gọn và ẩn chú thích trên mobile',
  src.includes('class="metric-line"') && src.includes('class="metric-label"') && /\.cards \.metric \.metric-foot\{display:none\}/.test(src)
);
check(
  'bộ lọc tồn kho xếp dọc, ô 46px, chữ 16px',
  /#page-inventory \.inventory-filter-grid\{grid-template-columns:1fr/.test(src) &&
    /#page-inventory \.inventory-filter-grid \.search\{[^}]*min-height:46px[^}]*font-size:16px/.test(src)
);
check(
  'nút nghiệp vụ trong tồn kho cao 48px',
  /#inventory-workflow-actions \.inventory-workflow-btn\{[^}]*min-height:48px/.test(src)
);
check(
  'chữ dữ liệu co giãn theo 3 mức cỡ chữ',
  /\.metric-label\{[^}]*calc\(var\(--fs-body\) - 3px\)/.test(src) && /:root \.act-text\{[^}]*font-size:calc\(var\(--fs-body\) - 2px\)/.test(src)
);
check(
  'Công thức & món: nút “Thêm món” nằm cạnh ô tìm, không còn ở page-head',
  src.includes('<div class="panel-head-tools"><input class="search" id="recipe-search"') &&
    src.includes('＋ Thêm món</button>') &&
    !src.includes('Thêm món &amp; BOM') && !src.includes('Thêm món & BOM')
);
check(
  'Công thức & món: đã bỏ dòng hướng dẫn dài',
  !src.includes('Mỗi món được gom theo tên')
);
check(
  'các phiếu kho dùng chung bộ chọn mặt hàng (không còn select thô)',
  (src.match(/itemPickerHtml\(\{selectId:'f-item'/g) || []).length === 5 &&
    !src.includes('<select id="f-item">')
);
check(
  'xuất đầu ca / nấu thành phẩm / xuất bán dùng bộ chọn flow',
  (src.match(/mode:'flow-/g) || []).length === 4 && !src.includes('addFlowLine') && !src.includes('flow-raw-search')
);
check(
  'chốt ca chỉ liệt kê món đã xuất ra quầy trong ngày',
  src.includes('function daycloseRows(') &&
    src.includes('id="dayclose-list"') &&
    /issued\[o\.itemId\]/.test(src) &&
    src.includes("if(o.kind==='sale_issue')issued[o.itemId]")
);
check('hai panel Công thức dùng chung .panel-head-tools', (src.match(/class="panel-head-tools"/g) || []).length === 2);
check('sw.js cache icon PNG', /icon-192\.png/.test(sw) && /apple-touch-icon\.png/.test(sw));

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
assertEq('manifest.orientation', manifest.orientation, 'portrait');
assertEq('manifest.display', manifest.display, 'standalone');
check(
  'manifest có icon 192 và 512',
  manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512')
);
check('manifest có id ổn định', typeof manifest.id === 'string' && manifest.id.length > 0);

// 7. Toàn vẹn dữ liệu P0 -----------------------------------------------------
check('loại phiếu điều chỉnh kiểm kê (adjust)', /kind:'adjust'/.test(src) && /adjust\[o\.itemId\]/.test(src));
check(
  'kiểm kê tạo phiếu điều chỉnh thay vì ghi đè tồn',
  /stocktakeId/.test(src) && /if\(!Object\.keys\(counts\)\.length\)/.test(src) && /Ô để trống = <b>chưa đếm<\/b>/.test(src)
);
check(
  'phiếu bị vô hiệu hoá vẫn nằm trong lịch sử',
  /status:'voided'/.test(src) && !/db\.ops=db\.ops\.filter\(o=>o\.id!==id\)/.test(src)
);
check('không xoá dữ liệu kiểm kê khi xoá mặt hàng', !/delete a\.counts/.test(src));
check(
  'lưu localStorage có bắt lỗi hết dung lượng',
  /localStorage\.setItem\(KEY,snapshot\)/.test(src) && /Bộ nhớ trình duyệt đã đầy/.test(src)
);
check('chống nhập trùng báo cáo POS', /function strHash/.test(src) && /dup=db\.imports\.find/.test(src));
check('chặn bấm lưu hai lần', /button\.disabled=true/.test(src));
check('bỏ phiếu đã huỷ khỏi so sánh POS', /if\(opVoided\(o\)\)return false;let d=o\.day/.test(src));
check(
  'migration P0: adjust + replace_workspace_state + kiểm tra tồn cho owner',
  (() => {
    const p = path.join(ROOT, 'supabase/migrations/20261028_integrity_audit_adjust.sql');
    if (!fs.existsSync(p)) return false;
    const m = fs.readFileSync(p, 'utf8');
    return /when o->>'kind' = 'adjust'/.test(m) && /replace_workspace_state/.test(m) && /Balances may only change/.test(m);
  })()
);

// 8. Chênh lệch theo kỳ & POS nâng cao ---------------------------------------
check(
  'variance engine tính tồn đầu kỳ từ mốc kiểm kê',
  /function theoreticalOpening\(/.test(src) && /function varianceReport\(/.test(src) && /function opDayOf\(/.test(src)
);
check(
  'báo cáo chênh lệch dùng varianceReport (không còn db.audits.at(-1))',
  /function buildVariance\(\)\{[\s\S]{0,1200}varianceReport\(/.test(src) && !/function buildVariance[\s\S]{0,1200}db\.audits\.at\(-1\)/.test(src)
);
check('báo cáo chênh lệch có chọn kỳ và dòng tổng kết', /id="var-from"/.test(src) && /id="var-to"/.test(src) && /id="variance-summary"/.test(src));
check('xuất Excel chênh lệch dùng cùng engine', /function exportVariance\(\)\{[^}]*varianceReport\(from,to\)/.test(src));
check(
  'POS map được size + topping/tuỳ chọn',
  /function posModifierList\(/.test(src) && /function modifierConsumption\(/.test(src) && /function findPosModifier\(/.test(src) &&
    /size:si/.test(src) && /mods=mi>=0/.test(src)
);
check('POS bỏ qua đơn huỷ/hoàn, không bỏ nhầm “Hoàn thành”', /hoàn\\s\*tiền/.test(src) && /cancelled\+\+/.test(src));
check('lưu lượt topping vào bản ghi nhập POS', /modifiers:modifierTotals/.test(src) && /cancelled:rows\.cancelled/.test(src));
check('Cài đặt có mục Topping & tuỳ chọn POS', /openPosModifiers\(\)/.test(src) && /Topping &amp; tuỳ chọn POS/.test(src));

// 9. Mẻ nấu (batch) ----------------------------------------------------------
check(
  'mẻ nấu có mã, sản lượng thực tế, người làm, hạn dùng',
  /function addBatch\(/.test(src) && /function nextBatchCode\(/.test(src) && /expiresAt:/.test(src) && /operator:actorLabel\(\)/.test(src)
);
check(
  'phiếu nấu và xuất nguyên liệu được gắn batchId',
  /batchId:batch\.id/.test(src) && /batchCode:batch\.code/.test(src) && /batch\.ops=batchOpIds\(created\)/.test(src)
);
check('trang Công thức có bảng mẻ nấu gần đây', /id="batches-table"/.test(src) && /renderBatches\(\)/.test(src) && /id="batch-frequency"/.test(src));

// 10. Vị trí bảo quản --------------------------------------------------------
check(
  'vị trí: xuất kho trừ tồn và ghi nhận số đang ở quầy/tủ',
  /function addLocationOp\(/.test(src) && /kind==='issue_location'\)\{if\(q>x\.qty/.test(src) && /at\[locId\]=\(at\[locId\]\|\|0\)\+q/.test(src)
);
check(
  'vị trí: dùng tại chỗ không đổi tồn kho, trả kho cộng lại',
  /kind==='use_location'\)\{if\(q>/.test(src) && /kind==='return_location'\)\{[^}]*x\.qty\+=q/.test(src) && /issue_location'\).*-qty/s.test(src)
);
check(
  'tồn tại vị trí được dựng lại từ phiếu (at là dữ liệu dẫn xuất)',
  /function rebuildLocationBalances\(/.test(src) && /rebuildLocationBalances\(\);safeApplyBranding\(\)/.test(src)
);
check(
  'có bảng Hàng ngoài kho và mục Cài đặt Vị trí bảo quản',
  /id="loc-table"/.test(src) && /openLocations\(\)/.test(src) && /Vị trí bảo quản/.test(src)
);
check('phiếu vị trí được tính vào chênh lệch theo kỳ', /o\.kind==='issue_location'\)outNet\+=q/.test(src) && /o\.kind==='return_location'\)outNet-=q/.test(src));

// In kết quả ---------------------------------------------------------------
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? '  → ' + r.detail : ''}`);
}
console.log(`\n${failed === 0 ? 'TẤT CẢ PASS' : failed + ' KIỂM TRA THẤT BẠI'} (${results.length} mục)`);
process.exit(failed === 0 ? 0 : 1);
