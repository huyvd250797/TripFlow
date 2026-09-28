# Nâng cấp TripFlow V0.5.0 → V0.6.0

## Database

V0.6.0 **không thay đổi schema**. Nếu database đã chạy V0.5.0 và hotfix policy Collaboration thì không cần migration mới cho V0.6.0.

Nếu database chưa áp dụng hotfix đã xác nhận ở V0.5.0, chạy một lần:

```text
supabase/migrations/202609280002_v050_collaboration_access_policy_fix.sql
```

## Deploy

1. Deploy source V0.6.0 bằng Node.js 24.x như cấu hình `package.json`.
2. Giữ nguyên biến `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Sau deploy, mở app online một lần để service worker V0.6.0 được cài. Nếu app đang dùng worker cũ, màn hình **Thêm → Ứng dụng trên thiết bị** sẽ hiện nút **Cập nhật TripFlow** khi worker mới ở trạng thái waiting.

## UAT bắt buộc

- iPhone Safari: topbar không chạm Dynamic Island/tai thỏ; bottom nav không chạm home indicator.
- Android Chrome: form thêm/sửa fullscreen; mở bàn phím vẫn nhìn và bấm được nút Lưu.
- Đổi tab, cuộn xuống, quay lại tab cũ: vị trí cuộn được khôi phục trong cùng phiên.
- Chọn ngày/filter Finance, đổi tab rồi quay lại: trạng thái vẫn giữ.
- Mất mạng: dữ liệu cache đã tải vẫn đọc được; API/Auth không xuất hiện trong Cache Storage của service worker.
- Chrome/Edge hỗ trợ install prompt: nút **Cài TripFlow** hoạt động. Safari iOS hiển thị hướng dẫn cài thủ công.
- Có bản deploy mới: app không tự reload giữa lúc nhập form; nút **Cập nhật TripFlow** xuất hiện và reload sau khi xác nhận.

## Rollback

Vì không có migration V0.6.0, rollback frontend chỉ cần redeploy source V0.5.0. Không rollback hotfix policy V0.5.0.
