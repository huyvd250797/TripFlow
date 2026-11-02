# Xác minh V2.12.3 — Complete Theme Consistency

Nền: `TripFlow-V2.12.2-Gradient-Themes-App-Icon-Branding.zip` Boss đính kèm. Không dùng source phiên bản cũ khác làm nền.

## Kiểm tra

- Node **24.22.1**. Dependency và lockfile giữ nguyên nội dung V2.12.2 ngoài số phiên bản app; môi trường kiểm thử dùng dependencies từ cùng lockfile đó.
- `npm test`: **95/95 đạt**; bao gồm kiểm tra dữ liệu, phân quyền, tài chính, lịch trình và palette/contrast/bootstrap.
- Production build sạch: `npm run build` hoàn tất Next.js/webpack, TypeScript, static pages và service worker. Offline shell **V2.12.3 có 44 assets**.
- UI dùng Chromium với server production, PostgreSQL/PGlite và giả lập Supabase Auth/HTTP. Chạy `TRIPFLOW_PALETTE_TEST=1 npm run test:ui`.
- Hồi quy V2.12.2: preset, mã HEX sai, save/cancel/custom, lưu qua reload, Mặc định trả lại đúng gradient gốc, sáng/tối, containment 320/390/768/1280.
- Bổ sung V2.12.3: màu tím và custom, sáng/tối, các tab Tổng quan/Lịch trình/Chi phí/Media ở 320/390/1280. Kiểm tra hai nút Ghi chi tiêu có cùng computed background; Memories và banner Chi phí thực sự dùng màu chọn; mở/đóng form chi tiêu và kiểm tra containment.
- Mở từng module được hiển thị cho tài khoản owner kiểm thử ở mobile trên cả sáng/tối, kiểm tra các nút không tràn viewport.
- Đối chiếu computed colors có/không palette: xác nhận xóa, cảnh báo, kết nối/offline, vượt ngân sách và command không hợp lệ giữ màu ngữ nghĩa. Không có JavaScript page errors.
- Đối chiếu byte: giữ nguyên **18 migration SQL** và các icon SVG/PNG; database giữ **2.12.0**. Không cần migration mới.
- Ảnh QA nội bộ đã xem: Chi phí và Memories sáng/tối, màu tím; không đưa ảnh QA vào ZIP.

## Giới hạn

Chưa chạy trên iPhone/Safari/PWA thật, Supabase production; chưa push GitHub/deploy trong lần bàn giao này. Test dữ liệu UI là dữ liệu kiểm thử, không sửa dữ liệu chuyến đi của Boss.

## Tự kiểm tra

```bash
npm ci
npm test
npm run build
```

Chạy kiểm tra UI với server production và môi trường kiểm thử theo `docs/TESTING.md`:

```bash
UI_BASE_URL=http://127.0.0.1:3000 TRIPFLOW_PALETTE_TEST=1 npm run test:ui
```

Có thể đặt `CHROMIUM_PATH` nếu executable Chromium không ở vị trí Playwright mặc định. Không dùng Supabase production để chạy harness dữ liệu kiểm thử.
