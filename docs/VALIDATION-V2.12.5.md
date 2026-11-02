# Xác minh V2.12.5

- `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund`: cài sạch dependency thành công. Không đổi phiên bản dependency.
- `npm test`: 96/96 đạt.
- `npm run test:theme-audit`: đạt; 9 stylesheet, 262 sắc nhấn còn cần ánh xạ. Các sắc nền/ít bão hòa và shadow được giữ trung tính.
- `npm run build`: production build, TypeScript, prerender và sinh manifest service worker V2.12.5 thành công. Build kiểm thử dùng endpoint Supabase giả tại loopback; không có truy cập database sản xuất.
- `TRIPFLOW_PALETTE_TEST=1 npm run test:ui`: đạt với Chromium 153, Auth/HTTP giả lập và SQL PGlite. Preset/custom/reset/persistence, tương phản, module, form chi tiêu, hai nút chi tiêu/Memories cùng gradient và trạng thái nghiệp vụ được kiểm tra.
- Kiểm tra nền body/sidebar/topbar/Command Center/ô nhập/ngữ cảnh có RGB trung tính và không có gradient phủ; icon/chữ nhấn vẫn thay đổi. Kiểm tra tím/custom trên sáng/tối, 320/390/1280px; bảng chọn màu thêm 768px.
- Đã xem ảnh QA Tổng quan sáng và Command Center sáng/tối. Chưa kiểm thử Safari/iPhone thật, chưa push/deploy.
- Database giữ 2.12.0; toàn bộ 18 migration được giữ nguyên so với ZIP đầu vào. Không cần chạy migration mới.
