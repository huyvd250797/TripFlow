# TripFlow V0.9.0 — Release Candidate checklist

Chỉ lên V1.0.0 khi toàn bộ mục Critical/High đã đạt hoặc có quyết định chấp nhận rủi ro được ghi lại.

## Build & migration

- [ ] Node.js 24.x đúng với `engines`.
- [ ] `npm ci` sạch từ lockfile.
- [ ] `npm run typecheck` đạt.
- [ ] `npm test` đạt.
- [ ] `npm run build` đạt.
- [ ] Migration V0.9.0 đã chạy đúng môi trường.
- [ ] Thêm → Release Candidate báo database `0.9.0` và tất cả server checks đạt.

## Auth & permission

- [ ] User A không đọc/sửa chuyến của User B.
- [ ] Viewer không mutation.
- [ ] Editor không mời/đổi quyền/xóa chuyến/chốt snapshot.
- [ ] Owner thu hồi member thì quyền mất ngay ở server.
- [ ] User deactivated không dùng app/API.
- [ ] Không có secret/service_role trong bundle frontend.

## Data integrity

- [ ] Retry cùng `operationId` không tạo record trùng.
- [ ] Conflict version không ghi đè im lặng.
- [ ] Chỉ một itinerary item Active.
- [ ] Refund không vượt giao dịch gốc.
- [ ] Budget baseline bất biến.
- [ ] Backup checksum sai bị từ chối restore.
- [ ] Restore tạo chuyến mới, không overwrite source.

## Offline / PWA / realtime

- [ ] Mất mạng khi đang nhập không làm mất queue đã lưu.
- [ ] Có mạng lại thì queue sync đúng tài khoản.
- [ ] Logout có pending queue hiển thị cảnh báo.
- [ ] Realtime mất kết nối vẫn có refetch fallback.
- [ ] PWA update không tự reload giữa lúc đang nhập.
- [ ] Safari iOS và Chrome Android kiểm tra cài/update/offline shell.

## Thiết bị và UX

- [ ] 320px không horizontal overflow.
- [ ] 390px iPhone safe-area đúng.
- [ ] Android bàn phím không che nút lưu.
- [ ] Tablet và desktop không vỡ layout.
- [ ] Modal dài cuộn bên trong và đóng đúng sau khi lưu.

## Recovery & operations

- [ ] Backup thử nghiệm tải JSON được.
- [ ] Restore thử nghiệm mở được chuyến mới.
- [ ] Thùng rác restore dependency đúng.
- [ ] Operations health không có cảnh báo bất thường chưa xử lý.
- [ ] Có backup/PITR database độc lập theo gói Supabase đang dùng.
