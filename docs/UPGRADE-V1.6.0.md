# Upgrade TripFlow V1.6.0 — Smart Defaults & Context Automation

V1.6.0 là bản MINOR frontend/domain logic. **Không có migration database mới**; Database tiếp tục ở V1.4.0.

## Nâng cấp

1. Deploy source V1.6.0 bằng Node 24.x.
2. Không chạy thêm SQL nếu database đã ở V1.4.0.
3. Đóng/mở lại PWA hoặc bấm cập nhật để nhận `tripflow-shell-v160`.
4. Kiểm tra bottom taskbar ở PWA standalone: scroll dài nhưng thanh điều hướng vẫn bám sát cạnh dưới.
5. Kiểm tra nút Quick: thu sang phải, chỉ còn mũi tên và mở ra lại được.
6. Mở **Thêm** và xác nhận các module được gom thành block đóng/mở.
7. Tạo chi phí/hoạt động mới để xác nhận Smart Defaults chỉ gợi ý và người dùng vẫn sửa được trước khi lưu.

## Smoke test Smart Context

- Có khoản chi cũ có người trả → form chi mới gợi ý người trả gần nhất.
- Có activity/budget hiện tại → chi phí mới gợi ý budget phù hợp.
- Quick Entry vượt phần còn lại budget → hiện cảnh báo trước khi lưu.
- Activity mới trùng giờ → hiện cảnh báo trong Command Center.
- Không có dữ liệu trước đó → fallback an toàn, không tự ghi dữ liệu ngoài ý muốn.
