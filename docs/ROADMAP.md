# Phạm vi phát hành và bước tiếp theo

## V0.1.0 — bản được bàn giao

Hoàn thành vòng sử dụng online: tài khoản → chuyến đi → lịch trình → dự toán → chi tiêu/hoàn tiền → so sánh → check-in → album → chia sẻ thành viên. Có database thật khi kết nối Supabase, phân quyền, kiểm tra transaction, export và tài liệu deploy.

Bản này triển khai phần nền tảng và nghiệp vụ chính từ kế hoạch. Không coi V0.1 là hoàn tất mọi giai đoạn trong tài liệu kế hoạch.

## V0.2 — dùng tốt khi mạng yếu

- IndexedDB chứa bản sao dữ liệu đã được phép đọc và hàng đợi thao tác bền vững.
- Service worker cache app shell, kiểm soát phiên bản cache; không cache trang/email xác thực.
- Chính sách xử lý xung đột và mất quyền khi offline; trạng thái chờ/đã đồng bộ/thất bại.
- Kiểm thử tắt mạng, reload, nhiều thiết bị, gửi lặp và thu hồi quyền khi có dữ liệu local.
- Nhập JSON qua schema có phiên bản, preview, mapping ID và transaction; không ghi đè im lặng.

## V0.3 — cộng tác và sử dụng thường xuyên

- Tách component theo module khi mở rộng, danh sách phân trang ở UI, tối ưu payload theo tab.
- Cải thiện realtime theo từng bảng, kiểm thử mạng gián đoạn trên Android/iOS thật.
- Cấu hình nhắc lịch, web push theo đồng ý của người dùng; không mặc định theo dõi vị trí nền.
- Mời email bằng tác vụ server có rate limit; token hash, quản lý nhiều lời mời cùng email.
- Dashboard theo dõi lỗi, giới hạn lạm dụng đăng ký/ghi dữ liệu theo người dùng và project.

## Giai đoạn mở rộng khi có nhu cầu

Đa tiền tệ/tỷ giá đã chốt, chia nợ và quyết toán nhóm, mẫu chuyến đi, sắp xếp kéo thả, nhập lịch, đề xuất địa điểm, tổng kết chuyến đi, báo cáo nâng cao. Tính phí, tích hợp đặt vé/phòng và AI nằm ngoài V0.1.

## Điều kiện trước khi mở rộng cho nhiều nhóm

Nghiệm thu staging Supabase/Vercel thật; kiểm tra Auth email và recovery; kiểm thử quyền với nhiều tài khoản; backup có thử restore; đo hiệu năng trên dữ liệu thật; đặt cảnh báo quota và chi phí dịch vụ. Quy mô Cloud MVP hướng đến cá nhân/nhóm nhỏ.
