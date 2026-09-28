# Nâng cấp TripFlow V0.1.0 → V0.2.0

> Tài liệu lịch sử cho bước nâng cấp V0.2.0. TripFlow hiện đã có V0.5.0; sau khi hoàn tất V0.2.0 hãy chạy tiếp migration V0.3.0 rồi V0.4.0 theo đúng thứ tự.

## 1. Database

Với database V0.1.0 đang chạy, **chỉ chạy**:

`supabase/migrations/202609270001_v020_offline_master_admin.sql`

Không chạy lại migration V0.1.0. Nên backup/staging trước khi áp dụng production.

## 2. Tạo Master

Đăng ký và xác nhận email của tài khoản quản trị, sau đó gán role bằng SQL tin cậy theo mục **1.1** trong README. Frontend không có quyền tự nâng user thành Master.

## 3. Kiểm tra sau nâng cấp

- User thường vẫn xem/sửa đúng chuyến được cấp quyền.
- Master thấy **Quản trị Master**, tìm user, xem dữ liệu/chuyến đi, deactivate/reactivate.
- User bị deactivate đăng nhập sẽ bị account gate đăng xuất và API/RLS chặn.
- Mở một chuyến khi online, tắt mạng, thêm thực chi/check-in, kiểm tra queue trong **Thêm**, bật mạng và đồng bộ.
- Thử gửi lại cùng thao tác: server không tạo bản ghi trùng nhờ `operationId` + mutation receipt.
- Tạo stale version từ hai thiết bị: thao tác sau chuyển conflict thay vì ghi đè.
- Roadmap hiển thị V0.1.0 và V0.2.0 ✅; V0.3.0 là phiên bản tiếp theo.

## 4. Phạm vi offline có chủ đích

Được queue: thêm thực chi, cập nhật/check-in lịch trình, thêm/sửa người tham gia, thêm/sửa media.

Cần online: phân quyền/lời mời, xóa chuyến, chốt snapshot, quản trị Master và các thao tác không nằm trong whitelist offline.
