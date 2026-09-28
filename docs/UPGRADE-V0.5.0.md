# Nâng cấp TripFlow V0.4.0 → V0.5.0

## 1. Backup và staging

Backup database trước khi nâng cấp và chạy migration trên staging trước production. V0.5.0 giữ nguyên mô hình auth/RLS hiện có và bổ sung lớp cộng tác.

## 2. Chạy migration

Nếu database đã ở V0.4.0, chỉ chạy:

```text
supabase/migrations/202609280001_v050_collaboration_permission_control.sql
```

Migration bổ sung `updated_at` cho member/invitation, dọn lời mời pending bị trùng trước khi tạo unique index, thêm invitation guard, `trip_access_events`, trigger access-event và publication Realtime khi khả dụng.

## 3. Deploy frontend

Deploy source V0.5.0 lên Vercel bằng Node.js 24.x. Không cần thêm secret mới.

## 4. Nghiệm thu bắt buộc

1. Owner mời Editor và Viewer bằng đúng email.
2. Tạo lại lời mời cùng email khi lời mời cũ còn hiệu lực phải bị chặn.
3. Mời email đã là member phải bị chặn.
4. Đổi Editor → Viewer ở thiết bị Owner; thiết bị member đang online phải nhận thay đổi và mất quyền ghi.
5. Thu hồi member; quyền đọc/ghi server phải mất ngay và thiết bị online phải refetch danh sách chuyến.
6. Viewer thử thêm/sửa/xóa dữ liệu phải bị từ chối; Editor không được mời/đổi quyền/thu hồi member.
7. Participant vẫn có thể tồn tại độc lập, không tự cấp quyền account.

## 5. Lưu ý offline

Thu hồi quyền có hiệu lực ngay ở server. Thiết bị đang offline có thể vẫn xem cache đã tải trước đó cho đến khi online trở lại; mọi mutation chờ đồng bộ sẽ bị server kiểm tra lại quyền và từ chối nếu quyền đã bị thu hồi.

## 6. Rollback

Vercel rollback frontend không tự rollback database. Không xóa `trip_access_events` trên production nếu chưa đánh giá dữ liệu audit/access đã phát sinh.
