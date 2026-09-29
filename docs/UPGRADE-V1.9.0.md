# Upgrade TripFlow V1.9.0 — Expense Intelligence & Travel Wallet

V1.9.0 là bản MINOR frontend/domain logic. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Phạm vi

- Tab **Ví du lịch** trong Chi phí: còn/vượt ngân sách, bình quân/người, mức chi an toàn/ngày.
- Spending Pace so sánh % tiến độ ngày của chuyến với % ngân sách đã dùng.
- Tổng hợp người thanh toán theo thực chi ròng; refund trừ về người trả tương ứng khi xác định được.
- Favorite/Recent Expense theo user + trip bằng localStorage; dùng lại khoản chi mở form để kiểm tra trước khi lưu.
- Category suggestion dựa trên lịch sử cùng tên và từ khóa du lịch. Đây chỉ là gợi ý, không tự ghi đè lựa chọn của người dùng.
- Quick Entry dùng chung category inference.

## Dữ liệu và an toàn

- Không thêm bảng/cột/RPC mới.
- Travel Wallet được tính lại từ `budget_items`, `expenses` và thông tin chuyến; không lưu aggregate riêng.
- Favorite chỉ lưu ID cục bộ trên thiết bị và không ảnh hưởng dữ liệu tài chính cloud.
- V1.9.0 **không tự chia nợ/quyết toán** giữa thành viên vì schema hiện tại chưa lưu quy tắc split.

## Deploy

1. Deploy source V1.9.0 trên Database V1.4.0.
2. Không chạy migration mới.
3. Reload/PWA refresh để nhận `tripflow-shell-v190`.
4. Smoke test tab Chi phí → Ví du lịch, Favorite/Recent, category suggestion và regression Google Maps V1.8.4.
