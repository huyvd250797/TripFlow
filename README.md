# TripFlow 1.5.1 · Quick Entry & Command Center — Deploy Typecheck Fix

Web app quản lý chuyến đi, viết mới từ kế hoạch TripFlow, ưu tiên điện thoại. Giao diện tiếng Việt, tiền VNĐ, ngày DD/MM/YYYY. Frontend và backend triển khai chung trên Vercel; dữ liệu và tài khoản dùng Supabase.

**Bắt đầu:** giải nén → chạy migration theo thứ tự → cấu hình Supabase/Vercel → tạo tài khoản → nếu cần thì nâng một tài khoản thành Master bằng SQL tin cậy → kiểm thử tài chính, online/offline và phân quyền.

ZIP chứa mã nguồn. Vercel không tự tạo database từ ZIP; cần hoàn thành cấu hình dưới đây. Không cần máy chủ backend riêng. Không có dữ liệu mẫu hoặc tài khoản mặc định trong bản chạy thật.

## Đã có trong phiên bản này

- **Quick Entry V1.5.0:** Command Center một dòng cho chi tiêu/lịch trình, hiểu `350k`, `1tr2`, `DD/MM`, `7:30`, `14h`, có preview, lưu nhanh/lưu & nhập tiếp và lịch sử câu nhập gần đây.
- **Command Center V1.5.0:** nút ⚡ nổi toàn app + `Ctrl/Cmd + K`, tìm kiếm, action theo Current/Next, lặp khoản chi gần nhất; dashboard chỉ giữ một nút gọn thay vì bung nhiều shortcut.
- **Smart Workspace V1.2.0:** tìm kiếm xuyên lịch trình/chi phí/dự toán/media/người tham gia, quick action theo Current/Next và shortcut thêm chi phí/hoạt động/media ngay trên Tổng quan.
- **Smart Planning V1.4.0:** lưu chuyến hiện tại thành mẫu cá nhân và tạo chuyến mới từ mẫu; lịch trình tự dời theo ngày bắt đầu mới, tái sử dụng dự toán và người tham gia.
- **UX V1.4.0:** ngày/giờ kết thúc không còn bắt buộc; tiền nhập theo dạng `xxx.xxx.xxx`; thao tác nhanh chuyển vào nút ⚡; lịch sử lịch trình mở theo nút riêng; tab Thực chi có nút thêm nhất quán.
- **Memories V1.3.0:** Travel Journal theo ngày, Trip Highlights, cover chuyến đi, caption/story order và báo cáo storytelling sau chuyến.
- **Mobile Layout Fix V1.1.1:** khóa lại responsive shell sau Brand Refresh để không còn lỗi nội dung bị ép sang phải trên điện thoại.
- **Brand Refresh V1.1.0:** logo/app icon chủ đề du lịch mới, splash loading có thương hiệu, hệ màu Ocean Teal + Sunset, shell/app navigation chuyên nghiệp hơn, auth/travel landing và card/form/modal được chuẩn hóa lại.
- **V1.4.0 có migration database:** chạy `202609290001_v140_smart_planning_templates_reuse.sql` để thêm Planning Templates, cho phép ngày/giờ kết thúc để trống và nâng Database Version lên 1.4.0. V1.3.0 vẫn phải được chạy trước đó nếu database chưa có.

