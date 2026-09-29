# Upgrade TripFlow V1.8.2 — Google Maps Share & Media Zoom Fix

V1.8.2 là bản PATCH frontend/API. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Thay đổi

- Google Maps: người dùng tiếp tục dùng **Chia sẻ → Sao chép đường liên kết**. TripFlow tự resolve link rút gọn, kiểm tra redirect và HTML/canonical, lấy tọa độ rồi chuẩn hóa URL.
- Media ảnh: khóa zoom trình duyệt toàn app; khi mở ảnh, pinch chỉ zoom ảnh 1x–5x và có thể kéo ảnh. Có thêm nút zoom/thu nhỏ/reset.
- Service worker cache đổi sang `tripflow-shell-v182`.

## Kiểm tra sau deploy

1. Dán một link `https://maps.app.goo.gl/...` lấy trực tiếp từ nút Share của Google Maps vào hoạt động, lưu và mở Map view.
2. Xác nhận hoạt động được tính vào “Điểm có tọa độ” và không còn cảnh báo link chưa đọc được tọa độ.
3. Trên mobile, pinch ngoài viewer ảnh không làm phóng toàn giao diện.
4. Mở một media loại Ảnh, pinch để zoom; xác nhận chỉ ảnh phóng, header/footer/dialog không phóng theo.
5. Reload PWA để nhận cache shell V1.8.2.
