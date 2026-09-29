# Upgrade TripFlow V1.5.1 — Deploy Typecheck Fix

V1.5.1 là bản PATCH sửa lỗi build của V1.5.0. **Không có migration database mới**.

## Lỗi đã sửa

1. `components/tripflow.tsx`: `data` có thể `undefined` trước khi Bundle được tải.
2. `tests/domain.test.ts`: test dùng `dateLabel` nhưng thiếu import.

## Triển khai

1. Deploy source V1.5.1 bằng Node 24.x.
2. Không chạy SQL mới; database tiếp tục ở V1.4.0.
3. Đóng/mở lại PWA hoặc cập nhật để nhận `tripflow-shell-v151`.
4. Chạy `npm run build` và `npm test` trước production.
