# Kiểm tra V2.9.2

- 83/83 unit/integration test đạt; nghiệp vụ SQL quỹ giữ nguyên và không có migration mới.
- Browser: block xanh bốn chỉ số hiện trên cả ba tab, trạng thái chưa thiết lập quỹ, cập nhật số dư sau giao dịch, bỏ KPI trùng trong Ví, ghi chi từ quỹ và đọc offline.
- Quỹ: nhóm chín người; tìm theo tên; thiết lập quỹ; đặt mức đóng/hạn; màn nhập không chứa danh sách nền; thu tiền, hoàn ứng, trả quỹ; giữ số dư 680.000 sau khoản chi 150.000. Kiểm tra responsive 320/390/430/1280, không tràn popup; danh sách không có vùng cuộn lồng, nhập VNĐ có phân cách hàng nghìn; giao dịch cần online. Đã xem ảnh render form và danh sách.
- Regression: 40 tổ hợp màn hình/kích thước/theme, quyền Owner/Viewer, ví offline/sync, đổi theme, xóa chuyến/dọn cache và không lỗi JS.
- Cài sạch bằng npm ci; production build/TypeScript và sinh service worker manifest. Giữ lockfile đã sửa ở V2.9.1, có tslib 2.9.1 trong nhánh @swc/helpers.

Browser dùng Chromium, HTTP/Auth mock, SQL/PGlite; chưa nghiệm thu Safari/PWA iPhone thật, bàn phím iOS hoặc triển khai Vercel/Supabase của Boss. Ảnh kiểm thử không nằm trong ZIP. Hướng dẫn nâng cấp: UPGRADE-V2.9.2.md; App 2.9.2 / DB 2.9.0.
