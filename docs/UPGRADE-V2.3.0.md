# Upgrade TripFlow V2.3.0 — Trip Daily Command Center

1. Deploy source V2.3.0; **không chạy migration database mới**. Database vẫn là V1.4.0.
2. Reload/PWA refresh để nhận service worker cache `tripflow-shell-v230`.
3. Mở tab **Tổng quan** với chuyến ở trạng thái **Đang trong chuyến đi** và kiểm tra thứ tự: Đang diễn ra → Tiếp theo → Lịch hôm nay → Chi hôm nay → Cần chú ý.
4. Kiểm tra action tại activity: Maps, Ghi chi, Tôi đã đến/Hoàn thành. Ghi chi phải nhận budget/category của activity nếu có.
5. Với chuyến chưa đi, Tổng quan phải ưu tiên countdown/điểm đầu tiên. Với chuyến đã kết thúc, Tổng quan phải ưu tiên tổng kết.
6. Tổng quan không được hiển thị lại các dashboard block cũ theo kiểu xếp chồng. Summary 4 chỉ số phải compact trên mobile.
7. Roadmap phải hiển thị V2.3.0 ✅ và V2.4.0 là phiên bản tiếp theo.
