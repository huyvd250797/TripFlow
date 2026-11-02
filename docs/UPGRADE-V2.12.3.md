# TripFlow V2.12.3 — Complete Theme Consistency

Nâng từ ZIP V2.12.2 Boss gửi. App 2.12.3; database giữ 2.12.0.

**Không cần chạy migration mới.** Không reset dữ liệu hoặc chạy lại SQL đã áp dụng. Nếu database chưa đạt 2.12.0, hoàn tất hướng dẫn V2.12.0 trước.

## Triển khai

1. Giữ bản source V2.12.2 để có thể quay lại; giữ cấu hình Supabase/Vercel đang dùng.
2. Giải nén ZIP V2.12.3, mở thư mục source; dùng Node 24.x.
3. Chạy `npm ci`, `npm test`, `npm run build` với biến môi trường như README.
4. Push vào repository đang kết nối Vercel hoặc triển khai source theo hướng dẫn README. Không upload `node_modules`/build cache.
5. Trong app đang mở, bấm **Cập nhật** khi thông báo bản mới xuất hiện. Kiểm tra footer V2.12.3.

## Nội dung sửa

- Nút Ghi chi tiêu trong Ví dùng cùng lớp nút và icon với nút đầu trang. Loại CSS nút riêng cũ để tránh bị xanh trở lại khi hover hoặc đổi chế độ.
- Nền Memories dùng gradient của bảng màu đang chọn. Ảnh bìa/ảnh/video người dùng không bị đổi màu, không áp filter lên ảnh.
- Vai trò màu dùng chung phủ các nền nhận diện đậm và nền nhẹ: loading, Memories, bản đồ, shortcut, shell, menu module, quỹ/ví, mẫu kế hoạch, khối thống kê, form và header bottom sheet.
- Chuyển màu giao diện cập nhật cả theme-color trình duyệt ở chế độ sáng; dark mode giữ thanh trình duyệt tối.
- Giữ màu thông báo nghiệp vụ: đỏ cho xóa/lỗi/offline, vàng cảnh báo, xanh kết nối/thành công; giữ màu phân loại dữ liệu, icon logo và ảnh gốc.
- Preset, tùy chỉnh hai màu, lưu theo thiết bị, sáng/tối và Mặc định giữ quy trình V2.12.2. Bấm Mặc định bỏ toàn bộ override màu; riêng nút Ví vẫn đồng bộ với nút chung theo yêu cầu sửa.

## Kiểm tra sau deploy

Chọn Tím hoàng hôn → Chi phí: hai nút Ghi chi tiêu phải cùng màu cả bình thường/hover. Sang Media: nền TRIPFLOW MEMORIES phải chuyển tím. Thử màu tự chọn, sáng/tối, reload và Mặc định; kiểm tra lại trên iPhone/PWA thực tế.

Quay lại: deploy source V2.12.2 nếu cần; không rollback database.

Phiên bản tiếp theo giữ nguyên roadmap: **V2.13.0 — Group Expenses & Settlement**, hoàn thiện công nợ cá nhân, chuyển tiền và quyết toán nhóm.