- Đăng ký, xác nhận email, đăng nhập, quên/đổi mật khẩu, đăng xuất.
- Nhiều chuyến đi: ngày, múi giờ, số người, trạng thái, ghi chú.
- Lịch trình theo ngày; thêm/sửa/xóa/sao chép hoạt động; roadmap, đánh dấu đã đến, hoàn thành, bỏ qua. Chỉ một hoạt động được check-in tại một thời điểm.
- Điểm hiện tại theo lịch, điểm đã check-in, hoạt động quá giờ chưa cập nhật; mở Google Maps/GPS khi người dùng yêu cầu.
- Dự toán theo khoản và nhóm, số lượng × đơn giá; chốt bản dự toán gốc.
- Ghi thực chi, người trả, ngày chi, link chứng từ; liên kết dự toán, chi ngoài kế hoạch và hoàn tiền.
- **Finance V0.3.0:** lần chốt đầu tiên là baseline dự toán gốc bất biến; các lần sau là revision có số thứ tự. Đối chiếu dự toán gốc / hiện tại / tổng chi / hoàn tiền / thực chi ròng / chênh lệch.
- **Live Trip V0.4.0:** Current / Next / Late, cảnh báo trễ, check-in giao dịch, lịch sử trạng thái bất biến và Realtime nhiều thiết bị với refetch fallback.
- **Collaboration V0.5.0:** ma trận Owner/Editor/Viewer, lời mời chống trùng, chặn mời tài khoản đã có quyền, Realtime member/invitation/participant và access-event để phản ánh đổi/thu hồi quyền nhanh trên thiết bị online.
- **Backup, Recovery & Operations V0.7.0:** backup snapshot server-side có checksum, tải recovery JSON, restore thành chuyến mới, thùng rác/tombstone, retention policy và operations health.
- **Trip Analytics & Post-Trip Report V0.8.0:** dashboard tổng kết lịch trình/tài chính/media, KPI theo ngày, độ trễ check-in, cảnh báo cần rà soát và export CSV/JSON/bản in HTML.
- **Stable Production V1.0.0:** production-readiness trong app, schema marker V1.0.0, kiểm tra RLS/guard dữ liệu, hardening API/HTTP, runbook và checklist vận hành production.
- **Mobile UX & PWA V0.6.0:** safe-area iPhone/Android, dialog/form fullscreen theo `visualViewport`, giữ tab/filter/scroll, cài/cập nhật PWA và cache offline bền vững khi trình duyệt hỗ trợ.
- Báo cáo tài chính theo nhóm, ngày và hoạt động; theo dõi khoản ngoài dự toán; tab Data Integrity phát hiện refund/link/snapshot không nhất quán.
- Export tài chính CSV và JSON; CSV chống formula injection.
- Gắn link Google Drive/HTTPS cho album, ảnh, video, tài liệu; liên kết với hoạt động. Media mở tại nguồn, không upload vào app.
- Danh sách người tham gia; mời tài khoản qua liên kết ràng buộc email, quyền chủ chuyến/chỉnh sửa/chỉ xem; thu hồi quyền.
- Nhật ký thay đổi, xuất dữ liệu chuyến đi JSON, phát hiện xung đột khi nhiều người sửa, chống ghi trùng khi thử lại.
- **Offline V0.2.0:** cache IndexedDB theo tài khoản; hàng đợi thao tác; tự đồng bộ khi mạng trở lại; trạng thái chờ/gửi/xung đột/bị từ chối; service worker cache app shell.
- **Master Administration:** Master xem danh sách user, dữ liệu/chuyến đi và audit; hủy kích hoạt hoặc kích hoạt lại tài khoản. User bị hủy kích hoạt không thể sử dụng app/API và bị đăng xuất khi account gate phát hiện trạng thái.
- Điều hướng dưới trên mobile, dialog co giãn, vùng an toàn màn hình; web manifest và icon để cài PWA.
- Roadmap phiên bản hiển thị ngay trong **Thêm → TripFlow roadmap**; V0.1.0 đến V1.5.1 (bao gồm V1.1.1 Mobile Layout Fix) đều được đánh dấu ✅. Phiên bản tiếp theo là V1.6.0 – Smart Defaults & Context Automation.

**Phạm vi offline:** cho phép thêm thực chi, thêm/cập nhật/check-in lịch trình, thêm/sửa người tham gia và media khi mất mạng. Phân quyền, lời mời, xóa chuyến, chốt dự toán và Master Admin yêu cầu online. Chưa có push notification, định vị nền, chia nợ hoặc đa tiền tệ.

