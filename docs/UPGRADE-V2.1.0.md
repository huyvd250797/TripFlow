# Upgrade TripFlow V2.1.0

V2.1.0 là bản nâng cấp UX/logic phía ứng dụng, **không có migration database mới**.

1. Deploy source V2.1.0 bằng Node 24.x.
2. Giữ Database ở V1.4.0.
3. Reload/PWA refresh để nhận service worker cache `tripflow-shell-v210`.
4. Kiểm tra nút ⚡ Command Center và thử lệnh acceptance:
   `chi 150k ăn trưa viện hải dương học HuyVo`
5. Xác nhận preview nhận đúng số tiền, nội dung, người thanh toán và khoản dự toán trước khi bấm Lưu nhanh.
6. Nếu có nhiều budget/participant gần giống, xác nhận app yêu cầu chọn ngay trong preview thay vì tự đoán.
