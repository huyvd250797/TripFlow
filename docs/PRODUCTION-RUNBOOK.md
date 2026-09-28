# TripFlow V1.0.0 — Production Runbook

## Trước khi deploy

- Chốt commit/tag source V1.0.0; Node.js 24.x.
- `npm ci`, `npm test`, `npm run typecheck`, `npm run build` phải đạt trên CI/staging.
- Xác nhận Supabase/Vercel environment variables trỏ đúng Production.
- Xác nhận backup/PITR theo gói Supabase và có phương án rollback frontend.
- Chạy toàn bộ migration còn thiếu theo thứ tự, cuối cùng là `202609280005_v100_stable_production_release.sql`.

## Smoke test sau deploy

1. Đăng nhập Owner → tải danh sách/chuyến đi.
2. **Thêm → Trạng thái Production**: app/database `1.0.0`, channel `stable`, `Production sẵn sàng`.
3. Tạo một chuyến test hoặc dùng chuyến staging riêng: thêm activity, budget và expense; mở Finance report.
4. Kiểm tra check-in + history; mở thiết bị/tab thứ hai để xác nhận Realtime hoặc refetch fallback.
5. Kiểm tra PWA update/offline shell; API/Auth không xuất hiện trong Cache Storage.
6. Tạo backup test, tải recovery JSON, xác nhận Operations Health không có cảnh báo bất thường.
7. Đăng nhập Master thử nghiệm, kiểm tra user/trip và account gate; không thay đổi user thật nếu không cần.

## Theo dõi

- Vercel: 5xx, latency, function errors, deployment health.
- Supabase: database/Auth/Realtime health, connection/resource usage, RLS/RPC errors.
- Khi điều tra API, dùng `X-Request-Id` để nối log.
- Không log token, password hoặc toàn bộ payload tài chính.

## Rollback

- Frontend: rollback về deployment V0.9.0 hoặc deployment Stable gần nhất đã biết tốt.
- Database: migration V1.0.0 chỉ marker/readiness, nên không cần rollback DB khi chỉ rollback frontend.
- Nếu lỗi đến từ migration sửa chữa sau V1.0.0, dừng ghi nếu cần, backup trạng thái hiện tại và kiểm tra rollback trên staging trước.

## Sự cố dữ liệu

- Không UPDATE trực tiếp snapshot/audit/history để che lỗi.
- Dùng Backup & Recovery nếu phạm vi phù hợp; restore backup luôn tạo chuyến mới.
- Với lỗi quan hệ/tổng tiền/RLS, tạo repair migration/script có điều kiện, log trước/sau và kiểm thử staging.


## V1.1.0 UI/brand release

V1.1.0 không thay đổi database. Production readiness hợp lệ khi **App 1.1.0 / DB 1.0.0 / stable** và các guard đều đạt. Rollback frontend về V1.0.0 không yêu cầu rollback database.

## V1.2.0 Smart Workspace release

V1.2.0 không thay đổi database. Production readiness hợp lệ khi **App 1.2.0 / DB 1.0.0 / stable** và các guard đều đạt. Sau deploy, xác nhận service worker `tripflow-shell-v120`, test search/quick actions ở mobile thật và có thể rollback frontend về V1.1.1 mà không rollback database.
