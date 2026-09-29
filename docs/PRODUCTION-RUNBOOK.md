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


## V1.3.0 Media storytelling release

Chạy `202609280006_v130_media_memories_storytelling.sql` trước khi deploy frontend V1.3.0. Sau deploy xác nhận `tripflow-shell-v130`, Production Readiness App/DB 1.3.0, Realtime `media_links`, một-cover-per-trip và restore backup. Không rollback schema bằng cách drop cột.

## V1.4.0 Smart Planning release

Chạy `202609290001_v140_smart_planning_templates_reuse.sql` sau V1.3.0 rồi deploy frontend V1.4.0. Xác nhận Production Readiness App/DB 1.4.0, bảng `trip_templates` bật RLS, RPC save/apply template tồn tại, `trips.end_date` và `itinerary_items.end_at` nullable, và service worker `tripflow-shell-v140` đã active.

## V1.5.0 Quick Entry release

V1.5.0 không có migration database. Deploy frontend V1.5.0 sau khi database đã ở V1.4.0, xác nhận **Trạng thái Production** hiển thị App 1.5.0 / DB 1.4.0 / stable, thử `Ctrl/Cmd + K`, Quick Entry và offline queue. Service worker mới là `tripflow-shell-v150`.

## V1.5.1 Deploy Typecheck Fix

V1.5.1 là patch frontend, không có migration. Deploy source bằng Node 24.x trên Database V1.4.0, xác nhận App `1.5.1` / DB `1.4.0` / stable và service worker `tripflow-shell-v151`. Chạy `npm run build` trước production để xác nhận hai lỗi type-check của V1.5.0 không tái phát.


## V1.6.0 Smart Defaults & PWA taskbar

V1.6.0 không có migration; deploy App 1.6.0 trên Database 1.4.0. Sau deploy xác nhận `tripflow-shell-v160`, mở PWA standalone và scroll dài để bottom taskbar luôn sát đáy. Kiểm tra Quick dock thu/mở và Module Hub trong tab Thêm.


## V1.7.0 Planning Board & Timeline Pro

V1.7.0 không có migration. Deploy App 1.7.0 trên Database 1.4.0, xác nhận `tripflow-shell-v170`, kiểm thử Board trên desktop/mobile, Finance Actual header ở 320/390 px và hành vi kéo Quick sang phải trong PWA standalone.

## V1.8.0 Map, Places & Route Intelligence

V1.8.0 không có migration. Deploy App 1.8.0 trên Database 1.4.0, xác nhận `tripflow-shell-v180`, kiểm tra chế độ Bản đồ trên itinerary và bottom taskbar ở PWA standalone. Route Intelligence chỉ là ước tính nội bộ; khi cần tuyến thực tế người dùng mở Google Maps qua link do app tạo.

## V1.8.1 Map/Media/PWA patch

V1.8.1 không có migration. Deploy App 1.8.1 trên Database 1.4.0, xác nhận `tripflow-shell-v181`. Route `/api/maps/resolve` chỉ outbound đến HTTPS Google domains đã allow-list để mở rộng link Maps rút gọn. Preview Google Drive phụ thuộc quyền và khả năng nhúng của nguồn; luôn giữ nút Mở nguồn làm fallback.


## V1.8.2 Google Maps Share & Media Zoom patch

V1.8.2 không có migration. Deploy App 1.8.2 trên Database 1.4.0 và xác nhận `tripflow-shell-v182`. Route `/api/maps/resolve` chỉ theo redirect trong allow-list Google; khi tìm được tọa độ sẽ trả URL chuẩn `query=lat,lng`. Toàn app khóa browser pinch zoom; viewer ảnh dùng zoom nội bộ nên cần test trên thiết bị thật.

## V1.8.3 Google Maps short-link resolver patch

V1.8.3 không có migration. Deploy App 1.8.3 trên Database 1.4.0 và xác nhận `tripflow-shell-v183`. Resolver sử dụng raw Node HTTPS để đọc Location của `maps.app.goo.gl`; nếu có tọa độ trong URL redirect thì trả ngay, không truy cập trang Maps đích. Khi cần chẩn đoán, dùng `/api/maps/resolve?url=<encoded>&debug=1` trong phiên đăng nhập để xem hop/status/Location.
