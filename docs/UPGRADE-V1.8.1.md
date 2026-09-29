# Upgrade TripFlow V1.8.1 — Map Link, Media Viewer & PWA Keyboard Fix

V1.8.1 là bản PATCH frontend/API. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Nâng cấp

1. Deploy source V1.8.1 bằng Node 24.x.
2. Không chạy thêm SQL nếu Database đã ở V1.4.0.
3. Đóng/mở lại PWA hoặc bấm cập nhật để nhận `tripflow-shell-v181`.
4. Kiểm tra một activity dùng link `https://maps.app.goo.gl/...`: mở Lịch trình → Bản đồ và chờ trạng thái tự đọc tọa độ.
5. Kiểm tra Media với ảnh/file/folder Google Drive có quyền xem; ảnh phải mở trong viewer TripFlow, album có thể mở embedded grid nếu Google Drive cho phép nhúng.
6. Trên iPhone/PWA, mở form sửa activity, focus trường URL rồi đóng/mở keyboard để xác nhận header/body/footer vẫn nằm đúng trong visual viewport.

## Lưu ý Google Drive

TripFlow không thay đổi quyền Google Drive. Preview chỉ hoạt động khi URL/file/folder cho phép người dùng hiện tại xem hoặc nguồn cho phép nhúng. Nếu preview bị chặn, dùng **Mở nguồn**.
