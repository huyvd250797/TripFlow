# Nâng cấp TripFlow V0.7.0 → V0.8.0

V0.8.0 bổ sung **Trip Analytics & Post-Trip Report**. Phiên bản này không thay đổi schema database.

## 1. Database

Nếu production đã chạy:

`supabase/migrations/202609280003_v070_backup_recovery_operations.sql`

thì **không chạy thêm SQL cho V0.8.0**.

Analytics được tính từ bundle hiện tại (`trips`, `itinerary_items`, `expenses`, `budget_*`, `media_links`) và Finance report V0.3.0. Không lưu thêm cột “tổng” hoặc bảng aggregate độc lập.

## 2. Deploy

1. Backup source và database theo quy trình vận hành hiện có.
2. Deploy source V0.8.0 với Node.js 24.x.
3. Service worker dùng cache shell `tripflow-shell-v080`; nếu app PWA đang mở bằng worker cũ, vào **Thêm → Ứng dụng trên thiết bị** và cập nhật khi được nhắc.
4. Hard refresh một lần khi kiểm thử web thông thường để chắc chắn asset mới được tải.

## 3. Kiểm thử bắt buộc

- Một chuyến đang `traveling`: báo cáo phải ghi **Báo cáo tạm thời**.
- Một chuyến `completed` nhưng còn activity `planned/active`: phải có cảnh báo cần rà soát.
- Một chuyến hoàn chỉnh: completion, budget usage, per-person và daily summary phải khớp dữ liệu nguồn.
- Export CSV mở được trong Excel/Sheets; ô bắt đầu bằng `=`, `+`, `-`, `@` phải được trung hòa.
- Export JSON chứa `format=tripflow-post-trip-report` và `version=0.8.0`.
- Bản in HTML hiển thị tốt trên desktop/mobile và không chèn HTML từ tên chuyến/hoạt động.

## 4. Rollback

Vì không có migration V0.8.0, rollback chỉ cần deploy lại source V0.7.0. Database không cần rollback.