## 1. Tạo database Supabase

1. Tạo một **project Supabase mới, trống**. Giữ mật khẩu database ở nơi riêng; không ghi vào source.
2. Mở **SQL Editor** và chạy migration **đúng thứ tự**:
   - `supabase/migrations/202609250001_tripflow.sql` — nền V0.1.0.
   - `supabase/migrations/202609270001_v020_offline_master_admin.sql` — nâng cấp V0.2.0.
   - `supabase/migrations/202609270002_v030_finance_reporting_integrity.sql` — nâng cấp V0.3.0.
   - `supabase/migrations/202609270003_v040_live_trip_realtime.sql` — nâng cấp V0.4.0.
   - `supabase/migrations/202609280001_v050_collaboration_permission_control.sql` — nâng cấp V0.5.0.
   - `supabase/migrations/202609280002_v050_collaboration_access_policy_fix.sql` — hotfix policy V0.5.0, được giữ lại trong source V0.6.0 cho database mới/cũ chưa áp dụng hotfix.
   - `supabase/migrations/202609280003_v070_backup_recovery_operations.sql` — Backup, Recovery & Operations V0.7.0.
   - `supabase/migrations/202609280004_v090_release_candidate_hardening.sql` — Release Candidate marker + release-readiness V0.9.0.
   - `supabase/migrations/202609280005_v100_stable_production_release.sql` — Stable Production marker + production-readiness V1.0.0.
   - `supabase/migrations/202609280006_v130_media_memories_storytelling.sql` — metadata Media/Storytelling + Realtime/restore compatibility + Database marker V1.3.0.
   - `supabase/migrations/202609290001_v140_smart_planning_templates_reuse.sql` — Planning Templates/Reuse + optional end date/time + Database marker V1.4.0.
   **V0.6.0, V0.8.0, V1.1.x, V1.2.0 và V1.5.0 không có migration database. V1.3.0 và V1.4.0 có migration.** Nếu database đang ở V1.3.0, chỉ chạy migration V1.4.0 mới rồi deploy source. Nếu đang ở phiên bản cũ hơn, chạy các migration còn thiếu theo đúng thứ tự; không chạy lại migration đầu. Mỗi migration có transaction; nếu công cụ giữ phiên SQL sau lỗi, chạy `ROLLBACK;` trước khi thử lại.
3. V0.4.0 thêm `itinerary_events`; V0.5.0 thêm `trip_access_events`, bảo vệ lời mời trùng và mở rộng Realtime cho cộng tác. Schema `private` tiếp tục giữ dữ liệu/hàm nội bộ.
4. Lấy **Project URL** và **Publishable key** từ trang API/Connect của project. Legacy `anon` key cũng dùng được. **Không dùng `service_role` hoặc secret key.**
5. Giữ RLS bật. Không mở schema `private` trong Data API. Không cấp quyền ghi trực tiếp cho bảng; mutation chạy qua hàm `tf_mutate` đã kiểm tra người dùng/quyền.
6. Auth: bật đăng nhập Email/Password và **Confirm email**. Đặt mật khẩu tối thiểu 8 ký tự. Cấu hình SMTP của bạn cho email dùng thật; kiểm tra giới hạn gửi của dịch vụ trước khi mời nhóm sử dụng.

Migration này dành cho project mới; không chạy vào database có ứng dụng khác vì có lệnh thu hồi quyền các bảng public. Các lần nâng cấp sau phải thêm migration mới, không sửa/chạy lại migration đầu trên production.


## 1.1. Tạo tài khoản Master

TripFlow **không tự phong Master từ frontend**. Cách này tránh việc user thường tự nâng quyền. Sau khi đăng ký và xác nhận email của tài khoản sẽ dùng làm Master, chạy trong Supabase SQL Editor:

```sql
select id, email from auth.users order by created_at;

insert into public.tf_user_accounts(user_id, role, status)
select id, 'master', 'active'
from auth.users
where lower(email) = lower('master@example.com')
on conflict (user_id) do update
set role = 'master', status = 'active', deactivated_at = null,
    deactivated_by = null, updated_at = now();
```

