# Validation — V2.11.0

Thực hiện trên source nâng từ ZIP V2.10.1 do Boss cung cấp. Không push GitHub, không deploy và không chạy SQL trên database production.

## Kết quả

- `npm ci`: cài sạch thành công, 103 packages. Lockfile giữ nguyên các dependency đã khóa, bao gồm nested tslib 2.9.1.
- `npm run build`: Next.js production build và TypeScript đạt; service worker manifest có các lazy module của bản mới.
- `npm test`: **88/88 đạt**. Bộ kiểm tra PostgreSQL/PGlite chạy toàn bộ migration theo thứ tự, có các kiểm tra mới về checklist, template atomic/idempotent, rollback toàn batch khi người phụ trách không hợp lệ, version conflict, RLS, Owner/Editor/Viewer, tài khoản bị khóa và backup/restore ánh xạ người mới. Giữ metadata gia đình khi request participant cũ không gửi trường mới.
- Browser integration V2.11 (Chromium + PostgreSQL/PGlite; mô phỏng Auth/HTTP): mở module, áp dụng mẫu cá nhân 11 mục, sửa ngày DD/MM/YYYY/số lượng, lọc Của tôi/Chưa xong, đóng gói/không áp dụng, tạo và hoàn tất công việc, liên hệ gọi điện/bản đồ, nhóm tuổi/nhu cầu, offline → đồng bộ, Tổng quan trước chuyến đi, khôi phục màn hình và Viewer chỉ xem. Input nằm trong sheet ở 320/390/768/1280px, sáng/tối.
- Hồi quy Cost Sharing/Sheet: ba cách chia, tiền phòng 10.740.000/A chịu 7 triệu/phần còn lại chia chọn người, cọc 50%, ẩn payer khi dùng quỹ, thanh toán trực tiếp, vị trí báo cáo, scroll/drag/animation và khôi phục viewport bị lệch đạt.
- Hồi quy Bookings/Module Hub: một picker Thêm duy nhất, 15 module, tên đầy đủ được xuống dòng, quản lý module, đặt chỗ qua đêm, tài liệu create/edit/delete, cache offline và trạng thái kết nối đạt.
- Hồi quy cập nhật app: popup compact, chặn cập nhật khi có draft, bấm cập nhật một lần kích hoạt service worker, giữ queue/theme/view; tab khác không bị tự reload.

## Giới hạn xác minh

Đã mô phỏng kích thước/cảm ứng/bàn phím bằng Chromium, chưa chạy iPhone/Safari thật. Supabase Auth, Realtime và cấu hình production cần UAT tại môi trường Boss sau migration; PGlite không mô phỏng toàn bộ vận hành Supabase. Link tel/map được kiểm tra URL, không thực hiện cuộc gọi thật. Không có dữ liệu production được đưa vào source.

## Kiểm tra bàn giao

ZIP loại node_modules, build output, test screenshot, log và env thật. Các SQL cũ giữ nguyên byte; chỉ thêm `202611010005_v2110_packing_checklist_family.sql`. TXT ngoài ZIP chứa đầy đủ đúng nội dung SQL mới, có hướng dẫn bằng comment để copy chạy trực tiếp. README, CHANGELOG và ROADMAP cập nhật phiên bản; kế tiếp V2.12.0 — Flexible Itinerary & Route Planning.
