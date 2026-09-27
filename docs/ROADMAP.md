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

## ➡️ V0.3.0 — Finance & Reporting Integrity

Phiên bản tiếp theo tập trung đưa tài chính lên mức production: snapshot dự toán gốc bất biến, dự toán hiện hành, thực chi ròng, hoàn tiền, khoản ngoài dự toán, đối chiếu theo nhóm/ngày/hoạt động, báo cáo và kiểm thử tính đúng số liệu.

## V0.4.0 — Live Trip & Realtime

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
