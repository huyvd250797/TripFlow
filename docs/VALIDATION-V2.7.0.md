# Kiểm tra V2.7.0

- Unit/integration 72/72 đạt; 12 migration giữ nguyên. App 2.7.0 / DB 2.4.1.
- Typecheck và production build đạt; manifest offline bao gồm module lazy.
- Chromium regression: 40 tổ hợp màn hình/kích thước/theme; quyền owner/viewer, lưu năm quyền, ví offline/sync và xóa chuyến/dọn cache.
- Mobile riêng: More chọn nhóm/mục trong sheet, phân quyền còn đủ, Back đóng sheet/editor trước, lịch sử tab, card timeline rộng hơn 300 px ở viewport 390 px, vuốt dọc không mở hành động, vuốt ngang mở sửa; không lỗi JS.
- Service Worker thật, phát hành patch mô phỏng: draft guard, Để sau, offline/thử lại, một lần bấm cập nhật giữ queue/theme/session và tab khác không tải lại document. Thay đổi lịch sử cùng trang khi mở popup không được tính là tải lại document.

Auth/HTTP giả lập, dữ liệu nghiệp vụ PostgreSQL PGlite; không phải nghiệm thu Supabase/Vercel production. Cử chỉ mobile dùng pointer event mô phỏng, chưa nghiệm thu thao tác cảm ứng Safari/PWA iPhone thật, bàn phím iOS hoặc VoiceOver. Ảnh chụp chỉ dùng kiểm tra nội bộ.

Chạy theo `TESTING.md`, bật `TRIPFLOW_MOBILE_TEST=1` cho bộ mobile mới. Source ZIP có Service Worker bootstrap; build production sinh lại manifest hash.
