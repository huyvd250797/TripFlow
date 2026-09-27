# TripFlow 0.2.0 · Offline, Data Reliability & Master Administration

Web app quản lý chuyến đi, viết mới từ kế hoạch TripFlow, ưu tiên điện thoại. Giao diện tiếng Việt, tiền VNĐ, ngày DD/MM/YYYY. Frontend và backend triển khai chung trên Vercel; dữ liệu và tài khoản dùng Supabase.

**Bắt đầu:** giải nén → chạy migration theo thứ tự → cấu hình Supabase/Vercel → tạo tài khoản → gán 1 tài khoản Master bằng SQL tin cậy → kiểm thử online/offline và phân quyền.

ZIP chứa mã nguồn. Vercel không tự tạo database từ ZIP; cần hoàn thành cấu hình dưới đây. Không cần máy chủ backend riêng. Không có dữ liệu mẫu hoặc tài khoản mặc định trong bản chạy thật.

## Đã có trong phiên bản này

- Đăng ký, xác nhận email, đăng nhập, quên/đổi mật khẩu, đăng xuất.
- Nhiều chuyến đi: ngày, múi giờ, số người, trạng thái, ghi chú.
- Lịch trình theo ngày; thêm/sửa/xóa/sao chép hoạt động; roadmap, đánh dấu đã đến, hoàn thành, bỏ qua. Chỉ một hoạt động được check-in tại một thời điểm.
- Điểm hiện tại theo lịch, điểm đã check-in, hoạt động quá giờ chưa cập nhật; mở Google Maps/GPS khi người dùng yêu cầu.
- Dự toán theo khoản và nhóm, số lượng × đơn giá; chốt bản dự toán gốc.
- Ghi thực chi, người trả, ngày chi, link chứng từ; liên kết dự toán, chi ngoài kế hoạch và hoàn tiền.
- Tổng hợp/so sánh ngân sách và thực chi ròng theo nhóm, từng khoản và bản dự toán đã chốt; xuất CSV.
- Gắn link Google Drive/HTTPS cho album, ảnh, video, tài liệu; liên kết với hoạt động. Media mở tại nguồn, không upload vào app.
- Danh sách người tham gia; mời tài khoản qua liên kết ràng buộc email, quyền chủ chuyến/chỉnh sửa/chỉ xem; thu hồi quyền.
- Nhật ký thay đổi, xuất dữ liệu chuyến đi JSON, phát hiện xung đột khi nhiều người sửa, chống ghi trùng khi thử lại.
- **Offline V0.2.0:** cache IndexedDB theo tài khoản; hàng đợi thao tác; tự đồng bộ khi mạng trở lại; trạng thái chờ/gửi/xung đột/bị từ chối; service worker cache app shell.
- **Master Administration:** Master xem danh sách user, dữ liệu/chuyến đi và audit; hủy kích hoạt hoặc kích hoạt lại tài khoản. User bị hủy kích hoạt không thể sử dụng app/API và bị đăng xuất khi account gate phát hiện trạng thái.
- Điều hướng dưới trên mobile, dialog co giãn, vùng an toàn màn hình; web manifest và icon để cài PWA.
- Roadmap phiên bản hiển thị ngay trong **Thêm → TripFlow roadmap**; V0.1.0 và V0.2.0 được đánh dấu ✅, đồng thời mô tả V0.3.0 là phiên bản tiếp theo.

**Phạm vi offline:** cho phép thêm thực chi, cập nhật/check-in lịch trình, thêm/sửa người tham gia và media khi mất mạng. Phân quyền, lời mời, xóa chuyến, chốt dự toán và Master Admin yêu cầu online. Chưa có push notification, định vị nền, chia nợ hoặc đa tiền tệ.

## 1. Tạo database Supabase

1. Tạo một **project Supabase mới, trống**. Giữ mật khẩu database ở nơi riêng; không ghi vào source.
2. Mở **SQL Editor** và chạy migration **đúng thứ tự**:
   - `supabase/migrations/202609250001_tripflow.sql` — nền V0.1.0.
   - `supabase/migrations/202609270001_v020_offline_master_admin.sql` — nâng cấp V0.2.0.
   Nếu database đang chạy V0.1.0 thì **chỉ chạy migration V0.2.0**, không chạy lại file đầu. Mỗi migration có transaction; nếu công cụ giữ phiên SQL sau lỗi, chạy `ROLLBACK;` trước khi thử lại.
3. Sau V0.2.0 có 12 bảng trong schema `public`, gồm 10 bảng cũ cộng `tf_user_accounts` và `tf_admin_audit`; schema `private` tiếp tục giữ dữ liệu/hàm nội bộ.
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
3. Trong **Chi phí → Dự toán**, thêm chi phí; trong **So sánh**, chốt bản dự toán trước khi đi.
4. Bấm **Ghi chi tiêu**. Chọn khoản dự toán tương ứng hoặc để ngoài dự toán; chi ròng tự trừ khoản hoàn tiền hợp lệ.
5. Bấm **Tôi đã đến** khi tới một điểm; xác nhận chuyển điểm sẽ hoàn thành điểm cũ. App không coi giờ kế hoạch là xác nhận bạn đang có mặt.
6. Trong **Media**, gắn link album Drive. Cấp quyền album tại Drive cho người xem; quyền TripFlow không thay đổi quyền Drive.
7. Trong **Thêm**, mời bằng email, sao chép link và tự gửi. Người nhận đăng nhập đúng email rồi mở link để chấp nhận. Nếu vừa đăng ký và xác nhận email, mở lại link mời. Danh sách “Người tham gia” không tự tạo tài khoản hoặc cấp quyền.
8. Thử trên thiết bị thứ hai cùng tài khoản hoặc thành viên được mời. Dữ liệu tải lại định kỳ 30 giây; sự kiện realtime có thể làm mới sớm hơn.
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

Source không chứa credentials thật. Bản này đã được build/test cục bộ; chưa kết nối tài khoản Supabase/Vercel thật của bạn. Hoàn thành checklist staging trước khi dùng cho nhóm.

## Tài liệu chính thức tham chiếu

- Next.js: https://nextjs.org/docs/app
- Supabase SSR/Auth: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Email templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Vercel deploy CLI: https://vercel.com/docs/cli/deploying-from-cli
- Vercel environment variables: https://vercel.com/docs/environment-variables
