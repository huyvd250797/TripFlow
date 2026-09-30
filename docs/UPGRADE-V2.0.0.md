# Upgrade TripFlow V2.0.0 — Pro Travel Operating System

V2.0.0 là bản MAJOR UI/domain integration. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Thay đổi chính

1. Trip Operating Center tại Tổng quan nối Planning, Live Trip, Finance và Memories.
2. Nút Ghi chi tiêu trong Travel Wallet được thiết kế lại để không bị co hẹp trên mobile.
3. `payer` của Expense vẫn lưu dạng chuỗi để tương thích schema, nhưng UI chọn từ `bundle.participants`.
4. Khi chỉnh sửa giao dịch cũ có payer không còn trong danh sách participant, TripFlow vẫn hiển thị giá trị đó dưới nhãn `(dữ liệu cũ)` để tránh mất dữ liệu.

## Deploy

1. Deploy source V2.0.0 trên Database V1.4.0.
2. Reload/PWA refresh để nhận cache `tripflow-shell-v200`.
3. Smoke test: thêm ít nhất 2 Người tham gia → Ghi chi tiêu → Người thanh toán phải hiển thị đúng 2 người.
4. Kiểm tra Travel Wallet trên mobile: nút Ghi chi tiêu phải hiển thị ngang, không xuống chữ bất thường.
