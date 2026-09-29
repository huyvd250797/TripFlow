# Changelog

## 1.8.0 — Map, Places & Route Intelligence

- Thêm chế độ **Bản đồ** bên cạnh Timeline/Board; chọn ngày, xem điểm dừng, mở từng địa điểm hoặc toàn tuyến trên Google Maps.
- Phân tích tọa độ từ các URL Google Maps phổ biến; ước tính quãng đường đường bộ, thời gian di chuyển và cảnh báo khi khoảng trống giữa hai hoạt động quá ngắn.
- Map view vẫn hoạt động theo tên địa điểm khi chưa có tọa độ; phần ước tính được ghi rõ là tham khảo, không thay thế route thực tế từ Google Maps.
- Fix PWA taskbar bằng cách cố định app viewport và chuyển scrolling vào `.app-body`, giữ thanh điều hướng ở một độ cao vật lý thay vì bị kéo lên khi scroll/iOS visual viewport thay đổi.
- Nút ⚡ Quick bỏ gesture kéo; thêm dấu × nhỏ để ẩn. Sau khi ẩn mới hiện mũi tên mở lại.
- Bỏ card Command Center khỏi Tổng quan vì đã có nút ⚡ toàn app.
- Thêm motion cơ bản chuyên nghiệp cho page/card/button/dialog và tôn trọng `prefers-reduced-motion`.
- App version `1.8.0`, service worker `tripflow-shell-v180`, Database yêu cầu vẫn `1.4.0`; không có migration mới.
- Phiên bản tiếp theo: V1.9.0 – Expense Intelligence & Travel Wallet.

## 1.7.0 — Planning Board & Timeline Pro

- Lịch trình có hai chế độ Timeline/Planning Board; Board nhóm activity theo ngày và hỗ trợ kéo thả đổi ngày trên desktop.
- Mobile/desktop đều có đổi ngày trực tiếp và chỉnh giờ nhanh ±30 phút mà không cần mở modal.
- Fix header tab Thực chi trên mobile để nút Ghi chi tiêu thẳng hàng, không ép tiêu đề rớt dòng; giữ trải nghiệm nhất quán với tab Dự toán.
- Nút ⚡ Quick chuyển sang thao tác kéo sang phải để ẩn; mũi tên chỉ xuất hiện khi icon đã ẩn và bấm mũi tên sẽ trượt icon ra lại.
- App version `1.7.0`, service worker `tripflow-shell-v170`, Database yêu cầu vẫn `1.4.0`; không có migration mới.
- Phiên bản tiếp theo: V1.8.0 – Map, Places & Route Intelligence.

## 1.6.0 — Smart Defaults & Context Automation

- Smart Defaults tự gợi ý người trả, nhóm chi, budget, ngày chi, giờ hoạt động và địa điểm từ dữ liệu/context hiện tại.
- Quick Entry hiển thị cảnh báo vượt dự toán, khoản chi bất thường, trùng giờ hoặc nằm ngoài phạm vi chuyến trước khi lưu.
- Bottom taskbar trong PWA standalone được neo cố định sát đáy, tôn trọng safe-area và chống dịch chuyển khi scroll.
- Nút ⚡ Quick chuyển thành dock có thể thu sang mép phải, giữ lại mũi tên để mở lại; trạng thái được nhớ theo user.
- Mục Thêm được gom thành Module Hub theo block đóng/mở để giảm mật độ thông tin.
- App version `1.6.0`, service worker `tripflow-shell-v160`, Database yêu cầu vẫn `1.4.0`; không có migration mới.
- Phiên bản tiếp theo: V1.7.0 – Planning Board & Timeline Pro.

## 1.5.1 — Deploy Typecheck Fix

- Sửa lỗi `TS18048: data is possibly undefined` ở thao tác **Lặp khoản chi gần nhất** bằng optional access trước khi đọc `expenses`.
- Sửa lỗi `TS2304: Cannot find name dateLabel` trong domain test bằng import đúng `dateLabel` từ `lib/domain`.
- Tăng App version lên `1.5.1` và service worker cache lên `tripflow-shell-v151`.
- Không có migration database; Database requirement vẫn là `1.4.0`.

