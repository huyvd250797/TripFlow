# Nâng cấp TripFlow V0.6.0 → V0.7.0

V0.7.0 bổ sung schema cho **Backup, Recovery & Operations**. Database đang ở V0.5.0 + hotfix có thể chạy trực tiếp migration V0.7.0 vì V0.6.0 không có migration database.

## 1. Backup trước khi nâng cấp

Trước khi chạy migration production, tạo backup PostgreSQL/Supabase theo gói đang sử dụng. Backup trong TripFlow V0.7.0 là backup cấp ứng dụng và không thay thế PostgreSQL backup/PITR.

## 2. Chạy migration

Trong Supabase SQL Editor chạy đúng file:

```text
supabase/migrations/202609280003_v070_backup_recovery_operations.sql
```

Không chạy lại migration V0.1.0–V0.5.0 nếu database đã áp dụng trước đó.

Migration tạo:

- `public.tf_retention_policy`
- `public.trip_backups`
- `tf_create_trip_backup`
- `tf_get_trip_backup`
- `tf_restore_trip_backup`
- `tf_restore_deleted`
- `tf_recovery_overview`

## 3. Deploy source

Deploy source V0.7.0 với Node.js 24.x. Service worker dùng cache shell `tripflow-shell-v070`; nếu app đang mở bằng worker cũ, vào **Thêm → Ứng dụng trên thiết bị** và bấm cập nhật khi được nhắc.

## 4. Kiểm tra sau nâng cấp

1. Đăng nhập bằng Owner của một chuyến đi.
2. Vào **Thêm → Backup & Recovery**.
3. Tạo backup, kiểm tra xuất JSON.
4. Restore backup; hệ thống phải tạo một chuyến mới có hậu tố “(Khôi phục)” và không sửa source trip.
5. Xóa thử một participant/media test, mở thùng rác và khôi phục.
6. Kiểm tra số audit/tombstone/backup trong Operations health.
7. Thử tài khoản Editor/Viewer: không được truy cập Backup & Recovery của Owner.

## 5. Retention

Mặc định:

- Tombstone recovery: 30 ngày
- App backup: 90 ngày
- Mutation receipt: 30 ngày
- Audit: 365 ngày

Các giá trị này ở V0.7.0 phục vụ **đánh dấu và giám sát**. Hệ thống không tự purge production để tránh xóa ngoài ý muốn. Chỉ triển khai cron/purge sau khi có chính sách vận hành được duyệt và đã test restore trên staging.
