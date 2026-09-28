# Nâng cấp TripFlow V1.0.0 → V1.1.0

V1.1.0 là **Brand Refresh, Professional UI & Travel Identity**. Bản này tập trung giao diện và nhận diện thương hiệu, **không thay đổi schema hoặc dữ liệu nghiệp vụ**.

## Database

Không có migration V1.1.0. Database chỉ cần đã đạt Stable V1.0.0 (`202609280005_v100_stable_production_release.sql`).

Release-readiness ở V1.1.0 tách hai khái niệm:

- App version: `1.1.0`
- Database compatibility version: `1.0.0`

Vì vậy không tạo marker database giả chỉ để khớp version UI.

## Thay đổi chính

- Logo/app icon mới: Location Pin + Travel Route.
- Splash loading có brand animation, tagline và route progress.
- Ocean Teal + Sunset design system; refresh sidebar/topbar/bottom nav, card, button, form, modal, auth và dashboard.
- Service worker shell `tripflow-shell-v110`.
- Roadmap 1.x được mở, V1.2.0 là phiên bản tiếp theo.

## Deploy

1. Không chạy SQL mới.
2. Deploy source V1.1.0 bằng Node 24.x.
3. Hard refresh hoặc đóng/mở PWA để service worker nhận shell V1.1.0.
4. Kiểm tra app icon, splash, auth, desktop shell và mobile bottom dock.
5. Vào **Thêm → Trạng thái Production**: App phải là 1.1.0, DB 1.0.0, channel stable và các guard đạt.

## Rollback

Có thể rollback frontend về V1.0.0 mà không rollback database vì V1.1.0 không có migration.
