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

## ✅ V0.8.0 — Trip Analytics & Post-Trip Report

- Dashboard tổng kết chuyến đi từ dữ liệu nguồn hiện tại, không lưu thêm bảng tổng độc lập.
- KPI lịch trình: completion/processed, check-in, độ trễ và thời lượng.
- KPI tài chính: budget usage, per-person, variance, khoản ngoài dự toán, nhóm chi lớn nhất và nhóm vượt dự toán.
- Tổng kết theo ngày kết hợp số hoạt động/hoàn thành/bỏ qua với thực chi.
- Media summary và cảnh báo readiness trước khi coi báo cáo là hoàn chỉnh.
- Export CSV/JSON và bản in HTML cho báo cáo sau chuyến.
- Không có migration database mới ở V0.8.0.

## ✅ V0.9.0 — Release Candidate & Hardening

- Release readiness xác minh migration/RLS/các guard dữ liệu quan trọng ngay trong app.
- Marker database V0.9.0 giúp phân biệt rõ source mới nhưng database chưa nâng cấp.
- Hardening HTTP/API: same-origin, JSON content type, payload limits, no-store và request-id.
- Security headers bổ sung CSP, CORP và cross-domain policy.
- UAT checklist cho permission, offline, realtime, backup/restore và responsive trước V1.0.0.

## ✅ V1.0.0 — Stable Production Release

- Chốt channel `stable` và marker database V1.0.0.
- Production-readiness yêu cầu source/database/channel khớp V1.0.0 và các guard quan trọng đều đạt.
- Hoàn thiện checklist, runbook deploy/smoke-test/rollback và tài liệu vận hành.
- Không thêm nghiệp vụ lớn ở bản chốt; ưu tiên ổn định, khả năng phục hồi và tính nhất quán.

## ✅ V1.1.0 — Brand Refresh, Professional UI & Travel Identity

- Logo/app icon mới theo concept Location Pin + Travel Route.
- Splash loading, auth landing, desktop shell và mobile navigation được làm mới theo travel identity.
- Chuẩn hóa màu Ocean Teal + Sunset, typography, card, button, form, modal và trạng thái loading.
- Không đổi schema; database Stable V1.0.0 tiếp tục tương thích.

## ✅ V1.1.1 — Mobile Layout Fix

- Sửa CSS cascade làm app shell mobile bị ép sang phải sau Brand Refresh.
- Khóa lại topbar/main/bottom navigation và safe-area ở 320/390 px.
- Theo quy tắc SemVer, bản fix tăng PATCH thay vì giữ nguyên V1.1.0.

## ✅ V1.2.0 — Smart Trip Workspace & Quick Actions

- Smart Workspace trên Tổng quan với quick add chi tiêu/hoạt động/media và hành động Current/Next theo ngữ cảnh.
- Search xuyên lịch trình, chi phí, dự toán, media và người tham gia; hỗ trợ tiếng Việt không dấu.
- Shortcut `/` trên desktop, search topbar trên mobile/desktop và điều hướng đúng module/ngày.
- Giảm số bước thao tác; quick expense/media tự gắn activity/budget phù hợp khi có thể.

## ✅ V1.3.0 — Media, Memories & Storytelling

- Album theo ngày/hoạt động, cover chuyến đi, highlight và báo cáo chia sẻ đẹp hơn.

## ✅ V1.4.0 — Smart Planning Templates & Reuse

- Mẫu kế hoạch cá nhân từ chuyến hiện tại.
- Tạo chuyến mới từ mẫu, tự dời lịch theo ngày bắt đầu mới.
- Tái sử dụng dự toán và người tham gia; không sao chép dữ liệu thực tế của chuyến cũ.
- Ngày/giờ kết thúc tùy chọn, input tiền có phân cách hàng nghìn và UX dashboard/lịch trình gọn hơn.

## ✅ V1.5.0 — Quick Entry & Command Center

- Command Center toàn app với Quick Entry một dòng, parser tiền/ngày/giờ và preview trước khi lưu.
- Floating ⚡ button + `Ctrl/Cmd + K`; giữ Search `/`; recent command và lặp khoản chi gần nhất.
- Không đổi schema; App V1.5.0 dùng Database V1.4.0.

## ✅ V1.5.1 — Deploy Typecheck Fix

- Sửa `TS18048` khi `Bundle` chưa tải ở thao tác **Lặp khoản chi gần nhất**.
- Sửa `TS2304` trong `tests/domain.test.ts` bằng cách import `dateLabel` đúng từ domain.
- Không đổi schema; App V1.5.1 tiếp tục dùng Database V1.4.0.

## ⬜ V1.6.0 — Smart Defaults & Context Automation

- Tự điền người trả, category, activity, budget, ngày/giờ dựa trên context và lựa chọn gần nhất.
- Cảnh báo/xác nhận thông minh trước khi lưu để giảm nhập lặp và lỗi dữ liệu.

## ⬜ V1.7.0 — Planning Board & Timeline Pro

- Timeline kéo thả, vùng chưa xếp lịch, dời activity giữa ngày và giảm phụ thuộc modal.

## ⬜ V1.8.0 — Map, Places & Route Intelligence

- Map itinerary, khoảng cách/thời gian di chuyển và cảnh báo lịch trình phi thực tế.

## ⬜ V1.9.0 — Expense Intelligence & Travel Wallet

- Travel Wallet, favorite/recent expense, gợi ý category và cảnh báo tốc độ chi tiêu.

## ⬜ V2.0.0 — TripFlow Pro Travel Operating System

- Hợp nhất Planning + Live Trip + Map + Finance + Memories trong một travel workspace xuyên suốt.

**Roadmap hiện tại:** V1.5.1 đã hoàn thành; phiên bản tiếp theo là **V1.6.0 – Smart Defaults & Context Automation**.
