# TripFlow V2.10.0 — Validation

Ngày kiểm tra: 01/11/2026. Source nền: ZIP V2.9.4 Boss gửi. App và DB yêu cầu 2.10.0.

## Đã chạy

- Cài sạch `npm ci`: 103 packages, giữ nguyên stack dependency và nhánh tslib 2.9.1. Build production, TypeScript và manifest offline 42 assets thành công.
- `npm test`: 85/85 qua. Chạy toàn bộ 15 migration trên PGlite, cả lặp lại migration mới.
- Cost sharing: chia đều tất cả không chọn; cố định A 7.000.000 trên tổng 10.740.000 và chỉ chọn B/C/D; bảo toàn tổng nguyên VNĐ, chặn trùng/người ngoài chuyến/vượt tổng; không chia cho người không chọn. Đổi thứ tự danh sách không đổi phần làm tròn.
- SQL: rollback sửa sai, version/idempotency, mã thao tác dùng lại với nội dung khác bị chặn, quyền người ngoài chuyến, giữ cách chia và payer ID sau backup/restore sang chuyến mới.
- Cọc 5.370.000 do A trả trực tiếp: A chịu 7.000.000, chưa trả trực tiếp 1.630.000, bên cung cấp còn nhận 5.370.000. Không có fund_entries tự sinh; không có khoản ứng cần hoàn. Thử hoàn ứng trực tiếp qua RPC bị chặn.
- UI 320/390/430px: tạo/sửa dự toán, hai option, preview, chọn ba người, ghi cọc và Đối chiếu. Chọn quỹ ẩn payer, server lưu payer rỗng và ID null.
- Mô phỏng visual viewport còn thiếu 60px sau tương tác: sheet vẫn bám đáy 844px; hai vòng bàn phím cao 420px + offset 55px rồi blur giữ giá trị cũ: khôi phục đáy. Header/footer/input trong khung, không kéo ngang. Test hit target của nút Hủy/Lưu, kéo ngắn/trả về và từ chối bỏ dirty form.
- Motion: mở có slide-up thật bằng Web Animations; đóng bằng save/cancel/Back có lớp hình ảnh tạm inert trượt xuống, không còn tương tác/focus; kéo tay nắm/header đi theo pointer. Reduced motion bỏ animation. Popup compact và desktop căn giữa.
- Quỹ: đủ năm tab, setup, mức đóng, đóng/hoàn/trả, offline cache, chặn ghi offline. Đặt chỗ/tài liệu: CRUD qua đêm, tên cũ, cache và trạng thái mạng.
- Hồi quy: năm quyền, ẩn thao tác viewer, ví offline/sync, theme, 40 bố cục responsive, xóa chuyến và dọn cache. Không lỗi JavaScript.
- Cập nhật: service worker thật, draft chặn cập nhật, popup nhỏ giữa 320/390/430px, kích hoạt một chạm; giữ queue/theme/view, không reload tab khác.
- QA ảnh xem nội bộ: menu module hai cột có tên/mô tả đầy đủ, short form bottom sheet và màn đối chiếu. Ảnh không đóng gói vào source.

## Giới hạn / trạng thái

HTTP/Auth của browser suite được mô phỏng; SQL chạy PGlite, chưa chạy Supabase/Vercel production. Bàn phím/viewport được mô phỏng trên Chromium; chưa kiểm tra iPhone/Safari thật. Cần UAT trên thiết bị như UPGRADE-V2.10.0.md. Chưa push GitHub/deploy.

## Nâng cấp

Bắt buộc chạy 202611010003_v2100_custom_cost_sharing.sql sau schema 2.9.0 và trước deploy source. Không reset hoặc chạy lại SQL cũ. TXT kèm ZIP có đầy đủ cùng nội dung SQL. Next đề xuất: V2.11.0 — Travel Readiness & Reminders (chưa triển khai).
