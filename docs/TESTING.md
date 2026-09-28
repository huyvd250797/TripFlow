# Kiểm tra bản 0.8.0

## Bộ kiểm thử và phạm vi cần chạy

- Unit tests kiểm tra ngày/timezone, tổng dự toán/thực chi/hoàn tiền, điểm hiện tại, URL HTTPS và CSV.
- Integration PostgreSQL/PGlite kiểm tra RLS, quyền owner/editor/viewer, CRUD, invitation, refund, idempotency, stale version, snapshot, check-in và audit. V0.2 bổ sung kịch bản Master overview, deactivate/reactivate, RLS read bị chặn và `tf_mutate` từ chối tài khoản deactivated.
- Browser integration hiện có cho các luồng V0.1. V0.2 cần chạy thêm kiểm thử thủ công/automation cho IndexedDB queue, service worker và Master UI trên browser thật.
- PGlite/browser adapter không thay thế Supabase Auth/PostgREST/Realtime/Vercel thật; phải nghiệm thu staging trước production.

## Chạy lại kiểm tra nền tảng

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Test database dùng bộ nhớ, tự tạo người dùng giả, không truy cập project thật và không cần env. CI chạy bộ này cùng build.

## Chạy browser integration

Cài Chromium của Playwright:

```bash
npx playwright install chromium
```

Terminal 1 (macOS/Linux; Windows dùng cú pháp đặt biến tương ứng):

```bash
TRIPFLOW_UI_TEST=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test-anon-key npm run dev -- --port 3001
```

Đợi Next.js báo Ready. Terminal 2:

```bash
UI_BASE_URL=http://localhost:3001 npm run test:ui
```

Không cần Supabase chạy ở port 54321: đây là địa chỉ giả lập test. Không dùng cấu hình này để deploy. Có thể đặt `CHROMIUM_PATH` nếu đã có binary Chromium tương thích. Ảnh chụp lưu trong `test-results/` và không đóng gói vào source. Biến `TRIPFLOW_UI_TEST=1` dùng thư mục build `.next-ui` để không ảnh hưởng build chính.

## Checklist nghiệm thu trên staging thật

Dùng project staging và dữ liệu thử riêng:

- [ ] Đăng ký tài khoản A, xác nhận email trên cùng/khác thiết bị, đăng nhập; sai mật khẩu bị từ chối.
- [ ] Gửi quên mật khẩu, mở email, đổi mật khẩu, đăng xuất rồi đăng nhập bằng mật khẩu mới. Link dùng lại/hết hạn báo lỗi.
- [ ] A tạo chuyến, lịch trình và dự toán; reload vẫn còn; thiết bị thứ hai thấy cùng dữ liệu.
- [ ] A mời B editor và C viewer; D ngoài chuyến không đọc/ghi được. B sửa được chi phí; C chỉ xem. B/C không sửa lời mời hoặc xóa chuyến.
- [ ] Sai email, lời mời hết hạn/thu hồi/đã dùng bị chặn; thu hồi B thì API từ chối lần đọc/ghi tiếp theo. Dữ liệu đã đọc trước đó không thể thu hồi khỏi trí nhớ/ảnh chụp của người nhận.
- [ ] Dự toán 1.000.000; hai khoản chi 300.000 + 800.000 → vượt 100.000. Hoàn 100.000 → thực chi 1.000.000. Hoàn quá số tiền gốc bị chặn.
- [ ] Chốt dự toán, sửa ngân sách hiện hành, snapshot cũ giữ nguyên. Xuất CSV mở đúng dấu tiếng Việt.
- [ ] Hai thiết bị sửa cùng bản ghi: thao tác thứ hai với version cũ bị từ chối. Kiểm tra tổng không ghi đè âm thầm.
- [ ] Chuyển active giữa hai điểm: luôn còn đúng một điểm active; điểm cũ hoàn thành.
- [ ] Xóa dự toán giữ các khoản thực chi; xóa hoạt động giữ media; xóa chuyến làm biến mất ở mọi thành viên.
- [ ] Mở chuyến khi online → tắt mạng → thêm thực chi/check-in → queue hiện pending; reload vẫn giữ queue/cache; bật mạng → thao tác sync đúng một lần.
- [ ] Tạo conflict bằng cách đổi cùng bản ghi trên thiết bị khác trước khi queue sync: queue chuyển `conflict`, server không ghi đè dữ liệu mới.
- [ ] Lỗi quyền/nghiệp vụ khi sync chuyển `rejected` và vẫn hiển thị nguyên nhân.
- [ ] Master tìm user, xem user/trip detail, deactivate/reactivate; Master không tự deactivate và không deactivate Master khác.
- [ ] User deactivated: login account gate đăng xuất; API/RLS/RPC không cho đọc/ghi. Khi thiết bị đang hoàn toàn offline, kiểm tra thông báo/giới hạn cache theo chính sách đã nêu.
- [ ] Album Drive mở ở tab/trang nguồn; không có upload file vào Supabase Storage.
- [ ] Kiểm tra iPhone Safari, Android Chrome, bàn phím form, vùng safe-area, GPS quyền từ chối/cho phép, thao tác back/foreground.
- [ ] Kiểm tra logs, quota, backup và thử restore trước khi cho nhiều người dùng.