Thay `master@example.com` bằng email thật. Chỉ nên có tài khoản Master theo chính sách vận hành của bạn. Master mở **Quản trị Master** từ sidebar desktop hoặc **Thêm → Quản trị Master** trên mobile.

Khi Master hủy kích hoạt user, account gate, RLS và RPC mutation đều chặn quyền. Supabase Auth có thể xác thực credential trong tích tắc trước khi app kiểm tra trạng thái; TripFlow sau đó đăng xuất user và hiển thị thông báo bị hủy kích hoạt. Không cần đưa `service_role` xuống frontend.

## 1.2. Cơ chế offline V0.2.0

- Cache read nằm trong IndexedDB `tripflow-v020`, phân vùng theo `userId`.
- API private không được service worker cache.
- Mutation offline giữ nguyên `operationId`; server `mutation_receipts` chống gửi trùng.
- Khi sync, server kiểm tra lại version và quyền hiện tại. Conflict trả 409 và hàng đợi giữ trạng thái để người dùng xử lý, không ghi đè im lặng.
- Đăng xuất khi không còn thao tác chờ sẽ xóa cache local của user. Nếu còn hàng đợi chưa gửi, app cảnh báo và giữ queue để tránh mất dữ liệu; queue chỉ được đọc/gửi lại khi đúng user đăng nhập.

## 1.3. Finance & Reporting Integrity V0.3.0

- Lần chốt ngân sách đầu tiên tự động là `baseline`; các lần sau là `revision`.
- Snapshot được gắn `snapshot_no`, `snapshot_kind`, `total_amount`, `item_count` và bị chặn UPDATE trực tiếp để giữ lịch sử.
- `tf_finance_report(trip_id)` là nguồn tổng hợp chuẩn phía server cho báo cáo: dự toán gốc, hiện tại, tổng chi, hoàn tiền, thực chi ròng, khoản ngoài dự toán, chênh lệch.
- Báo cáo phân rã theo **nhóm / ngày / hoạt động** và trả về trạng thái **Data Integrity**.
- Integrity kiểm tra các bất thường: hoàn tiền vượt giao dịch gốc, refund sai liên kết, thực chi liên kết budget không hợp lệ/sai nhóm, budget còn gắn activity đã xóa, snapshot metadata lệch payload.
- Nếu chưa chốt baseline, app vẫn tính số liệu hiện tại nhưng hiển thị cảnh báo `NO_BASELINE`.
- Snapshot, đổi quyền, xóa chuyến và Master Admin vẫn yêu cầu online; tạo thực chi offline tiếp tục dùng queue V0.2.0.

## 1.4. Live Trip & Realtime V0.4.0

- Live panel tách rõ **Current / Next / Late**; hiển thị thời gian còn lại đến chặng kế tiếp và số phút/giờ trễ.
- `itinerary_items` là trạng thái hiện tại; `itinerary_events` lưu history bất biến cho check-in, complete, skip, reset và auto-complete.
- Khi check-in chặng mới trong lúc đã có chặng active, transaction hoàn thành chặng cũ rồi kích hoạt chặng mới; unique index vẫn đảm bảo chỉ một active.
- Event history dùng cùng `operation_id` với mutation để retry/offline sync không tạo dòng trùng.
- Realtime subscribe `trips`, `itinerary_items`, `itinerary_events`, `expenses`; app vẫn refetch 30 giây khi Realtime chậm hoặc không khả dụng.
- Check-in timestamp lấy từ database `now()`, không lấy đồng hồ điện thoại làm nguồn sự thật. GPS chỉ mở khi người dùng yêu cầu và không tự xác nhận check-in.


## 1.6. Backup, Recovery & Operations V0.7.0

