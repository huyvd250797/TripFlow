# Changelog

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