## 1.5.0 — Quick Entry & Command Center

- Thay **Thao tác nhanh** bằng **Command Center** có Quick Entry một dòng; hỗ trợ nhập trực tiếp từ dashboard hoặc nút ⚡ nổi toàn app.
- Parser rule-based hiểu số tiền kiểu `350k`, `1tr2`, `1.250.000`, ngày `hôm nay/ngày mai/DD/MM` và giờ `7:30/14h`; không phụ thuộc AI.
- Tự phân loại nhanh khoản chi theo nội dung phổ biến (Di chuyển/Ăn uống/Lưu trú/Tham quan/Mua sắm), chỉ tự gắn budget theo ngữ cảnh khi category khớp để tránh liên kết sai.
- Preview trước khi lưu, **Lưu nhanh**, **Lưu & nhập tiếp** hoặc chuyển sang form đầy đủ; thao tác offline được đưa vào queue hiện có.
- Lưu tối đa 6 câu nhập gần đây theo user/chuyến trong localStorage và cho chọn lại bằng một chạm.
- Bổ sung **Lặp khoản chi gần nhất** ở Command Center và shortcut `Ctrl/Cmd + K`; `/` tiếp tục mở tìm kiếm xuyên chuyến đi.
- Floating Quick button được đặt trên desktop/mobile, tránh làm dày dashboard.
- Service worker nâng cache shell lên `tripflow-shell-v150`.
- Không có migration database mới; App V1.5.0 tiếp tục dùng Database V1.4.0.
- Roadmap đổi hướng sang nhập nhanh/thông minh: tiếp theo **V1.6.0 – Smart Defaults & Context Automation**.

## 1.4.0 — Smart Planning Templates & Reuse

- Thêm Planning Templates cá nhân: lưu chuyến hiện tại làm mẫu, tạo chuyến mới và tự dời lịch theo ngày bắt đầu mới.
- Tái sử dụng lịch trình, dự toán và người tham gia; không sao chép thực chi, media hay lịch sử vận hành.
- Ngày kết thúc chuyến và giờ kết thúc hoạt động không còn bắt buộc.
- Input tiền định dạng `xxx.xxx.xxx` ngay khi nhập.
- Dashboard chuyển Smart Workspace vào nút ⚡ để giảm mật độ thông tin; lịch sử lịch trình chuyển vào dialog riêng.
- Bổ sung nút **Ghi chi tiêu** trong tab Thực chi và nút ✓ lấy ngày/giờ hiện tại ở trường ngày giờ.
- Database nâng lên **V1.4.0** qua migration `202609290001_v140_smart_planning_templates_reuse.sql`.
- Roadmap đánh dấu V1.4.0 ✅; V1.5.0 được điều chỉnh thành **Quick Entry & Command Center** theo roadmap tối ưu thao tác.

## 1.3.0 — Media, Memories & Storytelling

- Nâng Media thành **Travel Journal** theo ngày, liên kết hoạt động và địa điểm.
- Bổ sung metadata `taken_on`, `is_highlight`, `is_cover`, `story_order`; mỗi chuyến chỉ có một cover đang hiệu lực.
- Thêm **Trip Highlights**, cover hero, caption/câu chuyện và thứ tự kể chuyện.
- Post-Trip Report/CSV/JSON bổ sung phần Memories & Storytelling.
- Media được đưa vào Supabase Realtime; backup/restore giữ nguyên metadata storytelling.
- Database nâng lên **V1.3.0** qua migration `202609280006_v130_media_memories_storytelling.sql`.
- Roadmap đánh dấu V1.3.0 ✅; tiếp theo **V1.4.0 – Smart Planning Templates & Reuse**.

## 1.2.0 — Smart Trip Workspace & Quick Actions

