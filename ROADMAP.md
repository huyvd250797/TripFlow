# TripFlow — Roadmap đã thống nhất

Chốt tham chiếu ngày 02/11/2026 theo yêu cầu Boss. Source nền: V2.12.3 — Complete Theme Consistency; đã rollback các thử nghiệm V2.12.4/V2.12.5.

## Quy tắc duy trì

- Khi Boss yêu cầu gửi lại roadmap, giữ đúng tên phiên bản, thứ tự và phạm vi dưới đây. Không tự thêm, đổi tên, đổi thứ tự hoặc thay phiên bản bằng ý tưởng khác.
- Chỉ cập nhật trạng thái khi có kết quả thực hiện; thay đổi phạm vi phải có yêu cầu của Boss và ghi rõ thay đổi.
- Phạm vi từng phiên bản giữ nguyên; trạng thái triển khai được ghi riêng bên dưới.
- Gợi ý ưu tiên Utility Hub/Family trước International là lựa chọn chưa được Boss chốt; không tự áp dụng thay đổi thứ tự.

## Trạng thái triển khai

- V2.13.0 — Group Expenses & Settlement: đã xây dựng trên source V2.12.3; chưa push/deploy. Kết quả kiểm tra tại docs/VALIDATION-V2.13.0.md trong ZIP.
- V2.14.0–V2.19.0: chưa triển khai; giữ đúng thứ tự và phạm vi đã chốt.

## Roadmap gốc

| Phiên bản                                      | Mục tiêu                             | Chức năng và tiện ích chính                                                                                            | Kỹ thuật/dữ liệu                                                         | Điều kiện hoàn thành                                                                        |
| ---------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| V2.13.0 — Group Expenses & Settlement          | Biết ai còn phải trả hoặc được nhận  | Công nợ từng người; đề xuất chuyển tiền; xác nhận thanh toán; lịch sử quyết toán; đối chiếu quỹ dư                     | Migration giao dịch quyết toán; phân quyền; xử lý làm tròn               | Tổng tiền khớp; khoản đóng quỹ, hoàn ứng và chuyển tiền không bị tính thành chi phí lần nữa |
| V2.14.0 — Travel Reminders & Offline Trip Pack | Mở được thông tin quan trọng khi cần | Nhắc giờ xuất phát/check-in/trả phòng; xuất lịch ICS; tải vé và tài liệu trước chuyến; nút Sẵn sàng offline            | Lưu cấu hình nhắc; tải/cache file; hiển thị dung lượng và trạng thái tải | Tài liệu đã tải mở được khi mất mạng; thông báo rõ nội dung chưa có offline                 |
| V2.15.0 — International Travel                 | Quản lý chuyến đi nước ngoài         | Đa tiền tệ; tỷ giá theo giao dịch; giờ địa phương từng chặng; checklist hộ chiếu/visa                                  | Mở rộng tiền tệ và múi giờ; giữ tương thích dữ liệu VNĐ                  | Tổng chi phí quy đổi khớp; lịch trình hiển thị đúng giờ từng nơi                            |
| V2.16.0 — Travel Utility Hub                   | Gom các công cụ nhỏ thường dùng      | Tính chi phí xăng, cầu đường, gửi xe; đổi đơn vị; ghi vị trí đỗ xe; danh sách mua đồ; ghi chú nhanh                    | Công cụ tính chạy trên thiết bị; lưu thông tin theo chuyến khi cần       | Mở nhanh, dùng được offline với công cụ không cần dữ liệu bên ngoài                         |
| V2.17.0 — Family Travel Companion              | Hỗ trợ gia đình đi cùng trẻ nhỏ      | Theo dõi đồ cần bổ sung; nhật ký ăn/ngủ/thay tã tùy chọn; chèn khoảng nghỉ vào lịch; bàn giao việc giữa người chăm sóc | Kế thừa checklist và nhóm gia đình; bổ sung nhật ký, quyền xem/sửa       | Dùng nhanh bằng một vài thao tác; bật/tắt riêng, không làm rối chuyến đi thông thường       |
| V2.18.0 — Group Decisions & Collaboration      | Giảm trao đổi rời rạc khi đi nhóm    | Bình chọn địa điểm/nhà hàng; bình luận tại hoạt động; phân công; ghim quyết định cuối cùng                             | Lưu bình chọn, bình luận và lịch sử; đồng bộ thành viên                  | Thành viên thấy quyết định đã chốt và phần việc của mình                                    |
| V2.19.0 — Trip Review & Reuse                  | Rút kinh nghiệm cho chuyến sau       | Tổng kết dự kiến/thực tế; đánh giá địa điểm; ghi chú lần sau; tạo mẫu từ chuyến đã đi và chọn nội dung muốn giữ        | Kế thừa báo cáo, Memories và mẫu kế hoạch hiện có                        | Tạo chuyến mới không mang theo công nợ, thanh toán hoặc dữ liệu cá nhân ngoài lựa chọn      |

## Các tiện ích hỗ trợ đã đề xuất

| Tiện ích                      | Cách sử dụng                                                                                  | Vị trí phù hợp                 | Ưu tiên |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ | ------- |
| Sẵn sàng offline              | Một lần kiểm tra lịch trình, vé và tài liệu đã tải đủ chưa                                    | Tổng quan trước chuyến         | Rất cao |
| Thông tin cần ngay            | Mở nhanh địa chỉ nơi ở, mã đặt chỗ, số liên hệ và hướng dẫn nhận phòng                        | Block Đang diễn ra / Tiếp theo | Rất cao |
| Máy tính chi phí di chuyển    | Nhập quãng đường, mức tiêu hao, giá nhiên liệu và phí khác → đưa kết quả vào dự toán nếu muốn | Trong form Dự toán             | Cao     |
| Danh sách mua trước chuyến    | Chuyển món còn thiếu từ checklist thành danh sách mua; mua xong đánh dấu lại                  | Chuẩn bị chuyến đi             | Cao     |
| Ghi nhớ chỗ đỗ xe             | Lưu ghi chú, ảnh và vị trí được người dùng cho phép; mở lại chỉ đường                         | Menu thao tác nhanh            | Cao     |
| Phiếu thông tin chuyến đi     | Xuất một trang gồm lịch chính, nơi ở và liên hệ để gửi người thân                             | Chia sẻ / Báo cáo              | Cao     |
| Ngân sách còn lại/ngày        | Tính từ số tiền còn lại và số ngày còn lại, giúp điều chỉnh mức chi                           | Ví chuyến đi hiện có           | Cao     |
| Thời tiết theo điểm đến       | Xem dự báo có thời điểm cập nhật; gợi ý xem lại phương án B                                   | Lịch trình theo ngày           | Sau     |
| Nhập chi tiêu từ ảnh hóa đơn  | Đọc số tiền/nội dung → người dùng kiểm tra rồi mới lưu                                        | Form Ghi chi tiêu              | Sau     |
| Gợi ý điều chỉnh lịch bằng AI | Đề xuất đổi thứ tự, rút ngắn hoặc bỏ điểm; xem trước rồi xác nhận                             | Điều phối lịch trình           | Sau     |

Thời tiết, đọc hóa đơn và AI cần khảo sát nguồn dữ liệu, chi phí và giới hạn tích hợp trước khi chốt xây dựng. Nhắc việc phải tách nhắc trong app, lịch ICS và thông báo khi app đóng; kiểm chứng iPhone/PWA trước khi cam kết.

Giữ các tab chính hiện có; tiện ích đặt ngay trong nghiệp vụ liên quan. Danh sách dài mở bằng bottom sheet; công cụ ít dùng gom trong Thêm → Tiện ích.
