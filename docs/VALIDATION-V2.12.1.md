# Validation — V2.12.1

Nền: ZIP V2.12.0 của Boss. Chỉ sửa source/UI; chưa push/deploy hoặc thay database production.

- Unit/database: 92/92 đạt, không thay migration. Các quy tắc cost sharing, batch itinerary, version/context, role và backup/restore giữ nguyên.
- Production build và TypeScript đạt; cài sạch bằng npm ci trước đóng gói. Không nâng dependency.
- Browser integration mới: app thật + PGlite, mock Supabase Auth/HTTP. Với 12 người tên dài và 18 khoản dự toán, kiểm tra nút/control nằm trong panel/viewport ở 320/390/430/768/1280px, cả sáng/tối. Kiểm tra cả text heading để không dùng overflow hidden che lỗi.
- Chuyển Timeline/Board/Bản đồ đều có đủ ba nhãn; Điều phối chỉ có launcher trên trang, controller nằm trong sheet.
- Nút Phân chia nằm trong header Báo cáo theo hoạt động; danh sách không render trên trang. Mở sheet dài với motion bật: rail có sẵn trước cử chỉ và cử chỉ touch đầu tiên đã cuộn nội dung; không cần vuốt thử lần đầu.
- Refresh: toast pending giữ cùng DOM khi đổi thành success/check, tự biến mất; refetch lỗi hiển thị warning, không success. Logo SVG không có rect nền và CSS background/border trong suốt.
- Hồi quy Chi phí/Sheet và V2.12 route đạt: cách chia, cọc 50%, vị trí báo cáo, payer quỹ, viewport bàn phím, native scroll/drag, fixed/flexible, Plan B, concurrent conflict, offline batch và Viewer.
- Bộ hồi quy tổng quát đạt: 40 responsive views, theme, form, quyền độc lập, offline Wallet/sync, xóa chuyến và cache cleanup; không có JavaScript page error.

Hồi quy Bookings/Module Hub và Packing cũng đạt: một picker, tài liệu CRUD, booking qua đêm, cache offline, template/checklist, gia đình, progress và Viewer. Popup cập nhật service worker đạt, giữ queue/theme/view và không reload tab khác.

Ảnh QA chỉ dùng kiểm tra nội bộ, không đóng gói. Chưa thử iPhone/Safari thật và Supabase production; cần UAT trên thiết bị của Boss. Cử chỉ đầu tiên được mô phỏng bằng Chromium CDP, không phải kết quả đo latency trên iPhone.

Bàn giao ZIP theo tên phiên bản, đủ README/CHANGELOG/ROADMAP. App 2.12.1, DB 2.12.0; không có TXT migration mới. Tiếp theo V2.13.0 — Group Expenses & Settlement.