- Thêm **Smart Workspace** trên Tổng quan với quick add cho chi tiêu, hoạt động, media và hành động Live Trip theo Current/Next.
- Tìm kiếm xuyên chuyến đi cho lịch trình, chi tiêu, dự toán, media và người tham gia; so khớp không dấu tiếng Việt và điều hướng đúng module/ngày.
- Thêm nút search trên topbar và phím tắt `/` trên desktop; dialog tìm kiếm có gợi ý thao tác nhanh khi chưa nhập từ khóa.
- Quick Expense tự gắn budget của activity hiện tại/tiếp theo khi có thể; Quick Media tự gắn activity theo ngữ cảnh.
- Bổ sung responsive styles riêng cho workspace/search để không tái phát lỗi overflow mobile của V1.1.x.
- Service worker cache shell nâng lên `tripflow-shell-v120`.
- Không đổi schema database; App V1.2.0 tiếp tục dùng Database Stable V1.0.0.
- Roadmap đánh dấu V1.2.0 ✅; tiếp theo V1.3.0 – Media, Memories & Storytelling.

## 1.1.1 — Mobile Layout Fix

- Sửa lỗi CSS cascade của Brand Refresh làm `.app-body` vẫn giữ `margin-left: 248px` trên màn hình điện thoại, khiến toàn bộ nội dung bị ép sang phải và tiêu đề vỡ chữ.
- Re-assert mobile shell/topbar/main padding ở breakpoint `<= 760px`; giữ safe-area cho iPhone nhưng không cộng trùng khoảng đệm.
- Tối ưu page heading và trip selector ở màn hình nhỏ để không đẩy nút thao tác ra ngoài viewport.
- Thêm regression test kiểm tra `.app-body` phải bắt đầu từ mép trái và chiếm đủ chiều rộng viewport ở 320/390px.
- Bump PWA shell cache sang `tripflow-shell-v110-hotfix1` để thiết bị đã cài app nhận CSS mới.
- Không có migration database mới; app tăng PATCH lên V1.1.1, database vẫn giữ V1.0.0.


## 1.1.0 — Brand Refresh, Professional UI & Travel Identity

- Thiết kế lại logo/app icon theo concept **Location Pin + Travel Route**, đồng bộ favicon/PWA icon 192/512.
- Làm mới hệ màu **Ocean Teal + Sunset**, typography, card, button, form, modal, navigation, Live Trip và dashboard để giao diện nhất quán/professional hơn.
- Splash loading ban đầu mới với logo, route animation và tagline `PLAN · GO · REMEMBER`; giữ thời gian tối thiểu ngắn để tránh flash trắng.
- Auth trở thành travel landing experience với nền gradient, waypoint visual và feature chips; mobile login giữ giao diện gọn.
- Bottom navigation mobile chuyển thành floating glass dock; sidebar/topbar desktop nâng cấp glass/surface/shadow.
- Service worker cache shell nâng lên `tripflow-shell-v110`.
- V1.1.0 **không đổi schema database**; app version 1.1.0 tiếp tục tương thích database Stable 1.0.0, release-readiness hiển thị riêng App/DB.
- Roadmap mở giai đoạn 1.x: V1.1.0 ✅, tiếp theo V1.2.0 Smart Trip Workspace & Quick Actions, sau đó V1.3–V1.5.

## 1.0.0 — Stable Production Release

- Chốt kênh phát hành `stable`; app, API và database marker cùng xác minh phiên bản `1.0.0`.
- Thêm migration `202609280005_v100_stable_production_release.sql`; database V0.9.0 sẽ bị nhận diện rõ là chưa đủ cho source V1.0.0.
- Màn hình Release Candidate chuyển thành **Trạng thái Production** và chỉ báo sẵn sàng khi app/database/channel khớp V1.0.0.
- Roadmap 1.0 được đóng hoàn toàn: V0.1.0 → V1.0.0 đều ✅; không tự bịa phiên bản tiếp theo khi chưa chốt phạm vi mới.
- Service worker cache shell nâng lên `tripflow-shell-v100`.
- Bổ sung `docs/UPGRADE-V1.0.0.md` và `docs/PRODUCTION-RUNBOOK.md`; checklist được cập nhật cho phát hành Stable.
- Không thêm nghiệp vụ mới và không thay đổi dữ liệu chuyến đi ở V1.0.0; mục tiêu là phát hành ổn định, vận hành và khả năng rollback có kiểm soát.

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
