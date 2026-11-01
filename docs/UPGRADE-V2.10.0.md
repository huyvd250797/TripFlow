# Nâng TripFlow V2.9.4 → V2.10.0

1. Sao lưu database / tạo backup chuyến đi trước khi nâng schema.
2. Trong Supabase SQL Editor, chạy duy nhất `supabase/migrations/202611010003_v2100_custom_cost_sharing.sql` (hoặc TXT cùng nội dung gửi kèm). Điều kiện: đã chạy toàn bộ migration tới V2.9.0. Không reset DB, không chạy lại migration cũ.
3. Thay source, giữ biến môi trường Supabase. Node 24.x, Root Directory có package.json; `npm ci`, `npm run build`. Push/deploy qua Vercel như README.
4. Kiểm tra Thêm → Trạng thái Production: schema 2.10.0. Nếu thiếu migration, form ghi dự toán/thực chi báo rõ file SQL cần chạy.
5. Người dùng đang mở app bấm Cập nhật. Source ZIP không chứa secret hay dữ liệu sản xuất.

## Khai báo ví dụ tiền phòng

- Dự toán → thêm/sửa Tiền phòng, số lượng 1, đơn giá 10.740.000.
- Chọn Cố định một phần, chia đều phần còn lại. Chọn A, nhập 7.000.000; tích B/C/D cho phần còn lại. Không tích người khác. App chia 3.740.000 thành 1.246.667 / 1.246.667 / 1.246.666. Thứ tự UUID cố định nhận chênh lệch 1đ để tổng chính xác; không tùy thuộc thứ tự danh sách.
- Ghi chi tiêu 5.370.000, Cọc phòng 50%, liên kết Tiền phòng, Cá nhân thanh toán, chọn A và Thanh toán phần chi phí phải chịu. Đối chiếu: A phải chịu 7 triệu, đã trả 5,37 triệu, chưa trả trực tiếp 1,63 triệu; khách sạn còn nhận 5,37 triệu. Không tự tạo đóng quỹ hay hoàn ứng.
- Lần trả sau tạo thực chi mới cùng khoản dự toán. Nếu dùng quỹ, người thanh toán được ẩn và không gán cho cá nhân.

## Quy tắc dữ liệu

- Chia đều dựa trên **danh sách Người tham gia** hiện có, không cần chọn. Khi danh sách thay đổi, cách chia đều tính lại. Hãy khai báo đủ danh sách trước khi chốt chi phí. Trường số lượng người trên thông tin chuyến đi không tạo các người không có tên.
- Cách cố định chỉ chia phần còn lại cho người được tích. Cho phép chọn cả người cố định nếu muốn họ chịu thêm phần còn lại. Hỗ trợ nhiều phần cố định, chặn trùng người cố định / vượt tổng / danh sách rỗng / người ngoài chuyến.
- Chặn xóa người đang được tham chiếu trong cách chia cố định; sửa các khoản liên quan trước. Đổi tên không mất liên kết thanh toán mới nhờ ID.
- Dự toán cũ giữ chưa khai báo cách chia; không tự gán nghĩa vụ hồi tố. Sửa và lưu để cấu hình một trong hai cách. Thực chi cũ giữ loại ứng trước như trước V2.10.0; chỉ giao dịch mới mặc định trả trực tiếp. Muốn đổi khoản cọc cũ của A, sửa chọn Thanh toán phần chi phí phải chịu; nếu đã hoàn ứng phải xử lý giao dịch hoàn liên quan trước.
- Bảng chia là thỏa thuận + chứng từ đã trả nhà cung cấp, không tự tạo công nợ/chuyển tiền nội bộ. Tiền đã chi từ quỹ hiển thị riêng; không phân bổ đóng quỹ sang từng khoản. Số phải chịu theo dự toán, không tự giảm theo tiền cọc hoặc số thực chi hiện tại.
- Sao lưu/khôi phục giữ cách chia và ánh xạ ID sang chuyến mới. Mẫu kế hoạch tái sử dụng không mang phân chia cá nhân sang chuyến khác. Dữ liệu offline giữ cấu hình chia, đồng bộ vẫn kiểm tra version/idempotency; SQL từ chối người không còn hợp lệ và giữ thao tác để người dùng xử lý xung đột.

## Quay lại phiên bản cũ

Schema bổ sung tương thích dữ liệu cũ. Có thể đưa source V2.9.4 trở lại tạm thời, nhưng tránh sửa khoản mới bằng app cũ vì không có giao diện chia chi phí. Không xóa cột/schema để rollback; giữ backup, nâng source lại khi sửa xong. Không chạy lại SQL cũ để hạ schema.

## Nghiệm thu iPhone

Thử ở Safari và PWA: mở/đóng form, bàn phím, chọn ngày, cuộn nội dung, Back, xoay máy, nhiều vòng liên tiếp; đáy sheet phủ cả vùng home indicator bằng màu panel. Mở trượt lên/đóng trượt xuống, kéo ngắn hồi vị trí, kéo dài đóng; form chưa lưu phải xác nhận. Desktop và popup cập nhật vẫn căn giữa. Kiểm thử tự động mô phỏng viewport không thay cho kiểm tra thiết bị thật.