- **Thêm → Backup & Recovery** dành cho Owner: tạo snapshot, tải recovery JSON, restore thành chuyến mới và khôi phục dữ liệu soft-delete.
- `trip_backups` là snapshot bất biến có checksum; restore không overwrite source trip và không tự phục hồi members/invitations để tránh cấp quyền ngoài ý muốn.
- Tombstone có cửa sổ recovery mặc định 30 ngày; app backup 90 ngày. V0.7.0 không tự purge production.
- Operations health hiển thị số backup, tombstone, audit và mutation receipt.
- Backup ứng dụng không thay thế PostgreSQL/Supabase backup hoặc PITR độc lập.

## 1.5. Mobile UX & PWA Stabilization V0.6.0

- V0.6.0 không thêm bảng/RPC mới; nâng cấp chủ yếu ở frontend/PWA.
- Mobile dùng `env(safe-area-inset-*)` và `visualViewport` để tránh tai thỏ/Dynamic Island, thanh home và bàn phím phần mềm che nội dung.
- Dialog/form trên màn hình ≤760px mở fullscreen; body cuộn độc lập, footer hành động luôn nằm trong visual viewport.
- Tab, ngày, nhóm chi phí, tab Finance và vị trí cuộn được giữ trong `sessionStorage` theo user/chuyến/tab; reload hoặc quay lại màn hình không tự nhảy về đầu.
- Service worker V0.6.0 không cache API/Auth; cache shell được version hóa `tripflow-shell-v060`. Khi có worker mới, app hiển thị nút **Cập nhật TripFlow** thay vì tự thay giữa thao tác.
- Chrome/Edge Android có thể nhận prompt cài PWA; Safari iOS hiển thị hướng dẫn **Chia sẻ → Thêm vào Màn hình chính**.
- Nút **Bảo vệ cache offline** gọi Persistent Storage API khi trình duyệt hỗ trợ. Đây chỉ giúp giảm khả năng browser dọn cache; Supabase vẫn là nguồn dữ liệu chính thức.


## 1.7. Trip Analytics & Post-Trip Report V0.8.0

- **Thêm → Tổng kết chuyến đi** tổng hợp trực tiếp từ bundle hiện tại; không tạo thêm bảng tổng để tránh “hai nguồn sự thật”.
- KPI gồm tỷ lệ hoàn thành/bỏ qua, check-in trễ, thời lượng kế hoạch/thực tế, dự toán/thực chi/chênh lệch, chi phí bình quân người và media.
- Báo cáo theo ngày kết hợp số hoạt động và thực chi; báo cáo nhóm chi phí kế thừa nguồn số liệu Finance V0.3.0.
- Trạng thái **Báo cáo hoàn chỉnh** chỉ xuất hiện khi chuyến đã `completed` và không còn cảnh báo chính; khi đang đi, app hiển thị **Báo cáo tạm thời**.
- Export V0.8.0: CSV tổng kết, JSON đầy đủ và bản in HTML tự chứa. CSV tiếp tục trung hòa formula injection.
- V0.8.0 **không có migration database**. Nguồn dữ liệu vẫn là bảng/RPC hiện có; Analytics được tính lại khi mở hoặc export.


## 1.8. Release Candidate & Hardening V0.9.0

- Chạy migration `202609280004_v090_release_candidate_hardening.sql` trước khi deploy source V0.9.0.
- **Thêm → Kiểm tra sẵn sàng phát hành** gọi `tf_release_readiness()` để xác minh account gate, Finance, Live Trip, Collaboration, Backup/Recovery, idempotency, single-active guard và RLS.
- API mutation yêu cầu request same-origin, `application/json` và giới hạn payload; response private không cache và có request-id phục vụ truy vết lỗi.
- CSP/CORP và security headers được bật trong `next.config.ts`.
- Trước V1.0.0 phải chạy checklist tại `docs/RELEASE-CHECKLIST.md`, kiểm thử thiết bị thật và đóng lỗi Critical/High.


## 1.9. Stable Production Release V1.0.0

