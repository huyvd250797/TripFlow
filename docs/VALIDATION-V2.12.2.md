# Xác minh V2.12.2

Nền: ZIP TripFlow V2.12.1 — Mobile Layout & Interaction Polish do Boss cung cấp.

- `npm ci --ignore-scripts` hoàn tất với lockfile hiện có; không nâng dependencies. Node 24.x theo package.json.
- `npm test`: **95/95** đạt. Bao gồm 92 test cũ và 3 test về màu: dữ liệu không hợp lệ, chống chèn CSS, tương phản màu cực sáng/tối và bootstrap khôi phục màu tương đương runtime.
- `npm run build`: production Next.js/webpack, TypeScript, static pages và service worker thành công. Build cuối từ thư mục build sạch; offline shell V2.12.2 có 44 assets.
- UI Chromium với app production thực và PostgreSQL/PGlite, giả lập Supabase Auth/HTTP: 5 bảng màu bổ sung, đổi sáng/tối, containment ở 320/390/768/1280px; mã HEX sai khóa Lưu, tùy chỉnh trắng/tím, Hủy không áp dụng nháp, lưu qua reload, Mặc định xóa override và trả đúng gradient ban đầu; khối Chi phí dùng màu đã chọn; logo nền icon; không có JavaScript page errors.
- Hồi quy layout V2.12.1: sáng/tối 320/390/430/768/1280px; thanh view lịch trình, chuẩn bị, icon điều phối, sheet phân chia, cuộn lần đầu, thông báo tải lại thành công/thất bại đều đạt. Assertion logo cập nhật theo yêu cầu mới có nền icon.
- Đối chiếu byte: giữ nguyên đủ **18 migration SQL**, icon SVG và PNG cài đặt; database giữ **2.12.0**. Không cần migration mới.

Giới hạn: kiểm tra UI dùng Chromium và transport Supabase giả lập, chưa xác minh trên Safari/iPhone/PWA thật hoặc Supabase production. ZIP chưa được push GitHub/deploy trong lần bàn giao này.

## Tự chạy kiểm tra UI

Cần build với các biến môi trường kiểm thử, không dùng dự án Supabase production. Xem thêm harness và yêu cầu trong `docs/TESTING.md`. Chạy server production, sau đó:

```bash
UI_BASE_URL=http://127.0.0.1:3000 TRIPFLOW_PALETTE_TEST=1 npm run test:ui
UI_BASE_URL=http://127.0.0.1:3000 TRIPFLOW_LAYOUT_TEST=1 npm run test:ui
```

Nếu Chromium không ở vị trí Playwright mặc định, đặt `CHROMIUM_PATH` đến executable có sẵn.
