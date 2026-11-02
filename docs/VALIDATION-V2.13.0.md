# Xác minh TripFlow V2.13.0 — Group Expenses & Settlement

## Môi trường và nguồn

Nguồn đúng ZIP Boss gửi: TripFlow-V2.12.3-Complete-Theme-Consistency(1).zip. Dùng Node 24.x, giữ nguyên dependency versions. Không đưa thay đổi bảng màu từ V2.12.4/V2.12.5 vào source này.

## Kết quả

- `npm ci --prefer-offline --no-audit --no-fund`: cài dependency sạch thành công (không dùng node_modules của lần kiểm tra trước).
- `npm test`: **97/97 đạt**. Bộ SQL/PGlite áp dụng cả 19 migration.
- Production build Next.js/webpack và TypeScript thành công; SW V2.13.0 sinh 45 assets, gồm module lazy.
- Bộ mới kiểm tra: số dư 900.000 / 3 người; chuyển một phần; số tiền vượt dư; stale revision; replay cùng ID và từ chối tái dùng ID khác nội dung; hủy; role/RLS; quyền chốt độc lập, chống self-grant và lời mời truyền quyền; quỹ dư dùng sổ quỹ cũ; quỹ + cá nhân ứng + hoàn một phần + chuyển tiền; chốt/mở lại; chặn ghi qua app cũ; khôi phục bản đã chốt với ID mới; chạy lại migration không mất dữ liệu; cọc 50% / phần cố định; refund và khoản chưa liên kết không tự chia.
- `TRIPFLOW_SETTLEMENT_TEST=1 npm run test:ui`: đạt. Thao tác thật trên UI với PostgreSQL/PGlite và Auth/HTTP mô phỏng: Theo người/Chuyển tiền/Lịch sử, 320/390/768/1280px sáng/tối, trả một phần, hủy, stale snapshot, chốt/mở lại, offline read và Viewer không có nút chốt. Đã xem ảnh QA sáng/tối, sửa lỗi cascade dl ép số liệu thành hai cột hẹp trên mobile.
- `npm run test:ui` (không cờ): đạt. Quyền thành viên (cập nhật kỳ vọng thành 6 quyền), ví offline/đồng bộ, theme, xóa chuyến/cache và 40 bố cục hồi quy.
- `TRIPFLOW_COST_TEST=1 npm run test:ui`: đạt. Chia tiền, cọc, báo cáo, sheet, cuộn cảm ứng lần đầu, Quick dock và khôi phục viewport.
- `TRIPFLOW_FUND_TEST=1 npm run test:ui`: đạt. Người giữ quỹ, mục tiêu/đóng/hoàn/trả, năm tab tài chính, sheet và bàn phím, offline guards.
- `npm run test:update:ui`: đạt. Service worker thật, popup cập nhật, chặn draft, cập nhật một lần, giữ queue/theme/view và không reload tab khác.

## Giới hạn

- UI chạy trên Chromium 153; Auth/HTTP mô phỏng, SQL thật qua PGlite, không thay cho staging Supabase.
- Chưa thử Safari/iPhone thật, chưa push GitHub/deploy, chưa chạy migration trên database thật của Boss.
- Build kiểm thử dùng URL/khóa Supabase giả ở loopback. ZIP chỉ chứa source; Boss giữ biến môi trường production hiện có và build lại khi deploy.
- Quyết toán là ghi sổ, không đối soát ngân hàng; xác nhận/chốt cần online. Offline chỉ đọc snapshot đã tải; chốt chặn queue trên thiết bị đang dùng, không thể biết trước queue chưa gửi ở thiết bị khác.
- Dự toán chưa thanh toán đủ là mục cần đối chiếu trước khi chốt; không tự coi mọi dự toán là hóa đơn thực tế. Cần sửa dự toán cuối nếu khoản không còn phát sinh.