- Chạy `202609280005_v100_stable_production_release.sql` sau V0.9.0 trước khi deploy source V1.0.0.
- **Thêm → Trạng thái Production** chỉ báo sẵn sàng khi source, database marker và channel đều là `1.0.0 / stable`, đồng thời các guard server/client đều đạt.
- V1.0.0 không thêm bảng nghiệp vụ mới, không sửa dữ liệu chuyến đi và không thay đổi mô hình quyền; đây là bản đóng roadmap 1.0 để vận hành ổn định.
- Service worker dùng cache `tripflow-shell-v100`; API private tiếp tục `no-store`, same-origin/content-type/payload guard và request-id.
- Trước deploy production thực tế, hoàn tất `docs/RELEASE-CHECKLIST.md`; sau deploy dùng `docs/PRODUCTION-RUNBOOK.md` để smoke test, backup và rollback.
- Nếu source V1.0.0 chạy trên database V0.9.0, app sẽ báo rõ migration V1.0.0 còn thiếu thay vì coi RC là production-ready.


## 2. Deploy lên Vercel

### Cách A — GitHub → Vercel

1. Đưa **nội dung thư mục `tripflow-cloud`** vào repository mới của bạn; file `package.json` ở thư mục gốc repo. Đừng đưa `node_modules`, `.next`, `.env.local` vào Git.
2. Vercel → Add New Project → import repo. Framework: **Next.js**. Nếu repo chứa thư mục bao ngoài, chọn Root Directory là `tripflow-cloud`.
3. Node.js: **24.x**. Install Command: `npm ci`; Build Command: `npm run build`; Output Directory để mặc định Next.js.
4. Thêm hai biến cho môi trường Production:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

5. Deploy. Khi đổi hai biến trên phải redeploy vì Next.js đóng gói giá trị public vào frontend.
6. Ghi lại tên miền chính thức, rồi cấu hình Auth ở mục 3. Nếu chạy Preview để thử nghiệm, nên dùng Supabase staging riêng và cấu hình biến Preview riêng.

### Cách B — Deploy thư mục đã giải nén bằng CLI

Cần Node.js 24 và tài khoản Vercel:

```bash
cd tripflow-cloud
npm ci
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel --prod
```

CLI sẽ hỏi giá trị từng biến và project. Sau khi có URL, tiếp tục mục 3. Không cần chạy migration trong Build Command. `vercel.json` đã có cấu hình Next.js; không xuất static HTML vì ứng dụng có API server.

## 3. Cấu hình email xác thực

Supabase → Authentication → URL Configuration:

- **Site URL:** `https://TEN-APP.vercel.app` (hoặc tên miền chính thức của bạn, không có đường dẫn).
- **Redirect URLs:** `https://TEN-APP.vercel.app/auth/callback` và `https://TEN-APP.vercel.app/auth/callback?recovery=1`.
- Khi phát triển local, thêm `http://localhost:3000/auth/callback` và `http://localhost:3000/auth/callback?recovery=1` trên project staging.

Trong Email Templates, dùng đường dẫn bên dưới để xác thực phía server và hỗ trợ mở email trên thiết bị khác. Thay nội dung thư theo ý bạn nhưng giữ đường dẫn:

**Confirm signup**

```html
<h2>Xác nhận tài khoản TripFlow</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
    >Xác nhận email</a
  >
</p>
```

**Reset password**

```html
<h2>Đặt lại mật khẩu TripFlow</h2>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
    >Chọn mật khẩu mới</a
  >
</p>
```

Template dùng Site URL: email luôn về môi trường được đặt ở Site URL, kể cả đăng ký từ URL Preview. Dùng project staging riêng để tránh lẫn môi trường. Route `/auth/callback` vẫn hỗ trợ luồng code/PKCE. Token đã dùng hoặc hết hạn cần yêu cầu lại.

## 4. Chạy trên máy tính

```bash
npm ci
cp .env.example .env.local
# Điền 2 giá trị của Supabase vào .env.local
npm run dev
```

