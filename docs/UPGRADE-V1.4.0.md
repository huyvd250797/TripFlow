# Upgrade TripFlow V1.4.0 — Smart Planning Templates & Reuse

## Database

Nếu database đang ở V1.3.0, chạy duy nhất migration:

```text
supabase/migrations/202609290001_v140_smart_planning_templates_reuse.sql
```

Migration cho phép `trips.end_date` và `itinerary_items.end_at` để trống, tạo `trip_templates`, RLS và RPC lưu/áp dụng mẫu kế hoạch.

## Kiểm tra sau migration

1. **Thêm → Trạng thái Production** phải hiển thị App/DB `1.4.0` và `stable`.
2. Tạo một chuyến không nhập ngày kết thúc.
3. Tạo hoạt động không nhập giờ kết thúc.
4. Lưu chuyến làm mẫu trong **Thêm → Mẫu kế hoạch & tái sử dụng**.
5. Tạo chuyến mới từ mẫu và xác nhận lịch trình/dự toán được sao chép, ngày được dời đúng.
6. Xác nhận input tiền hiển thị `1.000.000` khi nhập.
7. Dashboard chỉ hiển thị nút ⚡; lịch sử lịch trình chỉ hiển thị khi bấm **Xem lịch sử**.

V1.4.0 dùng service worker cache `tripflow-shell-v140`; sau deploy nên đóng/mở lại PWA nếu trình duyệt vẫn giữ shell cũ.
