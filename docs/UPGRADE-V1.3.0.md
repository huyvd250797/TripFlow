# Nâng cấp TripFlow V1.2.0 → V1.3.0

V1.3.0 là **Media, Memories & Storytelling**. Bản này có thay đổi schema database.

## Migration bắt buộc

Nếu database đang ở V1.0.0/V1.2.0, chạy **một migration mới**:

```text
supabase/migrations/202609280006_v130_media_memories_storytelling.sql
```

Migration bổ sung metadata storytelling cho `media_links`, Realtime cho media, cập nhật restore backup và marker/readiness Database V1.3.0.

## Tính năng mới

- Cover chuyến đi: tối đa một media cover đang hiệu lực cho mỗi chuyến.
- Trip Highlight cho các khoảnh khắc đáng nhớ.
- Ngày kỷ niệm riêng (`taken_on`) và thứ tự kể chuyện (`story_order`).
- Travel Journal nhóm media/lịch trình theo ngày.
- Post-Trip Report, CSV và JSON chứa phần Memories & Storytelling.
- Link ảnh trực tiếp và Google Drive photo có thể hiển thị preview khi nguồn cho phép; nếu không TripFlow vẫn hiển thị card an toàn và mở link gốc.

## Sau khi deploy

1. Chạy migration trên Supabase SQL Editor.
2. Deploy source V1.3.0 bằng Node 24.x.
3. Đóng/mở lại PWA để nhận service worker `tripflow-shell-v130`.
4. Vào **Thêm → Trạng thái Production** và xác nhận App 1.3.0 / DB 1.3.0 / stable.
5. Tạo 2 media, chọn một cover và một highlight; kiểm tra Realtime trên thiết bị thứ hai.
6. Tạo backup rồi restore thành bản sao, xác nhận cover/highlight/ngày kỷ niệm còn nguyên.

## Rollback

Migration chỉ bổ sung cột/index/wrapper và tương thích ngược với source cũ ở mức đọc dữ liệu. Nếu rollback frontend về V1.2.0, không xóa các cột V1.3.0. Không chạy `DROP COLUMN` trong production.
