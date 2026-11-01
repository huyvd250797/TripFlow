# Validation — V2.12.0

Nền: ZIP V2.11.0 do Boss gửi. Không push/deploy hoặc chạy SQL production.

- TypeScript và production build đạt. Kiểm tra cài dependency sạch bằng npm ci trước đóng gói; giữ nguyên dependency/lockfile đã khóa.
- `npm test`: 92/92 đạt. Thêm kiểm tra preview giữ mốc cố định/lịch sử, truyền độ lệch thời lượng, chặn tự đổi ngày và vượt giới hạn, phân biệt thiếu thời gian/chưa biết chặng, URL mã hóa đúng, optimistic offline transaction.
- PostgreSQL/PGlite chạy mọi migration: dời nhóm atomic, replay operation, rollback khi vi phạm giới hạn hoặc stale wishlist, context version conflict, RLS Viewer/outsider, Editor ghi đúng, không gọi được wrapper cũ trực tiếp. Backup/restore và mẫu kế hoạch remap chặng/giới hạn/phương án B; reapply migration mới không mất dữ liệu.
- Browser/Chromium dùng app thật + PostgreSQL/PGlite, mô phỏng Supabase Auth/HTTP: đăng nhập light/dark ở 320/390/430/1280; border form mobile 0px, input nằm trong viewport. Luồng xác thực đăng nhập thành công.
- Browser luồng V2.12: dời Breakfast từ 60→90 phút, điểm linh hoạt sau dời 30 phút, Tour cố định giữ nguyên; khai báo chặng 20 phút + 10 dự phòng; wishlist/phương án B và lịch sử điểm cũ; từ chối kế hoạch stale; lưu batch offline và sync lại; sheet vừa khung ở 320/390/768/1280; Viewer không có nút ghi.
- Hồi quy Cost Sharing/Sheet: chia chọn người/cố định + phần còn lại, cọc 50%, ẩn payer quỹ, thanh toán trực tiếp, Báo cáo, native first scroll, bám đáy/drag/motion và Quick sát taskbar đạt.
- Hồi quy Packing: mẫu hành lý, cá nhân, ngày DD/MM/YYYY, liên hệ, gia đình, offline, progress và Viewer đạt.
- Hồi quy Bookings/Module Hub đạt: một picker, 15 module, tên đầy đủ, đặt chỗ qua đêm, tài liệu CRUD, offline read và kết nối. Service worker update đạt: popup compact, chặn khi draft, bấm một lần kích hoạt/cập nhật, giữ queue/theme/view và không ép reload tab khác.

Giới hạn: Chromium mô phỏng viewport, chưa kiểm thử iPhone/Safari thật. PGlite và mock Auth/HTTP không thay thế Supabase staging/production, Realtime và cấu hình tài khoản thực. Không gọi điện, mở chỉ đường hoặc đổi tài khoản thật trong QA. Thời gian di chuyển nhập tay, không có route optimization/giao thông trực tiếp.

ZIP loại build output, node_modules, ảnh QA, log và env thật. Giữ nguyên 17 SQL cũ; thêm đúng một SQL mới, TXT riêng chứa nguyên nội dung SQL đó. Source version/app/DB 2.12.0; tiếp theo V2.13.0 — Group Expenses & Settlement.
