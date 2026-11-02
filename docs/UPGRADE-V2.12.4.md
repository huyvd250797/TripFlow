# TripFlow V2.12.4 — Full Palette Coverage

Nâng từ ZIP V2.12.3 Boss đính kèm. App 2.12.4; database giữ 2.12.0.

**Không cần chạy migration mới.** Không reset DB hoặc chạy lại SQL đã áp dụng.

## Nội dung sửa

- Command Center: chữ Quick Entry, icon tia sét, màu nhập/placeholder, viền/focus, khối thao tác, biểu tượng, tìm kiếm, ngữ cảnh và các màu phụ dùng palette đang chọn.
- Rà soát màu sắc mặc định ở toàn bộ stylesheet, bao gồm biến màu cũ, trạng thái hover/focus, SVG trong giao diện, viền và bóng. Không giới hạn vào danh sách các component đã biết.
- Thêm generator đọc danh sách CSS từ root layout, theo cả CSS import lồng nhau và thứ tự cascade. Build/dev tự sinh lớp màu cùng bảng sắc độ; `npm run test:theme-audit` phát hiện file sinh ra chưa đồng bộ với CSS.
- Engine ánh xạ các sắc độ có màu sang palette và giữ độ sáng tương đối, alpha; nền sáng/tối, chữ và viền không bị đổi độ sáng tùy tiện. Khởi động và tương tác dùng chung engine. Bảng màu/xem trước chỉ tính bốn biến gradient; toàn bộ sắc độ chỉ được tính khi áp dụng palette.
- Mặc định không kích hoạt lớp override và xóa các biến màu cấu hình. Ảnh/video, icon logo, màu dữ liệu phân loại và các màu trạng thái lỗi/cảnh báo/thành công/kết nối giữ ý nghĩa riêng.

## Triển khai

1. Giữ source V2.12.3 để có thể quay lại và giữ cấu hình môi trường Supabase/Vercel hiện có.
2. Giải nén ZIP mới, mở thư mục source; dùng Node 24.x.
3. Chạy `npm ci`, `npm test`, `npm run test:theme-audit`, `npm run build`.
4. Triển khai source qua repository đang kết nối Vercel theo README. Build đã tự chạy generator, không cần tự sửa CSS sinh ra.
5. Bấm **Cập nhật** khi app báo phiên bản mới, kiểm tra footer V2.12.4. Chọn tím hoặc màu tự chọn và mở Command Center để xác minh chữ/icon/viền không còn xanh mặc định.

Kiểm tra thêm trên iPhone/PWA thực tế. Muốn quay lại màu gốc, bấm Mặc định. Muốn rollback bản app, triển khai lại source V2.12.3; không rollback database.

## Khi phát triển thêm

Màu nhận diện trong CSS mới sẽ được quét khi CSS được import vào root layout hoặc qua CSS khác. Với inline styles hoặc màu do dữ liệu cung cấp, dùng biến palette (`--primary`, `--palette-gradient`, `--brand-surface`) thay vì thêm giá trị màu thương hiệu cố định. Không dùng màu dữ liệu biểu đồ làm màu thương hiệu.

Xem `docs/THEME-COVERAGE.json` cho số lượng file/màu/declaration đã quét. File `app/palette-generated.css` và `lib/palette-tones.js` được sinh từ source; không chỉnh tay.

Tiếp theo giữ nguyên **V2.13.0 — Group Expenses & Settlement**: công nợ cá nhân, chuyển tiền và quyết toán nhóm.
