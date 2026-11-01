# Kiểm tra V2.8.0

- Unit/integration: 74 kiểm thử, bao gồm nghiệp vụ cũ và migration đặt chỗ mới. Kiểm tra Owner/Editor ghi, Viewer chỉ đọc, người ngoài/thu hồi/deactivated bị chặn; RLS, cấm DML trực tiếp, stale version, idempotency, HTTPS, thời gian qua đêm, timezone, liên kết và chạy lại migration.
- Typecheck + production webpack build; manifest 42 tài nguyên bao gồm module lazy.
- Chromium: 40 tổ hợp màn hình/kích thước/theme; nghiệp vụ quyền, ví offline/sync, xóa chuyến/dọn cache vẫn chạy.
- Bộ V2.8 riêng: lưới 14 module Owner trên mobile, mở màn hình quản lý, tạo đặt chỗ qua đêm, tạo/sửa/xóa tài liệu, đọc cache offline và chặn ghi offline; chấm xanh/vàng/đỏ, không lỗi JS.
- Service Worker thật với bản patch mô phỏng: cài đầu an toàn, bản nháp chặn update, Để sau, lỗi offline/thử lại, giữ queue/theme/session, tab khác không reload.

SQL chạy PostgreSQL PGlite; Auth/HTTP browser mock, không dùng dữ liệu production. Chưa nghiệm thu Supabase/Realtime/Vercel hoặc Safari/PWA iPhone thật. Ảnh kiểm thử không nằm trong ZIP. Đọc giới hạn backup/restore cũ trong UPGRADE-V2.8.0.md.

Chạy `npm test`, `npm run typecheck`, `npm run build`; với server test đang mở, đặt `TRIPFLOW_BOOKINGS_TEST=1` rồi `npm run test:ui` để chạy bộ module mới, bỏ biến đó để chạy regression thường. Chạy `npm run test:update:ui` sau production build.
