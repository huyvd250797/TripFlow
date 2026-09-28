# TripFlow V1.0.0 — Stable Production checklist

Chỉ phát hành/duy trì V1.0.0 Production khi toàn bộ mục Critical/High đã đạt hoặc có quyết định chấp nhận rủi ro được ghi lại.

## Build & migration

- [ ] Node.js 24.x đúng với `engines`.
- [ ] `npm ci` sạch từ lockfile.
- [ ] `npm run typecheck` đạt.
- [ ] `npm test` đạt.
- [ ] `npm run build` đạt.
- [ ] Migration V0.9.0 và V1.0.0 đã chạy đúng môi trường theo thứ tự.
- [ ] `tf_release_readiness()` trả app/database `1.0.0`, channel `stable`, ready `true`.
- [ ] **Thêm → Trạng thái Production** báo database `1.0.0` và tất cả server/client checks đạt.

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


## Production cutover

- [ ] Ghi lại deployment Vercel đang chạy và Supabase project/ref đúng môi trường.
- [ ] Backup/PITR hoặc bản sao database phù hợp gói dịch vụ đã được xác nhận trước cutover.
- [ ] Smoke test sau deploy đạt theo `docs/PRODUCTION-RUNBOOK.md`.
- [ ] Không còn lỗi Critical/High mở; Medium có owner và kế hoạch xử lý.
- [ ] Có đường rollback frontend rõ ràng và người chịu trách nhiệm vận hành.


## V1.1.0 UI/brand compatibility

- [ ] Source App version hiển thị `1.1.0`.
- [ ] Database version vẫn `1.0.0` và channel `stable`; không tạo migration V1.1.0 chỉ để đổi UI.
- [ ] Splash, logo/icon, auth, desktop shell và mobile dock đã smoke-test trên thiết bị thật.
- [ ] PWA đã nhận `tripflow-shell-v110` sau refresh/đóng mở app.

## V1.2.0 Smart Workspace compatibility

- [ ] Source App version hiển thị `1.2.0`.
- [ ] Database version vẫn `1.0.0`; không tạo migration chỉ cho workspace/search.
- [ ] Search không trả dữ liệu ngoài bundle/chuyến đang mở.
- [ ] Viewer không được mở quick mutation từ Smart Workspace.
- [ ] 320/390px không horizontal overflow ở Tổng quan và search dialog.
- [ ] Service worker shell đã là `tripflow-shell-v120`.
