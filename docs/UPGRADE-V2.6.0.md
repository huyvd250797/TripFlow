# TripFlow V2.6.0 — UI/UX Motion & Visual Polish

## Nâng cấp từ V2.5.0

1. Giữ nguyên Supabase, tài khoản, quyền, dữ liệu và các biến môi trường hiện tại.
2. **Không cần chạy migration mới.** App V2.6.0 dùng database V2.4.1. Không có file TXT migration mới vì bản này không đổi schema. Nếu đang dùng DB cũ hơn V2.4.1, làm theo hướng dẫn V2.4.1 trong README; không reset database hoặc chạy lại migration đầu.
3. Thay source, cài bằng `npm ci`, dùng Node 24.x và build command `npm run build`. Postbuild tạo manifest Service Worker cho cả module lazy; không bỏ bước này bằng lệnh chỉ chạy `next build`.
4. Deploy theo README. Người đang dùng V2.5.0 sẽ nhận popup bản mới khi app kiểm tra phiên bản hoặc phát hiện worker mới. Bấm **Cập nhật**; không cần hard reload hoặc thoát PWA. Nếu đang nhập/lưu/sync, hoàn tất hoặc đóng phần nhập rồi cập nhật.
5. Kiểm tra **Thêm → Trạng thái Production**: App **2.6.0**, DB **2.4.1**. V2.6.0 sửa giá trị `DATABASE_VERSION = 2.5.0` không khớp migration trong source V2.5.0; không cần tạo marker database 2.5.0/2.6.0.

## Giao diện và tương tác

| Khu vực                           | Hành vi V2.6.0                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Nút, form, card                   | Thống nhất typography, khoảng cách, bán kính và màu semantic; focus bàn phím rõ; form không kéo giãn khoảng trống giữa các trường |
| Chuyển tab                        | Fade 120 ms, không chờ animation trước khi xử lý; không thêm delay mạng                                                           |
| Popup                             | Mở 180 ms; giữ đúng tọa độ căn giữa desktop; form nhập liệu giữ toàn màn hình trên mobile                                         |
| Command Center / danh sách chuyến | Bottom sheet trên mobile, cuộn nội dung riêng; desktop vẫn là popup giữa màn hình                                                 |
| Xác nhận xóa/thu hồi              | Popup compact với nút cảnh báo màu đỏ; giữ nguyên nghiệp vụ và quyền server                                                       |
| Lưu, đăng nhập, cập nhật          | Spinner và `aria-busy`; đóng/Escape/backdrop bị chặn khi popup đang ghi; lỗi lưu giữ nội dung nhập                                |
| Thông báo                         | Thành công, Thông tin, Cần chú ý có nhãn và icon; tự ẩn sau 6 giây, tạm dừng khi hover/focus; có nút đóng                         |
| Bàn phím                          | Sau đóng popup, trả focus về nút mở; nếu nút không còn, chọn điều hướng hiện tại đang hiển thị                                    |
| Giảm chuyển động                  | `prefers-reduced-motion: reduce` tắt animation/transition, giữ nhãn đang xử lý để không phụ thuộc spinner                         |

Không thêm thư viện animation, request nền hoặc migration. `app/polish.css` được import cuối sau CSS cũ/theme để giữ một lớp chuẩn hóa rõ ràng. Motion dùng opacity/scale/translate/rotate; không animate height/width hoặc chờ animation để ghi dữ liệu. Một số thông báo hệ thống gốc của trình duyệt (xác nhận rời form, quyền GPS, xác nhận khôi phục...) vẫn giữ nguyên.

## Kiểm tra và vận hành

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Browser regression và Service Worker: xem `TESTING.md`. Kịch bản polish dùng `TRIPFLOW_POLISH_TEST=1` khi chạy `npm run test:ui` với server test đang bật; ví dụ macOS/Linux:

```bash
TRIPFLOW_POLISH_TEST=1 UI_BASE_URL=http://localhost:3001 npm run test:ui
```

Trên PowerShell, đặt `$env:TRIPFLOW_POLISH_TEST="1"` và `$env:UI_BASE_URL="http://localhost:3001"` rồi chạy `npm run test:ui`. Xóa biến này trước khi chạy lại bộ regression thông thường. Test dùng dữ liệu mô phỏng riêng và PostgreSQL PGlite, không dùng dữ liệu production.

File `public/sw.js` trong ZIP là bootstrap; build production sinh lại danh sách hash. Chỉ đánh giá cache offline sau build và khi worker đã cài xong, không dùng chế độ dev để nghiệm thu offline. Không đổi cơ chế queue/cache của V2.5.0.

Chưa push GitHub/deploy production trong lần bàn giao source này. Cần UAT Safari/PWA iPhone thật với bàn phím mở, VoiceOver, safe-area và mạng yếu; kiểm thử Chromium không thay thế thiết bị thật.

## Phiên bản kế tiếp

**V2.7.0 — Mobile Navigation & Interaction Polish:** giảm số lần chạm, hoàn thiện giữ context/scroll, chuẩn hóa swipe/inline action và vùng bấm. Gửi source ZIP V2.6.0 này khi nâng cấp tiếp.
