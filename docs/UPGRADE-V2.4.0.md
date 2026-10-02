# Upgrade TripFlow V2.4.0 — Offline & Sync Reliability Pro

1. Deploy source V2.4.0; **không chạy migration database mới**. Database vẫn là V1.4.0.
2. Reload/PWA refresh để nhận service worker cache `tripflow-shell-v240`.
3. IndexedDB tự nâng `tripflow-v020` từ version 1 lên version 2; không xóa cache/queue cũ.
4. Test offline: mở một trip đã cache → tắt mạng → tạo/sửa/xóa Expense/Item/Budget → reload PWA → dữ liệu local vẫn hiển thị.
5. Bật mạng → xác nhận queue tự sync, badge về 0 và refresh cloud không tạo duplicate.
6. Test retry: chặn network tạm thời rồi mở lại; app phải backoff và tự tiếp tục khi online/focus.
7. Test conflict bằng cách sửa cùng record trên hai thiết bị; chọn lần lượt **Dùng bản cloud** và **Giữ bản trên máy**.
8. Invitation/Member/Snapshot, xóa Trip và Master Admin vẫn phải yêu cầu online.
9. Roadmap phải hiển thị V2.4.0 ✅ và V2.5.0 là phiên bản tiếp theo.
