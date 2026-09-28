# Changelog

## 0.5.0 — Collaboration & Permission Control

- UI cộng tác mới hiển thị quyền hiện tại, số account có quyền, lời mời đang chờ và số participant thực tế.
- Ma trận Owner/Editor/Viewer hiển thị trực tiếp trong màn hình Chia sẻ & phân quyền.
- Chặn lời mời trùng còn hiệu lực và chặn mời owner/member đã có quyền.
- Thêm `updated_at` cho `trip_members` và `trip_invitations`.
- Thêm `trip_access_events` + trigger phát sự kiện granted/role_changed/revoked cho đúng tài khoản bị tác động.
- Realtime mở rộng cho members, invitations, participants và access events; khi quyền thay đổi client refetch trip list/bundle ngay.
- Server RLS/mutation tiếp tục là nguồn quyết định quyền; thiết bị offline chỉ có cache cũ cho đến khi kết nối lại.
- Roadmap đánh dấu V0.5.0 ✅; phiên bản tiếp theo là V0.6.0 Mobile UX & PWA Stabilization.
- Migration mới `202609280001_v050_collaboration_permission_control.sql`.

## 0.4.0 — Live Trip & Realtime

- Live dashboard mới với Current / Next / Late và thời gian còn lại/độ trễ.
- Lịch sử trạng thái `itinerary_events` bất biến cho check-in, complete, skip, reset và auto-complete.
- Status mutation V0.4 vẫn dùng transaction/lock/idempotency cũ và ghi history trong cùng transaction.
- Realtime nhiều thiết bị cho trip, itinerary, live history và expenses; refetch 30 giây vẫn là fallback.
- Hiển thị trạng thái Realtime/Offline ngay trên Live Trip panel.
- Cảnh báo activity active quá giờ và các activity planned đã qua giờ chưa xử lý.
- Roadmap đánh dấu V0.4.0 ✅; phiên bản tiếp theo là V0.5.0 Collaboration & Permission Control.
- Migration mới `202609270003_v040_live_trip_realtime.sql`.

## 0.3.0 — Finance & Reporting Integrity

- Baseline dự toán gốc bất biến; các lần chốt sau được đánh số revision.
- Snapshot lưu metadata `snapshot_no`, `snapshot_kind`, `total_amount`, `item_count`.
- RPC `tf_finance_report` tổng hợp số liệu chuẩn từ database theo nhóm/ngày/hoạt động.
- Đối chiếu dự toán gốc, dự toán hiện tại, tổng chi, hoàn tiền, thực chi ròng và chênh lệch.
- Integrity checks cho refund, liên kết budget/activity và snapshot consistency.
- Tab **Báo cáo** mới trong Chi phí, kèm trạng thái integrity và KPI.
- Export CSV và JSON tài chính nâng cấp.
- Roadmap trong app đánh dấu V0.3.0 ✅; phiên bản tiếp theo là V0.4.0 Live Trip & Realtime.
- Migration mới `202609270002_v030_finance_reporting_integrity.sql`.

## 0.2.0 — Offline, Data Reliability & Master Administration

- IndexedDB cache theo user và queue mutation offline.
- Trạng thái sync: pending, sending, conflict, rejected; tự sync khi mạng trở lại.
- Service worker cho app shell; không cache API/private auth routes.
- Stable ID cho create mutation offline và giữ `operationId` để retry idempotent.
- Account gate + RLS/mutation gate cho tài khoản bị hủy kích hoạt.
- Master dashboard: danh sách user, search, user detail, trip detail, deactivate/reactivate, admin audit.
- Master không được tự deactivate và không deactivate Master khác qua UI/RPC.
- Roadmap hiển thị trong app: V0.1.0 ✅, V0.2.0 ✅; tiếp theo V0.3.0 Finance & Reporting Integrity.
- Migration mới `202609270001_v020_offline_master_admin.sql`.
