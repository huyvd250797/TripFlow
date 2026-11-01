# TripFlow V2.10.1 — Validation

Ngày kiểm tra: 01/11/2026. Nền: ZIP V2.10.0 Boss gửi. App/DB 2.10.1.

## Kết quả

- npm ci sạch: 103 packages. Giữ stack và nested tslib 2.9.1. Build production + TypeScript + manifest offline thành công.
- npm test: 85/85 qua. Toàn bộ 16 migration chạy trên PGlite; chạy lại migration mới giữ dữ liệu và readiness.
- selected_equal: chỉ người được chọn nhận phần; không có fixed; tổng 10.740.000 chia B/C/D bằng 3.580.000 mỗi người. Danh sách rỗng, trùng, ngoài chuyến bị chặn; chặn xóa người đang tham chiếu. Hai mode trước giữ hành vi. Backup/restore ánh xạ người được chọn sang ID mới đúng tên.
- UI: chọn ba người và lưu xuống SQL; Báo cáo có bảng Phân chia chi phí, Đối chiếu không có; khai báo vẫn ở Dự toán. Mẫu A chịu 7 triệu/cọc 5,37 triệu vẫn đúng; dùng quỹ ẩn payer, trả trực tiếp không tạo hoàn ứng.
- Header module sheet cộng tay nắm <=66px, nút đóng giữ 36px; kiểm tra nội bộ ảnh dark mode, không cắt tên module. Sáng/Tối và 320/390/430/1280px trong các bộ hồi quy.
- Touch: mở sheet mới, không scroll warm-up; gửi một chuỗi touchStart/touchMove/touchEnd thật qua Chrome DevTools Protocol. scrollTop tăng ngay ở lần vuốt đầu; clientWidth vùng nội dung giữ nguyên. Cuộn native được cấp pane/gutter từ đầu, chạm nội dung không bị drag handler giữ. Không đo frame rate trên iPhone.
- Quick: drag expanded xuống gần taskbar, khoảng cách đo 5–7px (mục tiêu 6px); side snap, lưu vị trí, collapsed arrow và resize trong bộ hồi quy. Tính giới hạn bằng rect taskbar thay offset 110/120px.
- Sheet: theo pointer, mở trượt lên/đóng xuống, giảm chuyển động, dirty từ chối đóng, busy/error/retry/focus; giữ bám đáy qua vòng bàn phím 420px + offset 55px và stale visual viewport thiếu 60px.
- Quỹ/đặt chỗ: setup, đóng/hoàn/trả, nguồn tiền, cache offline, khóa ghi offline, đặt chỗ qua đêm và tài liệu CRUD.
- Regression: năm quyền, viewer visibility, ví offline+sync, 40 bố cục responsive, theme, xóa chuyến/dọn cache, không lỗi JavaScript.
- Cập nhật: service worker thật, popup nhỏ giữa 320/390/430px, draft chặn cập nhật, giữ queue/theme/view và không reload tab khác.

## Giới hạn

Browser suite chạy Chromium, SQL PGlite, Auth/HTTP mô phỏng. Chưa xác minh Safari/iPhone thật hoặc Supabase/Vercel production. Đã tối ưu cơ chế cuộn đầu; kết quả touch mô phỏng không phải cam kết tốc độ khung hình trên thiết bị. Cần UAT theo UPGRADE-V2.10.1.md. Ảnh QA không nằm trong ZIP. Chưa push/deploy.

## Nâng cấp

Chạy 202611010004_v2101_selected_cost_sharing.sql sau schema V2.10.0 và trước deploy app. Không reset / chạy lại SQL cũ. TXT kèm ZIP trùng toàn bộ SQL. Đề xuất tiếp V2.11.0 — Travel Readiness & Reminders, chưa xây dựng.
