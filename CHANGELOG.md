# Changelog

## 0.9.0 — Release Candidate & Hardening

- Thêm migration `202609280004_v090_release_candidate_hardening.sql` với schema marker và RPC `tf_release_readiness()`.
- Màn hình **Thêm → Kiểm tra sẵn sàng phát hành** xác minh database, RLS, idempotency, single-active guard và khả năng trình duyệt hiện tại.
- API private bổ sung `Cache-Control: no-store`, `Pragma`, `X-TripFlow-Version`, `X-Request-Id`; mutation kiểm tra same-origin, JSON content type và kích thước payload.
- Security headers bổ sung CSP, Cross-Origin-Resource-Policy và `X-Permitted-Cross-Domain-Policies`.
- Service worker cache shell nâng lên `tripflow-shell-v090`.
- Bổ sung `docs/RELEASE-CHECKLIST.md` và quy trình upgrade/rollback RC.
- Roadmap đánh dấu V0.9.0 ✅; phiên bản tiếp theo là V1.0.0 Stable Production Release.


## 0.8.0 — Trip Analytics & Post-Trip Report

- Dashboard tổng kết mới trong **Thêm**, kèm thẻ tóm tắt trên Tổng quan.
- KPI lịch trình: hoàn thành/bỏ qua/đang xử lý, tỷ lệ completion, số check-in, độ trễ trung bình/lớn nhất và thời lượng kế hoạch/thực tế.
- KPI tài chính: dự toán gốc/hiện tại, thực chi ròng, mức sử dụng ngân sách, chênh lệch, chi phí/người, nhóm chi nhiều nhất và số nhóm vượt dự toán.
- Tổng kết theo ngày kết hợp hoạt động + thực chi; thống kê media/tài liệu và mức gắn với activity.
- Post-trip readiness cảnh báo chuyến chưa kết thúc, activity còn mở, thiếu baseline, integrity warning và thực chi chưa liên kết.
- Export mới: CSV tổng kết, JSON báo cáo và bản in HTML tự chứa.
- Analytics được tính từ dữ liệu nguồn, không lưu tổng độc lập và không cần migration database mới.
- Service worker cache shell nâng lên `tripflow-shell-v080`.
- Roadmap đánh dấu V0.8.0 ✅; phiên bản tiếp theo là V0.9.0 Release Candidate & Hardening.

## 0.7.0 — Backup, Recovery & Operations

- Backup snapshot server-side cho từng chuyến, checksum MD5 để phát hiện payload bị thay đổi, metadata kích thước/thời hạn.
- Backup immutable; Owner có thể tải JSON recovery package hoặc restore thành một chuyến đi mới, không overwrite source.
- Restore remap quan hệ item → budget → expense/refund → media, giữ participant và budget snapshots.
- Thùng rác cho trip/item/budget/expense/media/participant và RPC khôi phục có kiểm tra dependency.
- Retention policy + operations health; không tự purge dữ liệu production ở V0.7.0.
- API `/api/recovery` có Auth, Origin check, validation và lỗi migration V0.7.0 rõ ràng.
- Security headers bổ sung HSTS, Cross-Origin-Opener-Policy và tắt DNS prefetch.
- Roadmap đánh dấu V0.7.0 ✅; phiên bản tiếp theo là V0.8.0 Trip Analytics & Post-Trip Report.
- Migration mới `202609280003_v070_backup_recovery_operations.sql`.

## 0.6.0 — Mobile UX & PWA Stabilization

- Mobile safe-area cho iPhone/Android; topbar, bottom nav, auth và footer tôn trọng vùng hệ thống.
- Dialog/editor fullscreen trên mobile và dùng `visualViewport` để footer thao tác không bị bàn phím che.
- Ghi nhớ tab/filter/scroll theo chuyến trong phiên trình duyệt.
- PWA install/update lifecycle: prompt cài, hướng dẫn Safari iOS, worker update có nút xác nhận và cache shell `v060`.
- Bổ sung yêu cầu Persistent Storage cho cache offline khi trình duyệt hỗ trợ.
- Giữ hotfix policy Collaboration V0.5.0 trong migration riêng và phân biệt lỗi thiếu migration với lỗi policy.
- Roadmap đánh dấu V0.6.0 ✅; phiên bản tiếp theo là V0.7.0 Backup, Recovery & Operations.

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
