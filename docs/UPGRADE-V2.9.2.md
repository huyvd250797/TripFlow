# V2.9.2 — Finance Overview & Fund UX Polish

## Nâng cấp

Không cần chạy migration mới. Database giữ **2.9.0**, app **2.9.2**. Nếu đã chạy migration quỹ V2.9.0 thì không chạy lại; nếu chưa, hoàn tất SQL V2.9.0 theo hướng dẫn cũ trước khi sử dụng quỹ.

Thay source, gồm package.json và package-lock.json. Giữ Node 24.x, Install Command `npm ci`, Build Command `npm run build`, các biến Supabase và root directory hiện có. Không dùng build cache ở lần xác minh đầu nếu đang gặp lỗi cài dependency từ bản cũ. Người dùng lưu/đóng bản nháp rồi chọn Cập nhật khi app báo bản mới.

## Block xem nhanh

Block xanh luôn xuất hiện phía trên ba tab Tổng quan / Dự toán / Thực chi. Bốn ô: Dự toán hiện tại; Thực chi ròng; Còn trong dự toán hoặc Vượt dự toán; Số dư quỹ thực tế. Mobile 2 × 2, desktop bốn cột. Chưa thiết lập quỹ hiển thị nhãn riêng; khi tải thất bại không giả định số dư bằng 0. Bản cache/offline có nhãn tạm tính. Dự toán gốc vẫn nằm trong Đối chiếu dự toán.

Quỹ Tổng quan chỉ còn Đã thu/Mục tiêu, Cá nhân còn ứng và Quản lý quỹ. Ví giữ bình quân/người và mức chi/ngày, bỏ ô còn ngân sách trùng. Ba tab Chi phí được giữ nguyên.

## Quản lý quỹ

Một vùng cuộn chính dưới header, danh sách thành viên gọn và tìm theo tên. Có hướng dẫn thiết lập khi chưa lưu người giữ quỹ. Nút màu app và trạng thái vô hiệu hóa rõ ràng theo quyền/kết nối.

Bấm Mức đóng / Ghi đóng quỹ / Hoàn ứng / Trả quỹ / Hủy giao dịch sẽ thay phần danh sách bằng màn nhập riêng trong cùng popup. Không chèn form xuống cuối danh sách đang cuộn. Hủy nhập quay về danh sách; bản nháp có xác nhận khi đóng. Lưu/Hủy bám cuối màn nhập; chứng từ/ghi chú thu gọn; số tiền nhập có phân cách hàng nghìn. Các kiểm tra số dư, quyền, chống ghi trùng và version vẫn do server xác minh.

Banner và quản lý dùng chung query cache theo tài khoản/chuyến để số dư cập nhật sau giao dịch và khi chuyển tab. Dữ liệu offline vẫn dùng cache cũ; giao dịch quỹ yêu cầu online. Không có thay đổi schema hay công thức thu/chi/hoàn ứng.

## Kế tiếp

V2.10.0 — Travel Readiness & Reminders vẫn là đề xuất: checklist và nhắc hạn/giờ đặt chỗ, chưa triển khai. Gửi ZIP V2.9.2 mới nhất để tiếp tục.
