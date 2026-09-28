# Nâng cấp TripFlow V1.1.1 → V1.2.0

V1.2.0 là **Smart Trip Workspace & Quick Actions**. Bản này tập trung giảm số bước thao tác và tăng khả năng tìm kiếm trong một chuyến đi. Không thay đổi schema database.

## Database

Không có migration V1.2.0. Database chỉ cần đã đạt Stable V1.0.0 bằng migration:

`202609280005_v100_stable_production_release.sql`

App version là `1.2.0`; database compatibility version tiếp tục là `1.0.0`.

## Thay đổi chính

- Smart Workspace trên Tổng quan.
- Quick expense tự gắn budget liên quan đến activity hiện tại/tiếp theo khi có thể.
- Quick media tự gắn activity theo ngữ cảnh.
- Shortcut check-in/complete dựa trên Current/Next.
- Search xuyên itinerary, expense, budget, media, participant.
- So khớp tiếng Việt không dấu.
- Nút search topbar và phím `/` trên desktop.
- PWA shell cache `tripflow-shell-v120`.

## Deploy

1. Không chạy SQL mới.
2. Deploy source V1.2.0 bằng Node 24.x.
3. Hard refresh hoặc đóng/mở PWA để nhận service worker mới.
4. Kiểm tra Tổng quan ở 320px, 390px, tablet và desktop.
5. Kiểm tra search bằng cả từ khóa có dấu và không dấu.
6. Kiểm tra Viewer không nhìn thấy quick action ghi dữ liệu.
7. Vào **Thêm → Trạng thái Production**: App 1.2.0, DB 1.0.0, channel stable và các guard phải đạt.

## Rollback

Có thể rollback frontend về V1.1.1 mà không rollback database vì V1.2.0 không có migration.
