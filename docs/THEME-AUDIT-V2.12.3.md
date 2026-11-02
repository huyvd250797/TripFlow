# Rà soát màu V2.12.3

V2.12.2 mới áp dụng override cho một số selector. Các nút và hình trang trí dùng CSS riêng vẫn giữ màu xanh; một số rule dark mode/hover có độ ưu tiên cao hơn rule đổi màu.

V2.12.3 thêm `app/palette-surfaces.css`, được import sau toàn bộ style hiện có. Các nhóm vai trò dùng chung `--palette-gradient`, `--brand-surface`, `--brand-surface-gradient`, `--brand-border`, `--brand-glow` và `--primary`, hoạt động với preset lẫn custom; không lọc màu toàn trang hay ảnh.

| Phần giao diện | Nội dung rà soát/sửa |
| --- | --- |
| Chi phí | Nút Ví đổi sang `btn primary` giống đầu trang; xóa CSS `wallet-add-expense` cũ. Tổng hợp, Ví, KPI không vượt dự toán, quỹ, nút/form cùng màu. |
| Media | Nền `story-hero-visual`, placeholder Memories, nền nhẹ hero/highlight/preview, đường timeline. Ảnh/video giữ nguyên. |
| Lịch trình | Ngày đang chọn, chấm hoạt động đang diễn ra, tuyến nối, panel đang chọn, nền bản đồ, đường SVG, điểm đến và bộ chọn ngày. Trạng thái đã hoàn thành/cảnh báo giữ ý nghĩa. |
| Tổng quan | Shortcut, các khối hành động và thống kê, bề mặt điều hành, liên kết/điểm nhấn cùng hệ màu. |
| Thêm và module | Tile/icon, trạng thái hover/active, mẫu kế hoạch, các khối dùng surface-soft. Chuẩn bị, booking, thành viên, quyền, dữ liệu và các module dùng điều khiển chung. |
| Form / bottom sheet | Header, focus, hành động chính, hover, background mềm. Giữ nút xác nhận xóa màu đỏ trong dialog-danger. |
| Shell | Nền dịu body/sidebar/topbar, nhấn điều hướng, nút sấm sét/thu gọn, tìm kiếm/command. |
| Đăng nhập / loading | Story, nền chính, màn tải, shortcut chào mừng và card phiên bản mới; chữ trên gradient trắng. Theme-color sáng theo palette. |
| Mặc định | Không có data-palette thì các vai trò tùy chỉnh không áp dụng. Không đổi logo gốc, các lựa chọn preset và ảnh nội dung. |

Các màu cố định còn được giữ có chủ đích: ngữ nghĩa đỏ/vàng/xanh của lỗi/cảnh báo/thành công/kết nối; ảnh và logo; phân biệt dữ liệu biểu đồ/danh mục; chữ và nền trung tính để bảo đảm khả năng đọc. Đây không phải màu nhận diện xanh bị bỏ sót.

Kiểm tra tự động UI mở từng module hiển thị cho tài khoản owner kiểm thử và kiểm tra containment, không thực hiện thao tác xóa hoặc thay dữ liệu sản xuất. Chi tiết kết quả và giới hạn trong `VALIDATION-V2.12.3.md`.
