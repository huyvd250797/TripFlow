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

## ➡️ V0.4.0 — Live Trip & Realtime

Phiên bản tiếp theo tập trung đưa TripFlow vào sử dụng trực tiếp trong chuyến đi: Current/Next/Late, check-in giao dịch, Realtime nhiều thiết bị, lịch sử trạng thái, cảnh báo trễ và kiểm thử cập nhật đồng thời.

Current/Next/Late, check-in giao dịch, Realtime nhiều thiết bị, lịch sử trạng thái, cảnh báo trễ và kiểm thử cập nhật đồng thời.

## V0.5.0 — Collaboration & Permission Control

Hoàn thiện Owner/Editor/Viewer, participant tách account, thu hồi quyền tức thời và các luồng cộng tác nhóm.

## V0.6.0 — Mobile UX & PWA Stabilization

Tối ưu mobile, form fullscreen, bàn phím, scroll/filter state, Safari iOS/Chrome Android, service worker update và hiệu năng cảm nhận.

## V0.7.0 — Backup, Recovery & Operations

Backup/restore, tombstone, retention, recovery, security hardening, vận hành và giám sát production.

## V0.8.0 — Trip Analytics & Post-Trip Report

Dashboard tổng kết chuyến, thống kê ngân sách/lịch trình, báo cáo sau chuyến và export nâng cao.

## V0.9.0 — Release Candidate & Hardening

Dừng mở rộng lớn; tập trung UAT, thiết bị thật, bảo mật, hiệu năng, mạng gián đoạn, migration và sửa lỗi.

## V1.0.0 — Stable Production Release

Bản ổn định chính thức với tài liệu vận hành, checklist release và tiêu chuẩn production.
