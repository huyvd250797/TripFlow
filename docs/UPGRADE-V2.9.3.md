# V2.9.3 — Mobile Layout & Interaction Fix

Không cần chạy migration mới. App 2.9.3 / database 2.9.0. Nếu đã chạy SQL quỹ V2.9.0 thì không chạy lại; nếu chưa, hoàn tất migration V2.9.0 trước khi dùng quỹ.

Thay source gồm package-lock.json. Node 24.x, `npm ci`, `npm run build`. Giữ biến Supabase, root directory, cấu hình Vercel hiện tại. Người dùng lưu hoặc đóng bản nháp rồi chọn Cập nhật khi thông báo xuất hiện.

## Giao diện

Năm tab Chi phí theo thứ tự Tổng quan / Dự toán / Đối chiếu / Thực chi / Báo cáo. Tận dụng chiều ngang, trường hợp màn 320px không đủ thì tab cuộn ngang có chủ đích. Input và nội dung modal không cuộn ngang.

Modal mobile đầy visual viewport, không chừa khoảng cho bottom navigation; nav và Quick ẩn khi modal mở. Header đóng bên trái, footer Hủy bên trái/Lưu hoặc Xác nhận bên phải. Date/select/text có min-width 0 và width 100% để tránh kích thước mặc định của trình duyệt làm tràn khung. Desktop giữ modal căn giữa, cuộn nội dung khi cần.

Ví có hai KPI bằng nhau, cùng hàng; block xanh căn cùng dòng nhãn và số. Bỏ mô tả kỹ thuật và banner Smart Defaults/Form thông minh chiếm chỗ, nhưng giữ chức năng gợi ý mặc định cùng nút Thêm chi tiết. Các cảnh báo nghiệp vụ vẫn hiển thị khi cần.

## Người tham gia

Người giữ quỹ, người thanh toán và người đứng tên đặt chỗ là dropdown từ người tham gia. Thêm người ở module Thành viên trước nếu danh sách rỗng. API thiết lập quỹ xác minh tên thuộc danh sách hiện tại. Dữ liệu đang lưu vẫn theo schema tên cũ; không chuyển sang ID trong bản này. Tên lịch sử không thuộc danh sách chỉ hiển thị như dữ liệu cũ, không phải lựa chọn mới; cần chọn lại nếu thay người. Không tự sửa/xóa lịch sử hoặc tên cũ. Form thêm người tham gia và địa chỉ email mời cộng tác vẫn cho nhập để tạo mới.

## Quick

Kéo nút sấm sét theo chiều ngang/dọc, thả tay để bám mép trái/phải gần nhất; chạm bình thường mở Command Center. Nhớ phía và vị trí tương đối theo tài khoản trên thiết bị, điều chỉnh khi đổi kích thước/visual viewport. Nút đóng thu về mũi tên 26px, có thể hiện lại bằng cách chạm; vẫn hỗ trợ kéo khi thu gọn. Giới hạn vùng kéo để tránh header và thanh điều hướng. Kéo không thực hiện thao tác tài chính hay thay dữ liệu.

## Kiểm tra sau deploy

Kiểm tra thật trên iPhone/Safari/PWA: mở Thêm chi tiêu, bật Thêm chi tiết, chọn date/datetime, bật bàn phím, xoay máy, đóng/mở modal; bảo đảm footer còn dùng được và không còn bottom nav nằm đè. Kiểm tra tab Chi phí, chọn người giữ quỹ, kéo Quick sang hai mép và cập nhật phiên bản.

Đề xuất kế tiếp vẫn là V2.10.0 — Travel Readiness & Reminders, chưa xây dựng.
