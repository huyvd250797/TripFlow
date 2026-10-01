# Upgrade TripFlow V2.2.1 — Travel Wallet Compact CTA Fix

1. Deploy source V2.2.1 như bản hiện tại; **không chạy migration database mới**.
2. Reload/PWA refresh để nhận service worker cache `tripflow-shell-v221`.
3. Mở **Chi phí → Ví du lịch** trên mobile 320–430 px: nút **Ghi chi tiêu** phải là CTA nhỏ ở góc phải, không chiếm toàn chiều rộng.
4. Bấm CTA và xác nhận form Ghi chi tiêu vẫn mở bình thường.
5. Roadmap trong app phải hiển thị V2.2.1 ✅ và V2.3.0 là phiên bản tiếp theo.
