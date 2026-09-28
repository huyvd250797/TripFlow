# Nâng cấp TripFlow V0.2.0 → V0.3.0

> Tài liệu lịch sử. TripFlow hiện đã có V0.5.0; sau V0.3.0 hãy chạy tiếp `202609270003_v040_live_trip_realtime.sql`.

## Mục tiêu

V0.3.0 hoàn thiện Finance & Reporting Integrity: baseline dự toán gốc bất biến, revision history, báo cáo theo nhóm/ngày/hoạt động, export CSV/JSON và kiểm tra tính đúng dữ liệu tài chính.

## 1. Backup trước khi nâng cấp

Trước khi chạy migration trên production:

1. Backup database Supabase.
2. Xác nhận source đang ở V0.2.0 và migration `202609270001_v020_offline_master_admin.sql` đã chạy.
3. Không sửa hoặc chạy lại migration cũ.

## 2. Chạy migration V0.3.0

Chỉ chạy file:

```text
supabase/migrations/202609270002_v030_finance_reporting_integrity.sql
```

Migration thực hiện:

- Backfill metadata cho các snapshot cũ.
- Đánh số snapshot theo từng chuyến.
- Snapshot đầu tiên trở thành `baseline`, các snapshot sau là `revision`.
- Tính `total_amount` và `item_count` từ payload đã chốt.
- Chặn UPDATE trực tiếp snapshot để giữ tính bất biến.
- Tạo `tf_finance_report(uuid)` để tổng hợp báo cáo server-side.
- Bổ sung index cho refund và budget theo activity.

## 3. Kiểm tra sau migration

```sql
select
  trip_id,
  snapshot_no,
  snapshot_kind,
  total_amount,
  item_count,
  title,
  created_at
from public.budget_snapshots
order by trip_id, snapshot_no;
```

Nếu chuyến đã có snapshot trước V0.3.0, snapshot cũ đầu tiên phải có `snapshot_kind = 'baseline'`.

Kiểm tra report bằng một `trip_id` mà tài khoản hiện tại có quyền xem:

```sql
select public.tf_finance_report('YOUR_TRIP_UUID'::uuid);
```

Trong app mở **Chi phí → Báo cáo** và xác nhận:

- Có Dự toán gốc / Dự toán hiện tại / Thực chi ròng.
- Báo cáo theo ngày và hoạt động hiển thị đúng.
- Data Integrity không báo lỗi bất thường ngoài `NO_BASELINE` nếu chuyến chưa từng chốt dự toán.
- Export CSV và JSON tải được.

## 4. Rollback

Không nên rollback schema bằng cách xóa migration khỏi lịch sử. Nếu cần quay source về V0.2.0, các cột mới không làm hỏng đọc dữ liệu cũ. Hàm và metadata V0.3.0 có thể giữ nguyên cho đến khi có migration rollback được kiểm thử riêng.
