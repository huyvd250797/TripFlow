# TripFlow V2.9.0 — Trip Fund & Settlement

## Nâng cấp từ V2.8.0

1. Tạo backup/PITR của Supabase trước khi nâng cấp. Backup ứng dụng trước V2.9 chưa có quỹ; không thay thế backup database.
2. Database phải đã có V2.4.1 và V2.8.0. Nếu đã chạy thì **không chạy lại** các migration cũ. Nếu chưa, chạy hai bản đó trước theo tài liệu tương ứng.
3. Trong Supabase SQL Editor, mở file TXT V2.9 được gửi riêng, copy toàn bộ nội dung và Run. TXT chỉ chứa SQL của `202611010002_v290_trip_fund.sql`, không có Markdown. Migration chạy trong transaction, không reset DB, không xóa dữ liệu cũ; có thể chạy lại chính V2.9 nếu cần.
4. Deploy source V2.9.0 bằng Node 24.x, `npm ci`, `npm run build`. Giữ nguyên biến Supabase hiện có. Không bỏ bước sinh service worker manifest cuối build.
5. Người dùng chọn **Cập nhật** trong popup. Trước khi cập nhật cần lưu/đóng bản nháp và xử lý các thao tác đang gửi. Kiểm tra **Thêm → Trạng thái Production**: App/DB 2.9.0, stable, các kiểm tra đạt.
6. Kiểm tra ba tab Chi phí và đặt chỗ trên thiết bị thật. Chưa tự deploy Supabase hay hosting trong gói bàn giao này.

## Dùng quỹ thực tế

1. Thêm đủ người tham gia. Trong **Chi phí → Dự toán**, lên kế hoạch và dùng **Đối chiếu dự toán** để chốt. Chốt dự toán không tạo giao dịch thu quỹ.
2. **Chi phí → Tổng quan → Quản lý quỹ → Người giữ quỹ**: lưu tên người giữ, ghi chú cách nhận tiền. Đây là thông tin mô tả, không tự cấp quyền truy cập.
3. Trong **Đóng quỹ**, đặt mức đóng/hạn từng người. Mục tiêu có thể khác nhau; có thể sửa mức đóng với kiểm tra phiên bản. Mỗi lần thực nhận tiền mới bấm **Ghi đóng quỹ**, nhập số tiền, ngày, phương thức, tham chiếu/chứng từ HTTPS. Không có kết nối chuyển tiền ngân hàng tự động.
4. **Ghi chi tiêu**: chọn đúng nguồn **Quỹ chuyến đi** hoặc **Cá nhân ứng trước**, người thực hiện, dự toán và hóa đơn. Chi quỹ làm giảm số dư; chi cá nhân tạo phần còn ứng. Các khoản cũ và Quick Entry mặc định cá nhân; rà soát phân loại trước khi sử dụng số còn ứng. Muốn thay nguồn hãy sửa khoản chi.
5. Hoàn tiền của nhà cung cấp ghi bằng loại **Hoàn tiền** liên kết khoản chi gốc. Nguồn tiền tự kế thừa; không dùng Đóng quỹ để thay cho hoàn tiền. Nếu tiền được chuyển lại cho người đã ứng mà khoản đó đã hoàn ứng, cần hủy/điều chỉnh hoàn ứng liên quan trước.
6. **Quản lý quỹ → Hoàn / trả**: hoàn ứng đúng khoản cá nhân, có thể chia nhiều lần. Cuối chuyến thống nhất số dư trả từng người rồi ghi **Trả quỹ**. Không tự chia đều công nợ; mức đóng không phải phép chia thực chi tự động. Chức năng này ghi nhận tiền đã hoàn/trả, không thực hiện chuyển khoản.
7. **Sổ quỹ** giữ các lần thu, hoàn ứng, trả quỹ. Nhập nhầm thì **Hủy giao dịch** để tạo bút toán đảo; không xóa lịch sử. Muốn thay đổi khoản đã hoàn ứng cần hủy phần hoàn ứng tương ứng trước. Không thể hủy một khoản thu nếu sẽ làm âm quỹ.

