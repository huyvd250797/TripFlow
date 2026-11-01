# Nâng V2.12.0 → V2.12.1 — Mobile Layout & Interaction Polish

**Không cần chạy migration mới.** App 2.12.1 / database 2.12.0. ZIP giữ nguyên toàn bộ 18 SQL của V2.12.0. Không reset hoặc chạy lại SQL cũ; không có TXT migration rỗng.

1. Dùng source mới, giữ các env Supabase hiện có.
2. Node 24.x; mở thư mục chứa package.json, `npm ci` rồi `npm run build`.
3. Deploy source qua GitHub/Vercel như README. Đây là bàn giao source, chưa push hoặc deploy tự động.
4. Sau deploy, đóng/lưu form đang nhập rồi bấm Cập nhật trong app. Trạng thái Production: App 2.12.1, Database 2.12.0. Nếu database còn 2.11.0, cần chạy đúng migration V2.12.0 đã bàn giao trước đó rồi mới dùng chức năng lịch linh hoạt; không chạy lại nếu đã áp dụng.

## Vị trí chức năng

- Lịch trình → icon Điều phối bên cạnh Timeline/Board/Bản đồ → chọn điểm, xem trước điều chỉnh, Muốn đi hoặc Kiểm tra lịch. Các nút +/- giờ và chặng trên từng hoạt động tiếp tục mở đúng sheet.
- Chi phí → Báo cáo → block Báo cáo theo hoạt động → Phân chia. Mở sheet để chọn dự toán/xem phần phải chịu và đã thanh toán. Cách chia vẫn chỉnh trong form Dự toán, không thay đổi cách tính.
- Chuẩn bị chuyến đi: mobile nhỏ dùng hai icon Dùng mẫu/Thêm mục và icon Thêm liên hệ cạnh tiêu đề; có nhãn truy cập/title đầy đủ. Tên module dài vẫn được xuống dòng, chỉ nhãn nút hành động ngắn giữ một dòng.
- Tải lại dữ liệu ở header: thông báo Đang cập nhật giữ đến khi các query active refetch xong; thành công đổi dấu kiểm và tự ẩn sau 3,5 giây. Có lỗi hoặc offline hiển thị cảnh báo, vẫn giữ dữ liệu cache. Thông báo khác giữ hành vi mặc định.

## Sheet và bố cục

Vùng nội dung giữ native touch scroll, bỏ lớp GPU/transform riêng trên nội dung và không ép kết thúc entrance animation lúc pointer đầu. Scroll pane được đo trước animation; thanh chỉ báo thụ động xuất hiện khi thực sự có nội dung tràn và cập nhật theo cuộn/resize/nội dung. Thanh không bắt cử chỉ hoặc chiếm diện tích dữ liệu. Desktop tiếp tục dùng scrollbar native; popup cập nhật/xác nhận compact không chuyển fullscreen.

Giữ header/tay nắm kéo đóng, Cancel trái/Save phải, cảnh báo dữ liệu chưa lưu và chặn đóng khi đang ghi. Không đổi phân quyền, dữ liệu quỹ, cost sharing, timeline/route/wishlist, checklist hoặc booking.

## Kiểm tra sau deploy và rollback

Trên iPhone/Safari thật: thử app thường/PWA, mở sheet dài và vuốt ngay khi đang trượt vào, chọn dropdown, mở/đóng bàn phím, kéo đóng rồi mở lại. Kiểm tra thanh view đủ ba nhãn, logo không có nền vuông, tiêu đề và nút không tràn, refresh thành công/lỗi đúng trạng thái. Chromium mô phỏng không bảo đảm mọi hành vi WebKit/iOS; lần bàn giao này chưa kiểm thử thiết bị thật.

Có thể rollback source V2.12.0 nếu cần; database không đổi và dữ liệu giữ nguyên.
