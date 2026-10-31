# TripFlow V2.7.0 — Mobile Navigation & Interaction Polish

## Nâng cấp

Giữ cấu hình Supabase/Vercel hiện tại. **Không cần chạy migration mới** nếu database đã V2.4.1. Nếu chưa áp dụng `202610310001_v241_travel_reliability_permissions.sql`, chạy migration đó sau V1.4.0 trước khi dùng các quyền mới; không reset DB. Bản TXT migration V2.4.1 đã được bàn giao riêng.

Node 24.x; chạy `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. Dùng nguyên build command `npm run build` để sinh Service Worker manifest cho module lazy. Deploy source theo README. Thiết bị đang dùng V2.5/V2.6 nhận popup và bấm Cập nhật; không cần hard reload. App 2.7.0 / DB 2.4.1.

## Giao diện mobile

- Popup cập nhật nằm dưới dạng sheet, nút Để sau/Cập nhật dễ chạm; nội dung cuộn khi màn hình thấp hoặc bàn phím mở. Desktop vẫn căn giữa.
- Timeline một cột rộng, trục thời gian hẹp bên trái, card gọn; ghi chú và chỉnh giờ mở theo nhu cầu, giữ đủ dữ liệu và nút hành động.
- Thêm: chọn một trong ba nhóm, chọn mục rồi mới mở danh sách/chi tiết. Các danh sách nằm trong sheet có vùng cuộn riêng. Trên desktop giữ bố cục details hiện hữu.
- Vuốt ngang trên nội dung lịch trình/khoản chi/media để hiện thao tác; vuốt dọc vẫn dành cho cuộn. Nút sửa/xóa thường vẫn có để dùng bằng bàn phím/chuột. Không xóa chỉ bằng vuốt. Viewer không được hiện hành động sửa/xóa.
- Back của trình duyệt đóng popup trước; form đang ghi giữ nguyên, bản nháp vẫn hỏi xác nhận. Chuyển tab tạo lịch sử để Back quay về tab trước, sử dụng scroll đã lưu. Các bộ lọc vẫn nằm trong state hiện có.
- Theme, reduced motion, queue offline, RPC/RLS và soft delete được giữ.

## Kiểm tra

Theo `docs/TESTING.md`: chạy regression thường; thêm `TRIPFLOW_MOBILE_TEST=1` khi chạy `npm run test:ui` để kiểm tra More drill-down, Back, timeline và swipe. Không bật đồng thời biến polish/performance. Server test và Auth/HTTP giả lập dùng dữ liệu PGlite riêng. `npm run test:update:ui` dùng Service Worker thật với một bản patch mô phỏng.

Kiểm thử Chromium và PWA CSS mô phỏng không thay thế Safari/PWA iPhone thật, bàn phím và cử chỉ cảm ứng trên thiết bị. Chưa push/deploy production trong lần bàn giao này.

Roadmap hiện tại hoàn thành đến V2.7.0. Đề xuất **V2.8.0 — Bookings & Travel Documents** để Boss chọn, chưa triển khai. Gửi ZIP V2.7.0 mới nhất khi nâng cấp tiếp.
