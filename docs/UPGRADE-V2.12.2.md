# TripFlow V2.12.2 — Gradient Themes & App Icon Branding

Nâng từ source V2.12.1. App 2.12.2, database giữ 2.12.0.

## Cài đặt và triển khai

1. Sao lưu source đang dùng; giữ nguyên cấu hình môi trường Supabase hiện tại.
2. Thay source bằng bản V2.12.2, chạy `npm ci` trên Node 24.x.
3. Chạy `npm test`, sau đó `npm run build` với các biến môi trường trong `.env.example`.
4. Commit/push lên repository đang kết nối Vercel để triển khai như README. ZIP không chứa khóa bí mật hoặc build cache.
5. Trên thiết bị đang dùng bản cũ, bấm **Cập nhật** khi app thông báo bản mới. Xác minh footer V2.12.2.

**Không cần chạy migration mới.** Không chạy lại SQL đã áp dụng, không reset database. Nếu database chưa đạt 2.12.0, hoàn tất hướng dẫn nâng V2.12.0 trước.

## Sử dụng

- Logo dùng lại chính `public/icon.svg`: nền gradient bo góc, pin trắng/đường cam giống icon app, không thêm viền vuông ngoài logo. Icon cài đặt PWA giữ nguyên.
- Thêm → **Giao diện** → **Màu ứng dụng**. Chọn một trong sáu bảng màu để áp dụng ngay; nút **Mặc định** khôi phục chính xác màu gốc.
- Mở **Tùy chỉnh gradient**, chọn màu bắt đầu/kết thúc bằng bộ chọn màu hoặc nhập mã `#RRGGBB`. Xem trước, chọn **Lưu màu**. **Hủy** khôi phục các ô về màu đang sử dụng và không áp dụng bản nháp.
- Màu quá sáng được cân chỉnh để chữ trắng trên gradient vẫn đọc được; màu nhấn được điều chỉnh riêng cho sáng/tối. Trạng thái lỗi/cảnh báo/thành công giữ ý nghĩa riêng.
- Lựa chọn lưu theo trình duyệt/thiết bị, không đồng bộ giữa các tài khoản/thiết bị. Không gửi dữ liệu màu lên Supabase. Lựa chọn tồn tại qua reload và cập nhật app khi bộ nhớ trình duyệt còn được giữ. Xóa dữ liệu trình duyệt sẽ xóa lựa chọn.
- Nếu trình duyệt chặn lưu, app vẫn áp dụng trong phiên hiện tại và báo rõ khả năng mất lựa chọn khi mở lại.

## Kiểm tra nhanh sau deploy

Kiểm tra logo ở màn đăng nhập và header; đổi màu, chuyển sáng/tối, tải lại trang, mở lại Giao diện và bấm Mặc định. Trong Chi phí, khối tổng hợp và nút Ghi chi tiêu phải dùng đúng màu đã chọn. Kiểm tra thêm trên Safari/iPhone và PWA thực tế.

## Quay lại

Có thể triển khai lại source V2.12.1; không cần rollback database. Dữ liệu chuyến đi, quỹ và chi phí không đổi. Muốn trở lại toàn bộ màu gốc ở bản mới, dùng nút Mặc định.

Phiên bản kế tiếp theo roadmap: **V2.13.0 — Group Expenses & Settlement**: hoàn thiện công nợ cá nhân, chuyển tiền và quyết toán nhóm, kế thừa quỹ và custom cost sharing.
