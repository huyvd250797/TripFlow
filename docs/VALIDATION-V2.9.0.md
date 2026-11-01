# Kiểm tra V2.9.0 — Trip Fund & Settlement

## Kết quả

- `npm test`: **83/83** kiểm thử đạt, gồm 74 kiểm thử trước và 9 kiểm thử quỹ/tổng hợp mới.
- Production webpack build + TypeScript đạt; Service Worker manifest 42 tài nguyên, gồm module lazy. Initial JS: 8 file, 1.255.632 byte raw / 364.344 byte gzip trong build kiểm thử; đây là kích thước bundle, không phải chỉ số tốc độ mạng thực tế.
- SQL PGlite chạy đủ 14 migration: setup/version mục tiêu; chống gửi trùng; chi quỹ/cá nhân; refund kế thừa nguồn; hoàn ứng không cộng thêm expense; giới hạn âm quỹ/hoàn ứng/trả quỹ; không cho sửa/xóa khoản đã hoàn ứng gây mất cân đối; hủy giao dịch giữ lịch sử; RLS/editor/viewer/người ngoài/deactivated; không gọi vòng qua RPC cũ; khôi phục expense kiểm tra số dư; backup/restore-as-copy remap ID và giữ sổ quỹ; chạy lại migration V2.9 giữ dữ liệu/readiness.
- Browser quỹ: ba tab finance, thiết lập người giữ, mục tiêu và hạn đóng theo người, thu một triệu, hoàn ứng 120.000, trả 50.000, ghi chi từ quỹ 150.000; số dư còn 680.000. Kiểm tra 320/390/430/1280 px, theme sáng/tối, cache đọc offline và chặn ghi quỹ offline; không lỗi JavaScript.
- Browser đặt chỗ: lưới 14 module, mở quản lý, tạo đặt chỗ qua đêm với người đứng tên/số lượng/địa điểm; mở chi tiết và xác minh cột nhãn đủ rộng, không tràn card ở 320/390/430/1280 px; tạo/sửa/xóa tài liệu, đọc cache offline, chặn ghi offline, chỉ báo kết nối xanh/vàng/đỏ. Đã xem ảnh render mobile và desktop, ảnh chỉ dùng kiểm thử nội bộ.
- Regression browser: 40 tổ hợp màn hình/kích thước/theme, năm quyền đặc biệt, lưu quyền Owner, action của Viewer, ví offline/sync, theme, xóa chuyến và dọn cache đạt.
- Service Worker thật: cài đầu an toàn, waiting-worker popup, bản nháp chặn cập nhật, bấm cập nhật kích hoạt và reload bình thường, giữ queue/theme/view; không ép reload tab khác.

## Chạy lại

Dùng Node 24.x và Chromium/Playwright tương thích. `npm ci`, `npm test`; cấu hình biến Supabase test, `TRIPFLOW_UI_TEST=1 npm run build`. Cờ này chỉ đổi output sang `.next-ui`, không tắt kiểm tra TypeScript/production optimizer. Chạy server `TRIPFLOW_UI_TEST=1 npm start` trong cùng môi trường mạng với browser harness, rồi đặt `UI_BASE_URL` và `CHROMIUM_PATH` nếu cần:

- `TRIPFLOW_FUND_TEST=1 npm run test:ui` cho quỹ.
- `TRIPFLOW_BOOKINGS_TEST=1 npm run test:ui` cho đặt chỗ/module và responsive detail.
- Bỏ hai cờ trên: `npm run test:ui` chạy regression chung.
- `TRIPFLOW_UI_TEST=1 npm run test:update:ui` sau build cho vòng đời service worker.
- `node scripts/measure-client-bundle.cjs .next-ui` đo bundle build kiểm thử.

Build triển khai thông thường: không đặt `TRIPFLOW_UI_TEST`, dùng biến Supabase thật và `npm run build`. Không đưa build test vào production.

## Phạm vi còn cần nghiệm thu

Auth và HTTP của browser được mock; SQL chạy PostgreSQL/PGlite, không có giao dịch tiền thật hay dữ liệu production. Chưa chạy migration trên Supabase của Boss, chưa deploy Vercel, chưa nghiệm thu Safari/PWA iPhone và đồng bộ hai thiết bị thật. Cần kiểm thử trên staging sau khi áp dụng migration, đặc biệt trường hợp hai người đồng thời thu/chi, quyền bị thu hồi và queue offline. Quỹ ghi nhận thủ công, chưa chuyển khoản tự động hay tự chia công nợ. Giới hạn backup đặt chỗ giữ như V2.8; xem `UPGRADE-V2.9.0.md`.
