# Upgrade TripFlow V1.5.0 — Quick Entry & Command Center

## Database

V1.5.0 **không có migration database mới**. Database tiếp tục ở **V1.4.0** sau khi đã chạy `202609290001_v140_smart_planning_templates_reuse.sql`.

## Nâng source

1. Deploy source V1.5.0 bằng Node 24.x.
2. Không chạy thêm SQL cho V1.5.0.
3. Đóng/mở lại PWA hoặc dùng nút cập nhật để nhận service worker `tripflow-shell-v150`.
4. Vào **Thêm → Trạng thái Production**: App phải là `1.5.0`, DB `1.4.0`, channel `stable`.

## Smoke test

- `Ctrl/Cmd + K` mở Command Center; nút ⚡ nổi hoạt động ở mobile/desktop.
- `Taxi sân bay 350k` → preview khoản chi 350.000, category Di chuyển.
- `chi khách sạn 1tr2` → 1.200.000, category Lưu trú.
- `lịch Ăn sáng 7:30 ngày mai` → activity ngày mai 07:30.
- Lưu nhanh và Lưu & nhập tiếp hoạt động; offline đưa mutation vào queue.
- Recent Quick Entry được giữ riêng theo user/chuyến.
- Viewer không thể ghi Quick Entry nhưng vẫn Search/xem dữ liệu.