## Finance V0.3.0

- Chốt lần đầu phải tạo snapshot `baseline`, `snapshot_no = 1`; lần chốt sau là `revision`.
- Không UPDATE được snapshot đã chốt (`SNAPSHOT_IMMUTABLE`).
- `tf_finance_report` phải khớp dự toán hiện tại, baseline, tổng chi, refund và thực chi ròng.
- Kiểm tra báo cáo theo nhóm/ngày/hoạt động và khoản ngoài dự toán.
- Data Integrity phải cảnh báo khi chưa có baseline và phát hiện dữ liệu refund/link/snapshot không nhất quán.
- Export CSV phải tiếp tục chống formula injection; export JSON phải chứa report và dữ liệu nguồn.


## Live Trip & Realtime V0.4.0

- [ ] Chạy migration V0.4.0 sau V0.3.0; API bundle trả `live_events`.
- [ ] Hai thiết bị cùng mở một chuyến: thiết bị B nhận cập nhật sau khi A check-in mà không cần reload thủ công.
- [ ] Nếu Realtime bị ngắt, badge chuyển trạng thái phù hợp và refetch 30 giây vẫn cập nhật dữ liệu.
- [ ] Hai thiết bị đồng thời check-in hai activity khác nhau: transaction chỉ để lại đúng một activity `active`; request stale/không khớp nhận conflict.
- [ ] Check-in tạo event `check_in`; chuyển sang activity khác tạo thêm `auto_complete` cho activity cũ.
- [ ] Retry cùng `operationId` không tạo history trùng.
- [ ] Hoàn thành, bỏ qua, đặt lại tạo event tương ứng và hiển thị đúng theo timezone chuyến đi.
- [ ] Activity `active` quá `end_at` hiển thị số phút/giờ trễ; activity planned đã qua giờ xuất hiện trong LATE.
- [ ] Offline check-in đi vào queue; khi có mạng, mutation sync một lần và history được tạo sau khi server xác nhận.


## Collaboration & Permission Control V0.5.0

- [ ] Owner thấy ma trận Owner/Editor/Viewer và số account/participant/lời mời đang chờ.
- [ ] Không thể tạo hai lời mời pending cho cùng email trong một chuyến.
- [ ] Không thể mời lại owner hoặc member đã có quyền.
- [ ] Đổi Editor ↔ Viewer phát `trip_access_events` và thiết bị bị tác động refetch quyền qua Realtime.
- [ ] Thu hồi member làm RLS/API mất quyền ngay; thiết bị online xóa cache bundle của chuyến sau access-event.
- [ ] Mutation offline tạo trước khi bị thu hồi bị server từ chối khi sync sau đó.

