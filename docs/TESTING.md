# Kiểm tra bản 0.1.0

## Đã thực hiện trong môi trường phát triển

- Build Next.js production.
- TypeScript strict.
- 5 unit tests: ngày hợp lệ và timezone/DST; tổng dự toán/thực chi/hoàn tiền; điểm hiện tại theo lịch khác check-in; URL HTTPS; CSV chống formula injection.
- 1 bài integration PostgreSQL gồm nhiều tình huống: migration trên PostgreSQL/PGlite, quyền đọc RLS, cấm ghi thẳng bảng, chủ/editor/viewer/người ngoài, lời mời email, thu hồi quyền, CRUD, khoản liên kết sai chuyến, giữ thực chi/media khi xóa liên kết, giới hạn hoàn tiền, operation retry, stale version, snapshot, check-in nguyên tử và audit.
- Browser integration trên Chromium: đăng nhập giả lập; giao diện chạy thật gọi adapter đến PGlite; thêm chi tiêu và kiểm tra tổng DB; chuyển điểm check-in; sao chép hoạt động; thêm link Drive; kiểm tra 5 màn hình × 4 kích thước 320/390/768/1440 không tràn trang ngang. Không có exception JavaScript trong các luồng đã thử. Đã xem ảnh chụp mobile form, tổng quan và desktop.
- `npm audit --omit=dev` tại thời điểm kiểm tra: không báo lỗ hổng đã biết. Đây không phải chứng nhận bảo mật.

PGlite là PostgreSQL chạy trong môi trường nhúng; test tạo stub `auth.uid()`/`auth.jwt()` và role để kiểm tra RLS. Browser test mock Auth và HTTP transport, **không thay thế kiểm tra Supabase Auth/PostgREST/Realtime/Vercel thật**. Chưa gửi email thật, chưa nghiệm thu trên Safari/iOS/Android thật, chưa kiểm thử tải lớn.

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
- [ ] Mất mạng khi đang nhập: không báo lưu thành công; form còn nội dung để thử lại khi có mạng.
- [ ] Album Drive mở ở tab/trang nguồn; không có upload file vào Supabase Storage.
- [ ] Kiểm tra iPhone Safari, Android Chrome, bàn phím form, vùng safe-area, GPS quyền từ chối/cho phép, thao tác back/foreground.
- [ ] Kiểm tra logs, quota, backup và thử restore trước khi cho nhiều người dùng.
