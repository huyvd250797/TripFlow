# Kiểm tra V2.6.0

## Phạm vi

- Dependencies giữ nguyên, Node 24.x, App 2.6.0 / DB 2.4.1; không migration mới.
- Unit/integration: 72 kiểm thử, thêm assertion đối chiếu `DATABASE_VERSION` với `tf_release_readiness()` thực tế sau toàn bộ 12 migration.
- Typecheck và production webpack build đạt; postbuild sinh manifest 43 tài nguyên bao gồm module lazy.
- Regression Chromium: 40 tổ hợp màn hình/kích thước/theme; lưu năm quyền, Viewer thấy hành động đúng quyền, ví offline rồi sync, theme persistence và xóa chuyến/dọn cache.
- Kịch bản polish riêng: normal/reduced motion; sheet trên mobile/PWA mô phỏng; căn giữa popup desktop; đang lưu chặn đóng/Escape; giả lập lỗi ghi và thử lại giữ nội dung; focus quay về nút mở; toast thành công/thông tin, pause khi hover và đóng; kiểm tra tương phản nút chính; không lỗi JavaScript.
- Service Worker thật, phát hành mô phỏng V2.6.0 → V2.6.1: cài đầu không tự reload; popup bản mới, draft guard, Để sau, lỗi offline/thử lại; một lần bấm update giữ queue/theme/session view, tab khác không tự tải lại.

## Cách chạy lại

Xem `TESTING.md` và `UPGRADE-V2.6.0.md`. Bộ polish bật bằng `TRIPFLOW_POLISH_TEST=1`, bộ regression thường bỏ biến đó. Bộ lifecycle update tự lấy version từ source để mô phỏng bản patch kế tiếp.

## Giới hạn

Auth/HTTP được mô phỏng, dữ liệu nghiệp vụ chạy PostgreSQL PGlite; không coi đây là nghiệm thu Supabase Auth/Realtime/Vercel production. Chế độ PWA trong polish test mô phỏng CSS viewport trên Chromium, chưa phải iOS standalone thật. Chưa nghiệm thu Safari/VoiceOver hoặc đo FPS trên điện thoại cấu hình thấp. Ảnh chụp chỉ dùng nội bộ, không đưa vào ZIP.

Motion không kéo dài request và không thêm chờ trước lưu/chuyển tab. Đây là mô tả triển khai, không phải cam kết độ trễ mạng hoặc FPS production.
