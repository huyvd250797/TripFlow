# Xác minh V2.12.4 — Full Palette Coverage

Nền source: ZIP V2.12.3 Boss đính kèm trong yêu cầu sửa màu Command Center.

## Kết quả

- Node 24.x; dependency graph giữ nguyên V2.12.3. App/lockfile tăng 2.12.4; không nâng thư viện.
- `npm test`: **96/96 đạt**. Thêm test ánh xạ toàn bộ sắc độ với tím, trắng, đen và cam tự chọn; sai lệch độ sáng tương đối sau lượng tử hóa RGB dưới 0,006. Giữ kiểm tra mã màu không hợp lệ, tương phản gradient, bootstrap tương đương runtime và dữ liệu storage bị chặn/hỏng.
- `npm run test:theme-audit`: đạt. Quét **9 stylesheet, 716 sắc độ, 1.608 declaration và 977 selector**. Có cả rule bảo vệ màu trạng thái để rule nền chung không ghi đè trạng thái cảnh báo.
- `npm run build`: build sạch Next.js/webpack, TypeScript, static pages và service worker thành công. Offline shell V2.12.4 có 46 assets.
- Chromium UI với app production và PostgreSQL/PGlite, giả lập Supabase Auth/HTTP: preset/custom, save/cancel/reset, reload, sáng/tối; bảng màu vừa 320/390/768/1280px.
- Các màn Tổng quan, Lịch trình, Chi phí, Media và form chi tiêu được kiểm tra ở 320/390/1280 với tím/custom, cả sáng/tối. Hai nút Ghi chi tiêu cùng computed gradient; Memories/budget banner dùng màu đang chọn.
- Mở từng module hiển thị cho tài khoản owner kiểm thử ở mobile sáng/tối; kiểm tra containment các nút.
- **Command Center:** mở thực tế ở 390/1280 với tím và custom, sáng/tối; so sánh computed color/background/border với trạng thái mặc định cho Quick Entry, icon input, viền input, ô icon thao tác, nhãn thao tác và khối ngữ cảnh. Mỗi điểm được kiểm tra phải thực sự đổi màu; không chỉ kiểm tra thuộc tính palette trên root. Đã xem ảnh QA Command Center desktop sáng/tối.
- Kiểm tra màu semantic: xác nhận xóa, cảnh báo, kết nối/offline, vượt ngân sách và command không hợp lệ giữ màu được khai báo riêng. Màu chữ trung tính kế thừa được phép nhận palette; không coi màu chữ kế thừa ở chấm trạng thái rỗng là màu semantic.
- Không có JavaScript page errors trong kiểm tra UI.
- Đối chiếu byte: đủ **18 migration SQL** và các icon SVG/PNG giữ nguyên. Database **2.12.0**, không cần migration mới. Lockfile giữ nguyên dependency graph.

## Giới hạn

Chưa kiểm tra trên Safari/iPhone/PWA thật hoặc Supabase production. Chưa push GitHub/deploy trong lần bàn giao này. Ảnh QA chỉ dùng nội bộ và không nằm trong source ZIP.

## Chạy lại

```bash
npm ci
npm test
npm run test:theme-audit
npm run build
```

UI theo `docs/TESTING.md`, server production dùng môi trường kiểm thử:

```bash
UI_BASE_URL=http://127.0.0.1:3000 TRIPFLOW_PALETTE_TEST=1 npm run test:ui
```

Đặt `CHROMIUM_PATH` nếu cần. Không chạy harness với dữ liệu Supabase production.
