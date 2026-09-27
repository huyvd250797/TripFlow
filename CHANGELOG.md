# Changelog

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
