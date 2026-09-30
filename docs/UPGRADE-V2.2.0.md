# Upgrade TripFlow V2.2.0

1. Deploy source V2.2.0 như bản hiện tại; không chạy migration database mới.
2. Database yêu cầu vẫn là V1.4.0.
3. Reload/PWA refresh để nhận service worker cache `tripflow-shell-v220`.
4. Kiểm tra form tạo Chi tiêu/Hoạt động/Dự toán/Chuyến đi: trường chính hiển thị trước, **Thêm chi tiết** mở đầy đủ trường còn lại.
5. Kiểm tra form chỉnh sửa bản ghi cũ vẫn hiển thị đầy đủ trường.
6. Kiểm tra nút X tại Quick dock nằm trên nút ⚡ và bấm được trên mobile/PWA.
