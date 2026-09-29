# Upgrade TripFlow V1.8.0 — Map, Places & Route Intelligence

V1.8.0 là bản MINOR frontend/domain logic. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Cách nâng cấp

1. Deploy source V1.8.0 bằng Node 24.x.
2. Không chạy SQL mới nếu Database đã ở V1.4.0.
3. Đóng/mở lại PWA hoặc bấm cập nhật để nhận `tripflow-shell-v180`.
4. Vào **Lịch trình → Bản đồ** để kiểm tra route view.
5. Với hoạt động cần tính khoảng cách, nên dùng link Google Maps có tọa độ, ví dụ link dạng `query=10.7769,106.7009` hoặc URL có `@lat,lng`.

## Lưu ý Route Intelligence

- Khoảng cách được tính từ tọa độ bằng Haversine và hệ số đường đi bảo thủ; thời gian là **ước tính phục vụ rà soát kế hoạch**.
- TripFlow không gọi Directions API trả phí và không khẳng định thời gian giao thông thực tế.
- Nút **Mở tuyến Google Maps** tạo route ngoài app để người dùng xem điều hướng thực tế.
- Khi chỉ có tên địa điểm mà chưa có tọa độ, TripFlow vẫn tạo link Google Maps nhưng không tự tính quãng đường.

## UI/PWA

- PWA standalone khóa app viewport và dùng `.app-body` làm scroll container để bottom taskbar luôn ở đáy màn hình.
- Quick button dùng dấu × để ẩn; mũi tên chỉ xuất hiện khi Quick đã ẩn.
- Card Command Center trên Tổng quan đã bỏ; Command Center vẫn truy cập bằng nút ⚡ hoặc Ctrl/Cmd+K.
- Motion mới tôn trọng `prefers-reduced-motion`.