Mở `http://localhost:3000`. Nếu thiếu cấu hình, app hiện hướng dẫn thiết lập. GPS và clipboard cần HTTPS khi dùng trên điện thoại (localhost là ngoại lệ của trình duyệt).

## 5. Dùng thử sau khi deploy

1. Đăng ký, xác nhận email, đăng nhập; tạo chuyến đi với ngày và múi giờ phù hợp.
2. Trong **Lịch trình**, thêm hoạt động. Giờ nhập là giờ địa phương của chuyến đi.
3. Trong **Chi phí → Dự toán**, thêm các khoản dự kiến; trong **Đối chiếu**, bấm **Chốt dự toán gốc**. Lần chốt đầu tiên trở thành baseline bất biến, các lần sau là bản điều chỉnh.
4. Bấm **Ghi chi tiêu**. Chọn khoản dự toán tương ứng hoặc để ngoài dự toán; chi ròng tự trừ khoản hoàn tiền hợp lệ. Mở **Chi phí → Báo cáo** để xem tổng hợp theo ngày/hoạt động và trạng thái Data Integrity.
5. Bấm **Tôi đã đến** khi tới một điểm; xác nhận chuyển điểm sẽ hoàn thành điểm cũ. App không coi giờ kế hoạch là xác nhận bạn đang có mặt.
6. Trong **Media**, gắn link album Drive. Cấp quyền album tại Drive cho người xem; quyền TripFlow không thay đổi quyền Drive.
7. Trong **Thêm**, mời bằng email, sao chép link và tự gửi. Người nhận đăng nhập đúng email rồi mở link để chấp nhận. Nếu vừa đăng ký và xác nhận email, mở lại link mời. Danh sách “Người tham gia” không tự tạo tài khoản hoặc cấp quyền.
8. Thử trên thiết bị thứ hai cùng tài khoản hoặc thành viên được mời. V0.4.0 dùng Realtime để nhận thay đổi sớm giữa thiết bị; refetch 30 giây vẫn hoạt động làm fallback.
9. Kiểm thử offline: mở chuyến khi online → tắt mạng → thêm một khoản chi hoặc check-in → vào **Thêm** kiểm tra hàng đợi → bật mạng → xác nhận trạng thái đồng bộ về 0.
10. Đăng nhập Master → **Quản trị Master** → mở một user/chuyến để kiểm tra dữ liệu → hủy kích hoạt user thử nghiệm → xác nhận user đó bị chặn đăng nhập/sử dụng app → kích hoạt lại.

## Kiểm thử và vận hành

```bash
npm test
npm run typecheck
npm run build
```

- [Kiến trúc và database](docs/ARCHITECTURE.md)
- [Kết quả kiểm tra và nghiệm thu staging](docs/TESTING.md)
- [Hướng dẫn backup, nâng cấp, xử lý lỗi](docs/OPERATIONS.md)
- [Phạm vi và lộ trình tiếp theo](docs/ROADMAP.md)

Source không chứa credentials thật. Hãy chạy `npm test`, `npm run typecheck` và `npm run build` trên Node.js 24 trước khi deploy production, sau đó hoàn thành checklist staging với Supabase/Vercel thật của bạn.

## Tài liệu chính thức tham chiếu

- Next.js: https://nextjs.org/docs/app
- Supabase SSR/Auth: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Email templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Vercel deploy CLI: https://vercel.com/docs/cli/deploying-from-cli
- Vercel environment variables: https://vercel.com/docs/environment-variables


## 1.10. Brand Refresh V1.1.0

