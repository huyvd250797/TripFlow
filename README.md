# TripFlow 0.1.0 · Cloud MVP

Web app quản lý chuyến đi, viết mới từ kế hoạch TripFlow, ưu tiên điện thoại. Giao diện tiếng Việt, tiền VNĐ, ngày DD/MM/YYYY. Frontend và backend triển khai chung trên Vercel; dữ liệu và tài khoản dùng Supabase.

**Bắt đầu:** giải nén → tạo Supabase → chạy migration → cấu hình 2 biến môi trường → deploy Vercel → cấu hình email xác thực → tạo tài khoản.

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
- Điều hướng dưới trên mobile, dialog co giãn, vùng an toàn màn hình; web manifest và icon để thêm lối tắt ra màn hình chính.

**Phạm vi:** đây là bản đầu tiên hoạt động qua mạng. Chưa có hàng đợi offline, service worker, push notification, tự động định vị nền, chia nợ hoặc đa tiền tệ. JSON hiện dùng lưu trữ/xuất dữ liệu; chưa có nhập lại trong UI. Xem [ROADMAP](docs/ROADMAP.md).

## 1. Tạo database Supabase

1. Tạo một **project Supabase mới, trống**. Giữ mật khẩu database ở nơi riêng; không ghi vào source.
2. Mở **SQL Editor**, dán toàn bộ `supabase/migrations/202609250001_tripflow.sql`, chạy **một lần**. Migration có transaction; lỗi sẽ rollback. Nếu chạy bằng công cụ giữ phiên SQL và gặp lỗi, chạy `ROLLBACK;` trước khi thử lại.
3. Kiểm tra có 10 bảng trong schema `public`: trips, trip_members, itinerary_items, budget_items, expenses, media_links, trip_participants, trip_invitations, budget_snapshots, audit_logs. Có schema `private` cho dữ liệu xử lý nội bộ.
4. Lấy **Project URL** và **Publishable key** từ trang API/Connect của project. Legacy `anon` key cũng dùng được. **Không dùng `service_role` hoặc secret key.**
5. Giữ RLS bật. Không mở schema `private` trong Data API. Không cấp quyền ghi trực tiếp cho bảng; mutation chạy qua hàm `tf_mutate` đã kiểm tra người dùng/quyền.
6. Auth: bật đăng nhập Email/Password và **Confirm email**. Đặt mật khẩu tối thiểu 8 ký tự. Cấu hình SMTP của bạn cho email dùng thật; kiểm tra giới hạn gửi của dịch vụ trước khi mời nhóm sử dụng.

Migration này dành cho project mới; không chạy vào database có ứng dụng khác vì có lệnh thu hồi quyền các bảng public. Các lần nâng cấp sau phải thêm migration mới, không sửa/chạy lại migration đầu trên production.

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
8. Thử trên thiết bị thứ hai cùng tài khoản hoặc thành viên được mời. Dữ liệu tải lại định kỳ 30 giây; sự kiện realtime có thể làm mới sớm hơn. Nút tải lại có thể dùng bất kỳ lúc nào.

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
