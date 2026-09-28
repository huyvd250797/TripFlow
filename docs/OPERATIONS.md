# Vận hành và xử lý lỗi

## Bảo vệ cấu hình

Chỉ hai public env được dùng; key publishable là thành phần công khai theo thiết kế Supabase. Bảo vệ dữ liệu bằng RLS/RPC, không dựa vào việc giấu public key. Không thêm service-role key vào biến `NEXT_PUBLIC_*`. Credentials database, SMTP và tài khoản quản trị lưu riêng.

Dữ liệu chi phí, email thành viên, lịch trình và audit là dữ liệu cá nhân của nhóm. Chỉ mời tài khoản thực sự cần truy cập. Log ứng dụng không cố ý in toàn bộ payload hay phiên đăng nhập. Xem HTTP/API logs và Supabase logs khi cần chẩn đoán.

## Backup và khôi phục

- Nút xuất JSON sao lưu nội dung **một chuyến đi**, không bao gồm Auth, membership, invitations, audit hoặc mutation receipts; không phải bản sao lưu đầy đủ database.
- CSV phục vụ bảng tính, không phải định dạng khôi phục database.
- Quản trị viên cấu hình backup PostgreSQL phù hợp gói Supabase và giữ bản sao độc lập theo chính sách riêng. Xem hướng dẫn chính thức: https://supabase.com/docs/guides/platform/backups và https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore . Khả năng backup/PITR phụ thuộc gói, không được giả định có sẵn.
- Thử restore vào **project staging mới** trước; kiểm tra schema public/private và quan hệ với auth.users, đăng nhập, quyền, tổng chi phí và lịch trình. Không dùng JSON export để thay thế backup Auth.
- Soft delete không phải xóa vĩnh viễn. V0.2 chưa có nút khôi phục/xóa vĩnh viễn trong app; quản trị viên phải có backup, kiểm tra khóa ngoại và thực hiện thủ công theo yêu cầu cụ thể. Không cung cấp câu lệnh xóa hàng loạt mặc định.

## Nâng cấp

Commit source vào repo của bạn. Mỗi thay đổi schema tạo migration mới, thử trên staging trước; backup trước khi áp dụng production. Kiểm tra rollback tương thích phiên bản frontend/API cũ. Vercel rollback frontend không tự rollback database.

Theo dõi tăng trưởng audit, admin audit và mutation receipts. V0.2 chưa có cron xóa dữ liệu; không tự xóa receipt gần đây vì sẽ làm mất khả năng nhận diện thao tác retry. Chọn thời hạn lưu sau khi có số liệu vận hành.

## Sự cố thường gặp

| Hiện tượng                                   | Cách xử lý                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Màn hình thiết lập database                  | Kiểm tra đúng tên hai biến môi trường, chọn đúng Production/Preview và redeploy                                           |
| Đăng nhập được nhưng không tạo/tải chuyến đi | Kiểm tra migration đã commit; đúng Supabase URL/key; xem API/database logs                                                |
| Email không tới                              | Kiểm tra SMTP, spam, rate limit; xác nhận địa chỉ nhận và cấu hình Auth                                                   |
| Link email sai domain hoặc hết hạn           | Sửa Site URL, kiểm tra templates, yêu cầu email mới; URL token dùng một lần                                               |
| Lưu bị từ chối vì nguồn yêu cầu              | Dùng domain ứng dụng trực tiếp; reverse proxy tùy chỉnh phải giữ đúng host/origin, không tắt kiểm tra Origin để sửa nhanh |
| Dữ liệu đã thay đổi                          | Giữ lại nội dung cần thiết, đóng form, tải lại và sửa trên phiên bản mới                                                  |
| Thao tác offline chưa đồng bộ               | Mở **Thêm → Dữ liệu, offline & tài khoản** để xem queue; bật mạng và bấm Đồng bộ ngay. Conflict/rejected được giữ lại, không tự ghi đè |
| User bị hủy kích hoạt nhưng đang offline    | Quyền thu hồi được áp dụng khi thiết bị kết nối lại và account gate/server kiểm tra; dữ liệu đã cache trước đó không thể bị thu hồi từ xa khi thiết bị hoàn toàn offline |
| Không thấy Quản trị Master                  | Gán role `master` cho đúng user bằng SQL tin cậy theo README; đăng xuất/đăng nhập lại và kiểm tra migration V0.2            |
| Drive báo không có quyền                     | Chủ album cấp quyền tại Drive; quyền TripFlow không cấp quyền Drive                                                       |
| GPS bị chặn                                  | Dùng HTTPS, cấp quyền vị trí cho trình duyệt; có thể mở Maps từ link hoạt động                                            |
| Thành viên không nhận lời mời                | Đăng nhập đúng email, kiểm tra hạn 7 ngày; mở lại link sau khi xác nhận tài khoản                                         |
| Sửa khoản chi gốc bị chặn                    | Khoản gốc có hoàn tiền; xử lý khoản hoàn trước để tránh sai tổng                                                          |

