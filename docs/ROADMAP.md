# TripFlow roadmap

Roadmap này cũng được hiển thị trực tiếp trong **Thêm → TripFlow roadmap**. Phiên bản đã hoàn thành được đánh dấu ✅; khối cuối màn hình luôn mô tả phiên bản kế tiếp.

## ✅ V0.1.0 — Cloud MVP

Hoàn thành tài khoản, chuyến đi, lịch trình, roadmap/check-in, dự toán, thực chi/hoàn tiền, media link, thành viên, RLS, audit, chống ghi trùng và triển khai Vercel + Supabase.

## ✅ V0.2.0 — Offline, Data Reliability & Master Administration

- IndexedDB cache danh sách chuyến và bundle dữ liệu theo `user_id`.
- Service worker cache app shell; API và route xác thực không được cache.
- Hàng đợi offline bền vững với `operationId`, trạng thái pending/sending/conflict/rejected.
- Tự đồng bộ khi mạng trở lại hoặc người dùng bấm Đồng bộ ngay.
- Server vẫn kiểm tra idempotency, version, quyền hiện tại và transaction khi nhận thao tác offline.
- Offline write có chủ đích: thêm thực chi; cập nhật/check-in lịch trình; thêm/sửa người tham gia và media. Thao tác nhạy cảm vẫn yêu cầu online.
- Master Admin: xem danh sách user, trạng thái, chuyến đi, audit và dữ liệu theo chuyến; hủy kích hoạt/kích hoạt lại user.
- Tài khoản bị hủy kích hoạt bị chặn bởi account gate, RLS và mutation wrapper. Khi đăng nhập, app phát hiện trạng thái rồi đăng xuất ngay.
- Audit riêng cho thao tác quản trị tài khoản.

## ✅ V0.3.0 — Finance & Reporting Integrity

- Lần chốt đầu tiên trở thành **baseline dự toán gốc**, các lần sau là revision; snapshot có số thứ tự, tổng tiền và số khoản.
- Snapshot được bảo vệ bất biến ở database, không cho cập nhật nội dung sau khi chốt.
- Báo cáo tài chính server-side đối chiếu **dự toán gốc / dự toán hiện tại / tổng chi / hoàn tiền / thực chi ròng / chênh lệch**.
- Báo cáo theo nhóm, ngày và hoạt động; theo dõi khoản ngoài dự toán.
- Data Integrity kiểm tra refund vượt gốc, refund sai liên kết, liên kết dự toán sai nhóm/đã xóa, activity link và snapshot mismatch.
- Export CSV/JSON tài chính có cấu trúc đầy đủ; CSV tiếp tục chống formula injection.
- UI Chi phí bổ sung tab Báo cáo, baseline/revision history và cảnh báo integrity.

## ✅ V0.4.0 — Live Trip & Realtime

- Live panel hiển thị rõ **Current / Next / Late**, thời gian đến chặng tiếp theo và độ trễ của chặng hiện tại.
- Check-in/hoàn thành/bỏ qua/đặt lại tiếp tục chạy trong transaction; chỉ có một activity `active` trên mỗi chuyến.
- Bảng `itinerary_events` lưu lịch sử trạng thái bất biến theo `operation_id`, bao gồm auto-complete khi chuyển sang chặng khác.
- Realtime subscribe riêng cho `trips`, `itinerary_items`, `itinerary_events`, `expenses`; vẫn giữ refetch 30 giây làm fallback.
- Migration tự thêm các bảng Live Trip vào `supabase_realtime` publication nếu publication tồn tại.
- UI hiển thị trạng thái kết nối Realtime và lịch sử Live Trip theo múi giờ chuyến đi.
- Cảnh báo hoạt động đã qua giờ và activity active đang kéo dài quá thời gian kế hoạch.

## ✅ V0.5.0 — Collaboration & Permission Control

- Hoàn thiện ma trận quyền **Owner / Editor / Viewer** ngay trong UI để người dùng hiểu rõ phạm vi thao tác.
- Account truy cập và `trip_participants` tiếp tục là hai khái niệm độc lập: người đi thực tế không bắt buộc có tài khoản TripFlow.
- Chặn mời trùng email khi lời mời trước còn hiệu lực và chặn mời tài khoản đã có quyền trong chuyến.
- Bổ sung `updated_at` cho member/invitation để dữ liệu cộng tác có mốc thay đổi rõ ràng.
- Bổ sung `trip_access_events` dành riêng cho người bị đổi quyền/thu hồi quyền; thiết bị online nhận thay đổi qua Realtime.
- Khi member bị thu hồi, RLS và mutation gate mất quyền ngay trên server; client đồng thời refetch danh sách chuyến và bundle.
- Realtime mở rộng cho `trip_members`, `trip_invitations`, `trip_participants` và access event.

## ✅ V0.6.0 — Mobile UX & PWA Stabilization

- Safe-area cho iPhone/Android và layout theo `visualViewport`.
- Dialog/form fullscreen trên mobile; nội dung cuộn riêng, footer lưu nằm trong vùng nhìn thấy khi bàn phím mở.
- Giữ tab, ngày, filter Finance và vị trí scroll theo user/chuyến/tab bằng `sessionStorage`.
- PWA install flow cho trình duyệt hỗ trợ; hướng dẫn cài thủ công trên Safari iOS.
- Service worker `tripflow-shell-v060`, update prompt có kiểm soát, không cache API/Auth riêng tư.
- Persistent Storage request để giảm nguy cơ trình duyệt dọn cache offline khi thiết bị thiếu bộ nhớ.
- Tối ưu render bằng `content-visibility` cho các khối nội dung dài.

## ✅ V0.7.0 — Backup, Recovery & Operations

- Backup snapshot cấp ứng dụng lưu server-side với checksum, kích thước và thời hạn retention.
- Backup chỉ Owner tạo/đọc; backup immutable và restore luôn tạo **chuyến đi mới**, không ghi đè dữ liệu đang dùng.
- Restore remap ID cho itinerary, budget, expense/refund, media và participant; baseline/revision được dựng lại từ snapshot.
- Thùng rác/tombstone cho trip và các dữ liệu nghiệp vụ đã soft-delete; khôi phục có kiểm tra dependency.
- Recovery policy mặc định: 30 ngày tombstone, 90 ngày backup; V0.7.0 chỉ đánh dấu thời hạn, **không tự purge production**.
- Operations health hiển thị số backup, tombstone, audit, mutation receipt; audit ghi nhận tạo/restore backup.
- Security headers bổ sung HSTS, COOP và tắt DNS prefetch; API Recovery kiểm tra Origin, Auth, quyền Owner và giới hạn payload.
- Backup trong app không thay thế backup/PITR độc lập của PostgreSQL/Supabase.

## ➡️ V0.8.0 — Trip Analytics & Post-Trip Report

Dashboard tổng kết chuyến, thống kê ngân sách/lịch trình, báo cáo sau chuyến và export nâng cao.

## V0.9.0 — Release Candidate & Hardening

Dừng mở rộng lớn; tập trung UAT, thiết bị thật, bảo mật, hiệu năng, mạng gián đoạn, migration và sửa lỗi.

## V1.0.0 — Stable Production Release

Bản ổn định chính thức với tài liệu vận hành, checklist release và tiêu chuẩn production.