## Mobile UX & PWA Stabilization V0.6.0

- Kiểm tra viewport 320, 390, 430, 768 và desktop; không có horizontal overflow ngoài table/permission matrix được thiết kế scroll ngang.
- iPhone Safari: topbar tôn trọng safe-area phía trên, bottom nav tôn trọng home indicator.
- Mở mọi form editor trên mobile: dialog chiếm toàn visual viewport; body form cuộn riêng; nút Hủy/Lưu luôn thao tác được khi bàn phím mở.
- Chuyển tab sau khi đã cuộn, quay lại tab cũ và xác nhận vị trí scroll được phục hồi trong cùng session.
- Chọn ngày lịch trình / category / tab Finance, chuyển màn hình rồi quay lại và xác nhận state được giữ.
- PWA Chrome/Edge Android: `beforeinstallprompt` làm xuất hiện nút Cài TripFlow; sau `appinstalled` trạng thái hiển thị Đã cài.
- Safari iOS: không phụ thuộc `beforeinstallprompt`; giao diện hướng dẫn Chia sẻ → Thêm vào Màn hình chính.
- Deploy worker mới: worker cũ tiếp tục điều khiển phiên hiện tại, app hiện Cập nhật TripFlow; chỉ `SKIP_WAITING` sau khi người dùng bấm nút rồi reload qua `controllerchange`.
- Cache Storage không chứa `/api/*` hoặc `/auth/*`; dữ liệu riêng tư offline nằm trong IndexedDB theo user.
- Persistent Storage API: nếu browser từ chối thì app vẫn hoạt động, chỉ hiển thị cache ở chế độ tiêu chuẩn.


## Backup, Recovery & Operations V0.7.0

- [ ] Chạy migration `202609280003_v070_backup_recovery_operations.sql` trên staging.
- [ ] Owner tạo backup; danh sách hiển thị checksum, kích thước, ngày tạo.
- [ ] Tải recovery JSON và xác nhận package có `format=tripflow-recovery-backup`.
- [ ] Restore backup tạo trip ID mới, source trip không thay đổi.
- [ ] Item/budget/expense/refund/media được remap đúng quan hệ trong trip restore.
- [ ] Xóa một item/participant test rồi khôi phục từ thùng rác.
- [ ] Refund có payment gốc đang xóa phải bị chặn restore với lỗi dependency.
- [ ] Editor/Viewer không tạo/tải/restore backup của Owner.
- [ ] Xóa một trip thử nghiệm; khi không còn trip active vẫn vào **Thêm** và khôi phục được deleted trip.
- [ ] Operations health cập nhật backup/tombstone/audit/receipt.
- [ ] V0.7 không tự purge sau retention; production vẫn có PostgreSQL backup/PITR riêng.

## Trip Analytics & Post-Trip Report V0.8.0

- [ ] Dashboard analytics hiển thị trên **Thêm** và thẻ tóm tắt hiển thị trên Tổng quan.
- [ ] Completion rate dùng số `done / total`, processed rate dùng `(done + skipped) / total`.
- [ ] Check-in delay chỉ tính độ trễ dương so với `start_at`.
- [ ] Tổng kết theo ngày ghép đúng activity theo timezone chuyến và expense theo `spent_on`.
- [ ] Chi phí/người không chia cho 0 nếu dữ liệu cũ có `people=0`.
- [ ] Readiness cảnh báo đúng khi trip chưa completed, còn activity mở, thiếu baseline, integrity warning hoặc có unlinked actual.
- [ ] CSV/JSON/HTML export tải được; CSV chống formula injection và HTML escape nội dung người dùng.
- [ ] V0.8.0 không yêu cầu migration mới; database V0.7.0 hoạt động trực tiếp.
