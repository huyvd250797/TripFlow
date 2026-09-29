# Upgrade TripFlow V1.7.0 — Planning Board & Timeline Pro

V1.7.0 là bản MINOR frontend/domain logic. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Nâng cấp

1. Deploy source V1.7.0 bằng Node 24.x.
2. Không chạy thêm SQL nếu Database đã ở V1.4.0.
3. Đóng/mở lại PWA hoặc bấm cập nhật để nhận `tripflow-shell-v170`.
4. Kiểm tra Lịch trình ở cả Timeline và Board; thử kéo một activity sang ngày khác trên desktop và đổi ngày bằng select trên mobile.
5. Kiểm tra tab Thực chi ở viewport 320/390 px: tiêu đề và nút Ghi chi tiêu không được chồng/rớt dòng bất thường.
6. Kéo nút ⚡ sang phải: icon phải trượt ẩn, lúc đó mới xuất hiện mũi tên; bấm mũi tên phải đưa icon trở lại.

## Rollback

Vì không đổi schema, rollback chỉ cần redeploy V1.6.0. Dữ liệu activity đã đổi ngày/giờ vẫn là dữ liệu hợp lệ hiện có.
