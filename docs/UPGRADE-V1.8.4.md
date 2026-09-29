# Upgrade TripFlow V1.8.4 — Google Maps Coordinate Integrity Fix

V1.8.4 là bản PATCH frontend/API. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Lỗi được sửa

1. Link `maps.app.goo.gl` bị tự thay thành URL tọa độ sau khi lưu, làm form chỉnh sửa không còn link gốc người dùng paste.
2. Resolver có thể lấy nhầm cặp tọa độ không phải địa điểm từ HTML Google hoặc lấy `@lat,lng` viewport trước tọa độ địa điểm `!3d/!4d`, dẫn đến mở bản đồ sai vị trí.

## Hành vi sau fix

- `map_url` được lưu nguyên văn như người dùng nhập.
- Tọa độ chỉ được resolve ngầm khi Map/Route Intelligence cần dùng.
- Short link được mở bằng GET như trình duyệt.
- Tọa độ địa điểm `!3d/!4d` có độ ưu tiên cao hơn viewport `@lat,lng`.
- HTML chỉ được dùng nếu tìm thấy URL Google Maps đáng tin cậy trong canonical/og:url/meta refresh/JS redirect.

## Deploy

1. Deploy source V1.8.4.
2. Không chạy migration SQL mới.
3. Reload/PWA refresh để nhận `tripflow-shell-v184`.
4. Test link La Vague: `https://maps.app.goo.gl/YVvszUd4AFD1VXPt6?g_st=ic`.
5. Xác nhận form chỉnh sửa vẫn giữ nguyên short link và Map view mở đúng khu vực Nha Trang.
