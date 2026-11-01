# Kiểm tra V2.9.3 — Mobile Layout & Interaction Fix

- `npm ci` cài sạch: 103 package; kiểm tra lại `npm ci --dry-run` sau tăng version đạt. Giữ tslib 2.9.1 ở nhánh @swc/helpers, không quay lại lockfile lỗi trước đây.
- Production webpack build và TypeScript đạt; sinh manifest service worker V2.9.3 với 42 tài nguyên. `npm test`: 83/83 đạt.
- Browser quỹ: năm tab đúng thứ tự, banner luôn hiện; hai ô hàng dưới và hai KPI Ví cùng hàng; tìm người, đặt mục tiêu/hạn, thu quỹ, hoàn ứng, trả quỹ, ghi chi từ quỹ; số dư cập nhật 680.000 trong fixture. Người giữ là select từ người tham gia. Kiểm tra responsive 320/390/430/1280, sáng/tối, cache offline và khóa giao dịch quỹ offline.
- Browser mobile: modal chiều cao visual viewport 844px, x=0; bottom nav ẩn khi mở. Input/select/date ở 320/390/430 nằm trong bounds modal, không có overflow ngang. Kiểm tra vị trí Hủy trước/trái Lưu, form chi tiêu có Thêm chi tiết, không có banner Smart Defaults, input không tràn. Đã xem ảnh render mobile thực tế của fixture.
- Quick: kéo nút mở sang mép trái; không mở nhầm popup khi thả; thu về mũi tên rộng tối đa 28px; kéo mũi tên sang mép phải; mở lại và chạm để mở Command Center. Đã kiểm tra command modal fullscreen.
- Browser đặt chỗ: lưới module, CRUD đặt chỗ/tài liệu, chọn người đứng tên, nhận/trả qua đêm, layout chi tiết 320/390/430/1280, offline cache và chỉ báo kết nối. Tên cũ không thuộc danh sách không bị mất khi lưu thay đổi khác.
- Regression: 40 tổ hợp màn hình/kích thước/theme, Owner cấp quyền, Viewer, ví offline/sync, xóa chuyến/dọn cache, không lỗi JS.
- Service Worker thật: cài đầu an toàn, bản nháp chặn cập nhật, áp dụng phiên bản bằng một nút, giữ queue/theme/view, không ép reload tab khác.

Auth/HTTP browser dùng mock; nghiệp vụ DB dùng PostgreSQL/PGlite. Chưa triển khai hoặc chạy trên Supabase/Vercel của Boss, chưa xác minh Safari/PWA iPhone thật và bàn phím iOS. Các hộp thoại hệ thống do trình duyệt quản lý không thay đổi bố cục của hệ điều hành. Cần smoke test thiết bị thật theo UPGRADE-V2.9.3.md. Không có migration mới; DB giữ 2.9.0.
