# Kiểm tra V2.5.0

- Node 24.x, dependencies giữ nguyên so với V2.4.1.
- Unit/integration: 72/72 đạt, gồm toàn bộ 12 migration hiện có và các regression nghiệp vụ, quyền, queue; thêm kiểm tra SemVer, chặn update khi đang ghi/bản nháp, chuẩn bị trước update và gộp Realtime.
- Build webpack và Typecheck đạt.
- Chromium production build: 40 tổ hợp màn hình/kích thước/theme, lưu quyền, ví offline rồi sync, xóa và dọn cache: đạt, không lỗi JS.
- Service Worker thật với server mô phỏng phát hành: lần cài đầu không tự reload; worker mới tạo popup; bản nháp chặn cập nhật; Để sau mở lại được; mất mạng báo lỗi rồi thử lại; một lần bấm kích hoạt và tự reload bình thường; queue offline/theme/sessionStorage còn nguyên; tab khác không bị tải lại.

## Đo trước/sau

Cùng source chuyến mẫu, máy chạy kiểm thử và độ trễ giả lập 120 ms cho mỗi API trong cả hai bản:

| Chỉ số                                            |         V2.4.1 |         V2.5.0 |
| ------------------------------------------------- | -------------: | -------------: |
| JavaScript trong HTML tải ban đầu, gzip từng file |   377.737 byte |   327.710 byte |
| JavaScript tải ban đầu, chưa nén                  | 1.300.884 byte | 1.128.111 byte |
| Từ bấm Lưu tới đóng form chi tiêu, một lượt chạy  |         849 ms |         226 ms |
| GET danh sách chuyến sau ghi chi                  |              1 |              0 |
| GET dữ liệu chuyến sau ghi chi                    |              1 |              1 |

JS ban đầu giảm khoảng 13%; các module cần cho offline vẫn được cache nền. Không dùng số liệu này để khẳng định toàn bộ lưu lượng mạng giảm tương ứng. Thời gian lưu là phép đo có kiểm soát qua Auth/HTTP mock + PostgreSQL PGlite, không phải SLA hoặc số đo Supabase/Vercel production. Số byte thay đổi nhẹ nếu build metadata/version hoặc cấu hình khác.

Dùng `scripts/measure-client-bundle.cjs` để đo lại từ thư mục build, và `TRIPFLOW_PERF_TEST=1` khi chạy UI regression để đo fixture lưu/GET. Test không truy cập dữ liệu production. Cần xác minh thêm trên Safari/PWA iPhone thật và mạng di động.