- Không có migration database mới. Giữ database ở marker Stable V1.0.0.
- Deploy source bằng Node 24.x; service worker tự chuyển cache shell sang `tripflow-shell-v110`.
- App version là `1.1.0`, database compatibility version là `1.0.0`; **Thêm → Trạng thái Production** hiển thị riêng App/DB để tránh yêu cầu migration giả.
- Nhận diện mới dùng logo pin + route, màu Ocean Teal + Sunset; icon PWA 192/512 đã thay mới.
- Splash ban đầu có brand animation nhẹ và tối thiểu ~680ms ở lần mở app đầu để tránh flash trắng/giật layout.
- Roadmap 1.x hiện đã hoàn thành đến V1.5.1; phiên bản tiếp theo là V1.6.0 – Smart Defaults & Context Automation.


## 1.11. Smart Trip Workspace & Quick Actions V1.2.0

- Không có migration database mới; database compatibility vẫn là Stable V1.0.0.
- Tổng quan có **Smart Workspace** với shortcut ghi chi tiêu, thêm hoạt động, check-in/hoàn thành theo Current/Next và gắn media theo activity đang liên quan.
- Tìm kiếm trong chuyến đi quét lịch trình, chi tiêu, dự toán, media và người tham gia; bỏ dấu tiếng Việt khi so khớp và điều hướng về đúng module/ngày.
- Desktop có phím tắt `/` để mở tìm kiếm; mobile dùng nút search trên topbar hoặc launcher trong Smart Workspace.
- Service worker cache shell: `tripflow-shell-v120`.
- Roadmap đánh dấu V1.2.0 ✅; phiên bản tiếp theo là **V1.3.0 – Media, Memories & Storytelling**.


## 1.12. Media, Memories & Storytelling V1.3.0

- Media được nhóm thành Travel Journal theo ngày kỷ niệm/hoạt động.
- Mỗi chuyến có thể chọn một cover; media có thể đánh dấu Trip Highlight.
- Caption dùng trường ghi chú hiện có; `story_order` điều khiển thứ tự kể chuyện.
- Post-Trip Report/CSV/JSON chứa phần Memories để lưu trữ hoặc chia sẻ sau chuyến.
- Database version yêu cầu: **1.3.0**.


## 1.13. Smart Planning Templates & Reuse V1.4.0

- Lưu lịch trình, dự toán và người tham gia của chuyến hiện tại thành mẫu cá nhân.
- Tạo chuyến mới từ mẫu với ngày bắt đầu mới; TripFlow tự dời thời gian các hoạt động nhưng không sao chép thực chi/media/lịch sử cũ.
- `end_date` của chuyến và `end_at` của hoạt động là tùy chọn.
- Input tiền hiển thị dấu chấm phân cách hàng nghìn khi nhập.
- Dashboard chỉ hiển thị nút ⚡ Thao tác nhanh; danh sách thao tác mở trong dialog.
- Lịch sử Live Trip mở qua nút **Xem lịch sử** thay vì chiếm diện tích lịch trình.
- Tab **Thực chi** có nút **Ghi chi tiêu** riêng để nhất quán với tab **Dự toán**.
- Database version yêu cầu: **1.4.0**.


## 1.14. Quick Entry & Command Center V1.5.0

- Mở Command Center bằng nút ⚡ nổi hoặc `Ctrl/Cmd + K`; `/` vẫn mở Search.
- Quick Entry tự chọn loại: có số tiền → khoản chi; không có số tiền → activity. Có thể ép activity bằng tiền tố `lịch`, `hd`, `hoạt động`; ép chi bằng `chi`.
- Số tiền hỗ trợ `350k`, `1tr2`, `1.2tr`, `120.000`, `1.250.000`; ngày hỗ trợ `hôm nay`, `ngày mai`, `DD/MM`; giờ hỗ trợ `7:30`, `14h`, `14h30`.
- Preview luôn xuất hiện trước khi ghi. Có thể **Lưu nhanh**, **Lưu & nhập tiếp** hoặc **Mở form** để bổ sung chi tiết.
- Quick Entry dùng mutation/queue hiện có nên khoản chi và activity vẫn hỗ trợ offline như trước.
- App version: **1.5.1**; Database version yêu cầu: **1.4.0**; V1.5.1 không có migration database.
