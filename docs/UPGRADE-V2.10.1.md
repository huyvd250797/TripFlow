# Nâng V2.10.0 → V2.10.1 — Sheet & Cost Sharing UX Fix

1. Sao lưu database trước khi chạy SQL. Điều kiện: đã áp dụng `202611010003_v2100_custom_cost_sharing.sql` của V2.10.0. Nếu chưa có, chạy file đó trước theo bản TXT đã gửi / SQL trong source. Không chạy lại SQL đã áp dụng.
2. Mở Supabase SQL Editor, chạy duy nhất `202611010004_v2101_selected_cost_sharing.sql` (nội dung đầy đủ trong TXT đi kèm). Migration kiểm tra điều kiện trước khi thay đổi, giữ các phân chia hiện có. Không reset DB.
3. Dùng source mới, giữ env Supabase, Node 24.x; `npm ci` rồi `npm run build`. Root Directory là thư mục có package.json. Deploy qua GitHub/Vercel như README.
4. Kiểm tra Thêm → Trạng thái Production: schema 2.10.1. Người đang mở app bấm Cập nhật; dữ liệu chờ đồng bộ vẫn được giữ.

## Ba cách chia

- Chia đều cho tất cả người tham gia: không chọn, tự dùng danh sách Người tham gia.
- Chia đều cho danh sách được chọn: tích những người được chia. Bộ đếm phản ánh số người tích. Ví dụ 10.740.000, chọn B/C/D → mỗi người 3.580.000, A và người không tích không chịu khoản này. Không có phần cố định.
- Cố định một phần, chia đều phần còn lại: giữ nguyên A chịu 7 triệu; chọn B/C/D cho phần 3,74 triệu. Không làm đổi tiền đã cọc.

Cả hai cách chọn người đều chặn danh sách rỗng, trùng, người ngoài chuyến; chặn xóa người đang được dùng trong các khoản chia theo danh sách. Tổng nguyên VNĐ được bảo toàn, chênh 1đ phân bổ theo UUID ổn định. Backup/restore ánh xạ danh sách sang ID mới, không mất cách chia. Hai cách chia cũ không bị thay đổi.

## Vị trí chức năng

Khai báo tại Chi phí → Dự toán → thêm/sửa khoản → Phân chia chi phí. Xem phần phải chịu/đã trả tại Chi phí → Báo cáo → Phân chia chi phí. Đối chiếu dành cho so sánh dự toán và thực chi. Không thêm tab mới.

## Sheet và Quick

Header mobile một dòng khoảng 63px, tiêu đề dài được xuống dòng, giữ nút Đóng bên trái. Mô tả phụ được ẩn khỏi header để tiết kiệm chỗ. Vùng cuộn được chuẩn bị sẵn; thao tác đầu ở nội dung không bị animation mở giữ lại. Kéo đóng chỉ bắt ở tay nắm/header, vẫn có bảo vệ dirty/busy. Popup cập nhật/xác nhận nhỏ ở giữa, desktop giữ dialog giữa màn hình.

Quick tính giới hạn theo taskbar thật, phần nút cách taskbar 6px; mũi tên thu gọn dùng chiều cao 34px thay vì chiều rộng 26px. Kéo bám mép và nhớ vị trí như trước. Thử cả xoay máy và thay đổi kích thước.

## UAT và rollback

Đã mô phỏng cảm ứng/viewport trên Chromium; chưa xác minh iPhone/Safari thật. Sau deploy thử mở sheet rồi vuốt ngay, nhập/đóng bàn phím, chọn ngày, kéo sheet, đóng/mở nhiều lần; kiểm tra header gọn và đáy không lộ khoảng nền. Nếu cần rollback source, giữ schema và backup; app V2.10.0 không có UI cho cách chia mới nên tránh sửa khoản kiểu mới bằng app cũ. Không hạ DB bằng cách chạy lại SQL cũ.
