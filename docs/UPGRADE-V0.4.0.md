# Nâng cấp TripFlow V0.3.0 → V0.4.0

## 1. Backup và staging

Backup database trước khi nâng cấp và chạy trên Supabase staging trước production. Frontend V0.4.0 yêu cầu migration V0.4.0 vì API đọc bảng `itinerary_events`.

## 2. Chạy migration

Nếu database đã ở V0.3.0, chỉ chạy file:

```text
supabase/migrations/202609270003_v040_live_trip_realtime.sql
```

Không chạy lại migration cũ. Migration tạo `itinerary_events`, bọc `tf_mutate` để ghi lịch sử status trong cùng transaction và thêm các bảng live vào publication `supabase_realtime` nếu publication tồn tại.

## 3. Deploy frontend

Deploy source V0.4.0 lên Vercel với Node.js 24.x và giữ nguyên hai biến Supabase public hiện có. Không cần thêm secret/service-role key.

## 4. Nghiệm thu bắt buộc

1. Mở cùng chuyến trên hai thiết bị/tài khoản có quyền edit.
2. Check-in ở thiết bị A; thiết bị B phải nhận trạng thái mới qua Realtime hoặc refetch fallback.
3. Chuyển check-in sang chặng B; chặng A phải tự hoàn thành và history có cả `auto_complete` + `check_in`.
4. Retry cùng mutation không tạo history trùng.
5. Thử offline check-in → online → queue sync → history xuất hiện sau khi server xác nhận.
6. Kiểm tra badge Realtime, Current/Next/Late và cảnh báo trễ trên mobile.

## 5. Rollback

Vercel rollback frontend không rollback database. Migration V0.4.0 là additive nhưng đổi tên/bọc `tf_mutate`; nếu cần rollback production phải có migration rollback được kiểm thử riêng, không xóa `itinerary_events` khi chưa sao lưu lịch sử.
