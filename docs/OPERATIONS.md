# Vận hành và xử lý lỗi

## Bảo vệ cấu hình

Chỉ hai public env được dùng; key publishable là thành phần công khai theo thiết kế Supabase. Bảo vệ dữ liệu bằng RLS/RPC, không dựa vào việc giấu public key. Không thêm service-role key vào biến `NEXT_PUBLIC_*`. Credentials database, SMTP và tài khoản quản trị lưu riêng.

Dữ liệu chi phí, email thành viên, lịch trình và audit là dữ liệu cá nhân của nhóm. Chỉ mời tài khoản thực sự cần truy cập. Log ứng dụng không cố ý in toàn bộ payload hay phiên đăng nhập. Xem HTTP/API logs và Supabase logs khi cần chẩn đoán.

## Backup và khôi phục

- Nút xuất JSON sao lưu nội dung **một chuyến đi**, không bao gồm Auth, membership, invitations, audit hoặc mutation receipts; không phải bản sao lưu đầy đủ database.
- CSV phục vụ bảng tính, không phải định dạng khôi phục database.
- Quản trị viên cấu hình backup PostgreSQL phù hợp gói Supabase và giữ bản sao độc lập theo chính sách riêng. Xem hướng dẫn chính thức: https://supabase.com/docs/guides/platform/backups và https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore . Khả năng backup/PITR phụ thuộc gói, không được giả định có sẵn.
- Thử restore vào **project staging mới** trước; kiểm tra schema public/private và quan hệ với auth.users, đăng nhập, quyền, tổng chi phí và lịch trình. Không dùng JSON export để thay thế backup Auth.
- Soft delete không phải xóa vĩnh viễn. V0.1 chưa có nút khôi phục/xóa vĩnh viễn trong app; quản trị viên phải có backup, kiểm tra khóa ngoại và thực hiện thủ công theo yêu cầu cụ thể. Không cung cấp câu lệnh xóa hàng loạt mặc định.

## Nâng cấp

Commit source vào repo của bạn. Mỗi thay đổi schema tạo migration mới, thử trên staging trước; backup trước khi áp dụng production. Kiểm tra rollback tương thích phiên bản frontend/API cũ. Vercel rollback frontend không tự rollback database.

Theo dõi tăng trưởng audit và mutation receipts. V0.1 chưa có cron xóa dữ liệu; không tự xóa receipt gần đây vì sẽ làm mất khả năng nhận diện thao tác retry. Chọn thời hạn lưu sau khi có số liệu vận hành.

## Sự cố thường gặp

| Hiện tượng                                   | Cách xử lý                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Màn hình thiết lập database                  | Kiểm tra đúng tên hai biến môi trường, chọn đúng Production/Preview và redeploy                                           |
| Đăng nhập được nhưng không tạo/tải chuyến đi | Kiểm tra migration đã commit; đúng Supabase URL/key; xem API/database logs                                                |
| Email không tới                              | Kiểm tra SMTP, spam, rate limit; xác nhận địa chỉ nhận và cấu hình Auth                                                   |
| Link email sai domain hoặc hết hạn           | Sửa Site URL, kiểm tra templates, yêu cầu email mới; URL token dùng một lần                                               |
| Lưu bị từ chối vì nguồn yêu cầu              | Dùng domain ứng dụng trực tiếp; reverse proxy tùy chỉnh phải giữ đúng host/origin, không tắt kiểm tra Origin để sửa nhanh |
| Dữ liệu đã thay đổi                          | Giữ lại nội dung cần thiết, đóng form, tải lại và sửa trên phiên bản mới                                                  |
| Không lưu khi mất mạng                       | Kết nối lại và lưu trong form hiện tại; không đóng/reload vì bản này chưa có lưu nháp offline                             |
| Drive báo không có quyền                     | Chủ album cấp quyền tại Drive; quyền TripFlow không cấp quyền Drive                                                       |
| GPS bị chặn                                  | Dùng HTTPS, cấp quyền vị trí cho trình duyệt; có thể mở Maps từ link hoạt động                                            |
| Thành viên không nhận lời mời                | Đăng nhập đúng email, kiểm tra hạn 7 ngày; mở lại link sau khi xác nhận tài khoản                                         |
| Sửa khoản chi gốc bị chặn                    | Khoản gốc có hoàn tiền; xử lý khoản hoàn trước để tránh sai tổng                                                          |

## Hỗ trợ trình duyệt

Mục tiêu: các bản Chrome/Edge/Safari/Firefox hiện đại hỗ trợ `Intl` timezone, `crypto.randomUUID`, ES2023 `toSorted` và CSS `dvh`. Đã kiểm tra Chromium trong môi trường desktop mô phỏng viewport mobile; cần nghiệm thu Safari/iOS và Android thật. Manifest cho phép thêm lối tắt theo khả năng trình duyệt; chưa hỗ trợ mở app khi hoàn toàn offline.