## Công thức và quyền

- Số dư quỹ = đóng quỹ còn hiệu lực − trả quỹ − hoàn ứng − (chi trực tiếp từ quỹ − hoàn tiền về quỹ).
- Cá nhân còn ứng = chi cá nhân − hoàn tiền liên quan − hoàn ứng còn hiệu lực.
- Thực chi ròng vẫn = tất cả khoản chi − hoàn tiền. Đóng quỹ, hoàn ứng và trả quỹ không tăng thực chi.
- Owner/Editor quản lý quỹ; Viewer chỉ xem. Giữ nguyên năm quyền đặc biệt trước đây. Người giữ quỹ không mặc nhiên có quyền Owner/Editor.
- Không cho âm quỹ, hoàn ứng vượt phần còn ứng hoặc trả thành viên vượt phần đã đóng ròng. Sửa/xóa/khôi phục khoản chi cũng kiểm tra ảnh hưởng đến quỹ.
- Khóa giao dịch theo chuyến, version cho cấu hình/mức đóng, operation ID chống ghi trùng khi gửi lại. Giao dịch thành công có audit. Không sửa trực tiếp bảng quỹ từ client.

## Offline, cập nhật và dữ liệu

- Quỹ tải qua API riêng, cache theo user/chuyến; xem bản đã lưu khi offline. Thu/hoàn/trả/hủy giao dịch chỉ online; có trạng thái chờ/lỗi và nút tải lại. Khi đang mở Tổng quan, làm mới lúc focus, có mạng lại, chi phí thay đổi và mỗi 30 giây khi trang đang hiển thị.
- Chi phí cốt lõi vẫn dùng hàng đợi offline. Chi từ quỹ ở máy khác/offline phải được server chấp nhận khi đồng bộ; số dư hiển thị có thể là tạm tính. Nếu không đủ quỹ, queue báo lỗi để xử lý, không tự biến thành chi cá nhân.
- Xuất sổ quỹ JSON gồm quỹ, mức đóng, toàn bộ giao dịch, chi phí và người tham gia. File xuất để đối chiếu, không có chức năng nhập sổ quỹ rời trong bản này.
- Backup ứng dụng tạo từ V2.9 chứa quỹ và toàn bộ liên kết cần thiết, gồm chi phí/người tham gia đã xóa được sổ quỹ tham chiếu. Restore-as-copy tạo ID mới, giữ số dư và lịch sử hủy; không sao chép quyền thành viên. Khôi phục chuyến bị xóa mềm giữ nguyên quỹ. Backup cũ không có quỹ thì khôi phục như trước.
- Đặt chỗ/tài liệu vẫn có xuất JSON riêng; **backup ứng dụng chưa chứa module đặt chỗ** như giới hạn V2.8. Mẫu chuyến không sao chép thực chi/quỹ/lịch sử thu.
- Chỉ hỗ trợ VNĐ, một quỹ chung/một chuyến; chưa có nhiều loại tiền, thu tự động hay phân bổ công nợ theo tỷ lệ chi phí.

## Rollback

Ưu tiên sửa tiếp trên schema mới; không drop cột/bảng quỹ để rollback giao diện. Source V2.8 không hiểu nguồn tiền quỹ nên không tiếp tục ghi chi phí bằng client cũ sau khi vận hành quỹ. Nếu buộc rollback dữ liệu, dùng Supabase backup/PITR và quy trình vận hành; không dùng SQL reset.

## Phiên bản tiếp theo

Đề xuất **V2.10.0 — Travel Readiness & Reminders**: checklist, phân công chuẩn bị và cảnh báo hạn/giờ đặt chỗ. Chưa triển khai. Gửi source ZIP V2.9.0 mới nhất khi nâng cấp tiếp.
