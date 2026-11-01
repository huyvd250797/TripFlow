# Nâng V2.10.1 → V2.11.0

1. Sao lưu database. Điều kiện: đã áp dụng toàn bộ migration của V2.10.1.
2. Mở Supabase SQL Editor, copy toàn bộ TXT migration đi kèm và chạy. TXT chỉ chứa `202611010005_v2110_packing_checklist_family.sql`. Không reset, không chạy lại SQL cũ. Dữ liệu chi phí, quỹ, đặt chỗ và phân quyền hiện có được giữ nguyên.
3. Giữ env Supabase trong dự án deploy. Node 24.x, Root Directory chứa package.json, Install `npm ci`, Build `npm run build`. Triển khai source mới sau khi SQL thành công.
4. Thêm → Trạng thái Production phải hiển thị database 2.11.0; kiểm tra Packing, Checklist & Family Travel đạt. Người đang mở app bấm Cập nhật sau khi lưu/đóng form; không cần hard reload.

## Sử dụng

- Thêm → Chuẩn bị chuyến đi → Dùng mẫu hoặc Thêm mục. Chọn phạm vi, người phụ trách trong danh sách tham gia, số lượng, hạn và ghi chú. Hạn là ngày, không phải giờ hẹn.
- Mục Cá nhân bắt buộc người phụ trách, vẫn là dữ liệu cả chuyến: Owner/Editor/Viewer đều xem được, không phải ghi chú bí mật. Dùng chung có thể để chưa phân công.
- Chọn “Bạn là ai trong chuyến?” một lần trên thiết bị/tài khoản/chuyến để bộ lọc Của tôi đúng người. Không tự ghép account theo tên. Chọn người khác chỉ đổi bộ lọc, không đổi quyền.
- Đồ dùng chỉ hoàn tất khi Đã đóng gói; công việc hoàn tất khi Hoàn tất. Không áp dụng giữ mục để có thể sử dụng lại, không tính vào mẫu số tiến độ và quá hạn. Mục Đã có còn chưa đóng gói vẫn tính chưa xong.
- Mỗi lần áp dụng mẫu tạo bản sao mới và có thể trùng tên nếu chủ động áp dụng lại. Toàn bộ lần áp dụng atomic/idempotent: mạng lỗi hoặc gửi lại cùng operation không nhân đôi. Không tự trộn hoặc ghi đè mục cũ.
- Thêm → Người tham gia → Sửa để đổi nhóm tuổi, gia đình, nhu cầu. Để chọn người phụ trách phải có người tham gia; không cho nhập tên tự do. Phải gỡ/đổi phân công trước khi xóa người đang được dùng, kể cả mục Không áp dụng.
- Liên hệ nhập điện thoại, địa chỉ, map URL HTTPS. Gọi điện/mở bản đồ cần thiết bị hỗ trợ và có thể cần mạng; app không tải bản đồ offline.
- Khi planning/ready, Tổng quan có tiến độ. Các mục checklist lưu offline sau lần tải chuyến thành công, đồng bộ khi có mạng. Thay đổi đồng thời có version conflict cần xử lý ở Dữ liệu/offline như các phần khác.

## Dữ liệu và quyền

Hai bảng RLS `trip_checklist_items`, `trip_contacts`; thêm `age_group`, `family_group`, `needs_note` vào `trip_participants`. Chỉ RPC kiểm tra quyền mới ghi được; Viewer xem, Owner/Editor sửa. Realtime phát sự kiện hai bảng mới. Template là mẫu tĩnh trong source, không dùng dịch vụ AI.

Backup server chứa checklist/liên hệ/thông tin gia đình; restore tạo chuyến mới, ID mới, ánh xạ người phụ trách sang danh sách mới. Backup cũ không có các trường này vẫn khôi phục được. Xóa mục checklist/liên hệ là soft delete, không hiện trong thùng rác UI của các entity cũ; có thể dùng bản backup đã tạo trước khi xóa. Các item đã xóa không xuất vào backup mới.

## UAT và rollback

Thử với Owner, Editor, Viewer; tạo mục cá nhân thiếu người, người ngoài chuyến, áp dụng mẫu, đổi trạng thái/bộ lọc, chỉnh người, liên hệ, mất mạng/sync và backup/restore. Trên iPhone/Safari thật thử mở/kéo/đóng sheet, bàn phím, chọn ngày và xoay máy. Kiểm tra dưới đáy không lộ nền.

Nếu cần quay lại source V2.10.1, giữ schema 2.11.0 và dữ liệu mới, không chạy ngược migration. Source cũ không có UI checklist; tránh sửa thông tin gia đình bằng form cũ. Không tự chạy SQL trên production trong lần bàn giao này.
