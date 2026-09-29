# Upgrade TripFlow V1.8.3 — Google Maps Short Link Resolver Fix

V1.8.3 là bản PATCH API/frontend. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Mục tiêu

Người dùng chỉ cần Google Maps → **Chia sẻ** → **Sao chép đường liên kết** và dán link `https://maps.app.goo.gl/...` vào TripFlow. Không yêu cầu URL dài hoặc tọa độ thủ công.

## Thay đổi kỹ thuật

- `/api/maps/resolve` chạy `runtime = nodejs`.
- Dùng raw Node HTTPS để giữ nguyên status/header redirect trên môi trường Vercel.
- Mỗi hop thử `HEAD`, sau đó `GET` nếu cần; `Location` được parse **trước** khi quyết định follow tiếp.
- Hỗ trợ `Location`, `Refresh`, canonical, `og:url`, meta refresh, JavaScript redirect và URL Maps trong HTML.
- Decode URL/HTML escape nhiều lớp; allow-list chỉ các host Google Maps/Google HTTPS được phép.
- `debug=1` trả trace gồm hop, method, status, URL và Location để xác định lỗi deploy.

## Acceptance bắt buộc

Với redirect của link mẫu:

`https://maps.app.goo.gl/ySoEVvZNbrSWqu168`

TripFlow phải trả:

- Latitude: `12.2200647`
- Longitude: `109.2036555`
- Normalized URL: `https://www.google.com/maps/search/?api=1&query=12.2200647,109.2036555`

Resolver phải hoàn tất ngay khi thấy tọa độ trong `Location`, không cần request trang Google Maps đích.

## Deploy

1. Deploy source V1.8.3.
2. Không chạy SQL migration mới.
3. Reload/PWA refresh để nhận `tripflow-shell-v183`.
4. Đăng nhập và lưu một activity bằng link `maps.app.goo.gl`.
5. Mở tab Bản đồ; xác nhận activity được tính là có tọa độ.
6. Nếu chưa được, gọi `/api/maps/resolve?url=<encoded-link>&debug=1` trong phiên đã đăng nhập và xem trace.
