# Kiểm tra bản V2.4.1

Ngày kiểm tra: 31/10/2026. Node 24.x, dependency giữ nguyên từ source V2.4.0.

- `npm test`: **69/69 đạt**. Bao gồm regression ví/báo cáo/CSV offline, qua nửa đêm, ngày kết thúc mở, tuyến đủ thứ tự; kiểm thử PostgreSQL PGlite chạy toàn bộ 12 migrations, RLS/RPC, năm quyền độc lập, lời mời, thu hồi, soft-delete/restore và idempotency. Migration V2.4.1 được kiểm tra chạy lại an toàn.
- `npm run typecheck`: đạt.
- `npm run build`: đạt trên webpack, gồm kiểm tra TypeScript và sinh trang.
- UI trên Chromium với production build: năm checkbox, lưu grant, ẩn nút khi không có quyền, Viewer được cấp xóa nhìn thấy nút; tạo chi offline và kiểm tra Wallet/báo cáo rồi đồng bộ; xóa chuyến và dọn cache/chuyển màn hình; theme lưu sau reload và đổi theo thiết bị; **40 tổ hợp** gồm 5 tab × 4 kích thước (320/390/768/1440) × 2 theme, không tràn ngang, không lỗi JavaScript.
- Đã xem ảnh kiểm thử nội bộ của giao diện tối trên điện thoại và giao diện sáng/tối Chi phí trên desktop.

UI test giả lập Supabase Auth và HTTP bằng Playwright, thao tác dữ liệu qua PGlite. Nó không thay thế kiểm thử Supabase thật, Realtime thật và Safari/PWA iPhone thật. Chưa push GitHub hoặc deploy production trong lần bàn giao này.

Các ca test cũ được sửa fixture thiếu dữ liệu, expectation version cũ và cách đọc access events đúng tài khoản được RLS cho phép; không nới RLS để làm test đạt. Luồng media metadata được hoàn thiện để trường hợp tạo không truyền ID trả đủ dữ liệu và retry không thay đổi cover.
