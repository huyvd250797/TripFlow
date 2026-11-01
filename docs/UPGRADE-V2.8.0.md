# TripFlow V2.8.0 — Bookings & Travel Documents

## Thứ tự nâng cấp

1. Database phải đã ở V2.4.1. Nếu chưa chạy `202610310001_v241_travel_reliability_permissions.sql`, chạy file đó trước; không reset DB hoặc chạy lại migration đầu.
2. Trong Supabase SQL Editor, chạy toàn bộ `202611010001_v280_bookings_documents.sql` (bản `.txt` cùng nội dung được gửi riêng). Migration tạo bảng/RLS/RPC/audit và nâng capability lên 2.8.0, không sửa dữ liệu cũ.
3. Deploy source V2.8.0 với cấu hình hiện tại. Node 24.x, `npm ci`, build command `npm run build` để sinh Service Worker manifest. Không bỏ postbuild.
4. Người đang dùng app chọn Cập nhật khi popup xuất hiện. Kiểm tra Trạng thái Production: App/DB 2.8.0. Mở Thêm → Đặt chỗ & tài liệu, thử một đặt chỗ và một tài liệu.

## Cách dùng

- Mobile: Thêm mở lưới hai cột. Chọn ô để mở màn hình quản lý; nút Tất cả module quay lại lưới. Desktop giữ nhóm hiện hữu và bổ sung khu vực Đặt chỗ & tài liệu.
- Tạo đặt chỗ thủ công; chọn loại, trạng thái, mã xác nhận và thời gian. Trường nâng cao có nhà cung cấp, người đứng tên, số lượng, liên hệ, địa điểm, hạn thanh toán/hủy, hoạt động và dự toán liên quan.
- Tài liệu là một record loại Tài liệu, lưu URL HTTPS và ghi chú, có thể gắn vào đặt chỗ. Không upload file vào Storage, không đồng bộ email/đặt vé tự động, không thu thông tin CCCD/hộ chiếu bằng trường riêng.
- Thời gian nhập theo múi giờ trên form, lưu UTC và hiển thị lại theo múi giờ record. Có thể nhận/trả phòng qua đêm hoặc để trống thời gian nếu chỉ là tài liệu.
- Sắp sử dụng hiển thị đặt chỗ chưa dùng/chưa hủy; Tất cả xem toàn bộ; Tài liệu lọc riêng. Tìm theo tên/mã/nhà cung cấp. Mở Chi tiết để xem hạn, liên hệ và hoạt động liên quan.
- Khoản đã trả ròng được tính từ toàn bộ thực chi trừ hoàn tiền của **dự toán liên kết**. Nếu nhiều đặt chỗ chung dự toán, cùng tổng được hiển thị tham chiếu; không cộng thành tổng chi mới và không tự tạo khoản chi.

## Quyền, offline và dữ liệu

- Owner/Editor được thêm/sửa/xóa; Viewer chỉ đọc. Các quyền đặc biệt V2.4.1 không tự cấp quyền sửa đặt chỗ. RPC/RLS kiểm tra user active và membership/trip còn hiệu lực, liên kết cùng chuyến, stale version, retry operation ID và URL HTTPS.
- Xóa mềm, ghi audit. Đặt chỗ bị xóa không xóa tài liệu con; liên kết con có thể còn tham chiếu record đã xóa.
- Nội dung đã tải lưu trong IndexedDB cùng cache theo user/chuyến; xóa chuyến/thu hồi quyền qua luồng hiện hữu sẽ dọn cache. Offline chỉ đọc dữ liệu đã tải; thêm/sửa/xóa cần mạng, không thêm entity mới vào queue hiện có. File ở Drive/website ngoài vẫn cần mạng và quyền tại nguồn.
- Module tải lại khi focus/online và định kỳ 60 giây. Chưa đăng ký Realtime riêng cho bảng mới. Không cam kết thu hồi được dữ liệu đã xem trên thiết bị hoàn toàn offline.
- Backup/restore/template cũ **chưa bao gồm bảng đặt chỗ**. Dùng Xuất JSON trong module để lưu bản riêng; bản này chưa có import/restore JSON tự động. Không mô tả backup cũ là bản sao đầy đủ của đặt chỗ/tài liệu.
- Chấm xanh: kiểm tra `/api/version` thành công và truy vấn chuyến không báo lỗi; vàng: đang xác minh/thử kết nối hoặc truy vấn chuyến lỗi; đỏ: trình duyệt báo mất mạng. Kiểm tra lại mỗi 30 giây khi app hiển thị và khi focus/online. Đây là trạng thái kết nối app với máy chủ, không phải cam kết mọi dịch vụ bên ngoài/Realtime đều hoạt động.

## Kiểm thử và triển khai

`npm test`, `npm run typecheck`, `npm run build`. Browser test dùng `TRIPFLOW_BOOKINGS_TEST=1` với `npm run test:ui` trên server test theo TESTING.md. Auth/HTTP giả lập, SQL nghiệp vụ PGlite, không tác động production. `npm run test:update:ui` xác minh lifecycle worker thật.

Chưa push/deploy production, chưa nghiệm thu Safari/PWA iPhone thật. Source ZIP chứa worker bootstrap; build sinh lại hash. Giữ DB khi rollback UI về V2.7; không xóa bảng mới để rollback. Trước khi áp dụng thay đổi trên production, dùng backup vận hành của Supabase theo runbook hiện hữu.

Đề xuất kế tiếp để Boss chọn: **V2.9.0 — Travel Readiness & Reminders**. Gửi ZIP V2.8.0 mới nhất khi nâng cấp tiếp.