## Hỗ trợ trình duyệt

Mục tiêu: các bản Chrome/Edge/Safari/Firefox hiện đại hỗ trợ `Intl` timezone, `crypto.randomUUID`, ES2023 `toSorted` và CSS `dvh`. Đã kiểm tra Chromium trong môi trường desktop mô phỏng viewport mobile; cần nghiệm thu Safari/iOS và Android thật. Manifest + service worker cho phép mở app shell và dữ liệu chuyến đã cache khi offline. Media nguồn ngoài vẫn cần mạng/quyền nguồn. Cần nghiệm thu Safari/iOS và Android thật trước production.

## Finance V0.3.0

- Nếu màn hình chuyến đi báo `V030_MIGRATION_REQUIRED`, chạy `202609270002_v030_finance_reporting_integrity.sql` trên đúng Supabase project.
- Nếu Data Integrity báo `NO_BASELINE`, đây là cảnh báo nghiệp vụ: chốt dự toán gốc trong **Chi phí → Đối chiếu**.
- Nếu có `REFUND_*`, `BUDGET_LINK_MISMATCH`, `ACTIVITY_LINK_MISMATCH` hoặc `SNAPSHOT_MISMATCH`, không sửa trực tiếp bảng production trước khi backup; đối chiếu audit và dữ liệu gốc rồi tạo migration/repair script riêng.
- Không UPDATE trực tiếp `budget_snapshots`; trigger V0.3.0 cố ý trả `SNAPSHOT_IMMUTABLE`.


## Live Trip & Realtime V0.4.0

- Nếu API báo `V040_MIGRATION_REQUIRED`, chạy `202609270003_v040_live_trip_realtime.sql` trên đúng Supabase project.
- Realtime chỉ được bật tự động khi publication `supabase_realtime` tồn tại. Nếu môi trường tự host không dùng publication này, app vẫn refetch mỗi 30 giây.
- `itinerary_events` là lịch sử nghiệp vụ; không sửa/xóa trực tiếp để “chỉnh” timeline. Nếu dữ liệu sai, đối chiếu audit + mutation nguồn và tạo repair migration riêng.
- Nếu badge Realtime báo lỗi nhưng dữ liệu vẫn cập nhật sau tối đa khoảng 30 giây, kiểm tra Supabase Realtime health/publication/RLS trước khi thay đổi frontend.
- Khi nhiều thiết bị check-in đồng thời, `ACTIVE_CHANGED`/409 là cơ chế bảo vệ dữ liệu, không nên tắt lock hoặc unique index `one_active_item`.

## Backup, Recovery & Operations V0.7.0

- Nếu giao diện báo `V070_MIGRATION_REQUIRED`, chạy `202609280003_v070_backup_recovery_operations.sql` trên đúng Supabase project.
- **App backup** là snapshot logic của một chuyến đi. Snapshot được lưu trong cùng PostgreSQL project, có checksum để phát hiện thay đổi payload và chỉ Owner truy cập. Đây **không phải** disaster-recovery backup độc lập.
- Restore backup luôn tạo một **chuyến đi mới**, remap các ID quan hệ và không overwrite source trip. Member/invitation không được restore để tránh vô tình cấp lại quyền truy cập cũ.
- `trip_backups` là immutable: không UPDATE/DELETE trực tiếp. Nếu cần purge backup theo chính sách doanh nghiệp, tạo migration/maintenance job riêng sau khi đã kiểm thử restore staging.
- Thùng rác V0.7.0 dùng các `deleted_at`/tombstone hiện có. Khôi phục refund yêu cầu giao dịch payment gốc đang hoạt động; nếu không, restore trả `DEPENDENCY_DELETED`.
- Retention mặc định 30 ngày cho tombstone và 90 ngày cho app backup. V0.7.0 **không tự purge** dù đã quá mốc; `eligible_for_purge` chỉ là chỉ số vận hành.
- Operations health hiển thị số backup, tombstone, audit và mutation receipt để theo dõi tăng trưởng. Trước khi triển khai purge/cron, cần đo production và chốt thời hạn lưu thực tế.
- Security headers V0.7.0 thêm HSTS, COOP và tắt DNS prefetch. Recovery API kiểm tra Auth, Origin, schema input và Owner permission ở database.

### Runbook khôi phục

1. Nếu lỗi chỉ ảnh hưởng một record vừa xóa: dùng **Thêm → Backup & Recovery → Thùng rác**.
2. Nếu cần quay lại một trạng thái logic cũ của chuyến: restore app backup thành chuyến mới, đối chiếu dữ liệu rồi quyết định sử dụng bản mới.
3. Nếu database/project gặp sự cố diện rộng: dùng PostgreSQL/Supabase backup/PITR độc lập; không dùng app backup làm phương án duy nhất.
4. Mọi restore production cần kiểm tra Finance Integrity, số hoạt động, media link và quyền truy cập sau phục hồi.
