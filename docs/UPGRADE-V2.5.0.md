# TripFlow V2.5.0 — Performance, Loading & Perceived Speed

## Nâng cấp từ V2.4.1

1. Giữ nguyên Supabase và các biến môi trường. **Không chạy migration mới hoặc reset DB.** App V2.5.0 yêu cầu DB V2.4.1. Nếu đang dùng DB V1.4.0, chạy migration V2.4.1 trong README trước.
2. Dùng source này cập nhật repository/Vercel đang có. Node 24.x, build command `npm run build`. Lệnh build nay chạy Next.js và tạo manifest Service Worker; không đổi sang lệnh chỉ chạy `next build` vì sẽ bỏ bước cache module offline.
3. Với người còn mở V2.4.1: mở Thêm → khu vực PWA → Cập nhật TripFlow khi worker mới sẵn sàng, hoặc tải lại trang bình thường một lần để vào V2.5.0. **Popup mới chỉ có thể hoạt động sau khi thiết bị đã tải code V2.5.0**; source mới không thể thêm popup vào JavaScript V2.4.1 đang chạy mà chưa tải lại.
4. Từ V2.5.0, các đợt phát hành sau được phát hiện bằng `/api/version` không cache, định kỳ một phút khi app đang hiển thị, lúc trở lại app/có mạng, và thông qua Service Worker mới. Trình duyệt có thể trì hoãn khi app bị hệ điều hành treo nền; việc kiểm tra tiếp tục khi quay lại.
5. Khi popup xuất hiện, chọn **Cập nhật**. App tải kiểm tra shell, lưu context/cache, kích hoạt worker và tự tải lại trang theo cách bình thường. Không cần Ctrl+F5, xóa cache hoặc thoát PWA. Chọn **Để sau** để tiếp tục; còn nút Có phiên bản mới để mở lại.
6. Màn hình Trạng thái Production phải hiển thị App 2.5.0 / DB 2.4.1. Giữ nguyên tài khoản, phân quyền, theme và dữ liệu cũ.

## Bảo vệ thao tác đang dở

- Khi đang ghi/sync hoặc biểu mẫu còn nội dung chưa lưu, nút cập nhật bị khóa với lý do cụ thể. Chọn Để sau rồi hoàn tất hoặc đóng phần đang nhập.
- Queue pending/conflict được giữ nguyên trong IndexedDB; không xóa hay tự bỏ conflict để cập nhật. Tác vụ đang gửi phải kết thúc trước.
- Chuyến đang chọn, tab, ngày, nhóm lọc và vị trí cuộn được lưu tại thiết bị. Theme giữ trong localStorage. Đăng nhập vẫn dùng phiên của Supabase; app không tự đăng xuất để cập nhật.
- Khi mở nhiều tab, chỉ tab người dùng bấm Cập nhật được tự tải lại. Worker giữ một shell trước đó để tab còn chạy bản cũ vẫn có thể lấy các chunk đã cache.
- Mạng lỗi hoặc deploy chưa sẵn sàng: giữ app đang dùng, hiện lỗi và cho thử lại. Cập nhật không phải thao tác xóa dữ liệu trình duyệt.

## Các thay đổi hiệu năng

- Tách Editor, viewer ảnh, Master Admin, Roadmap, Production Readiness, Media và Analytics thành module tải theo nhu cầu.
- Dùng skeleton cục bộ khi tải module; không thay dữ liệu đã có bằng spinner toàn màn hình khi refetch nền.
- Bỏ splash tối thiểu 680 ms. Dùng session để dựng UI nhanh; mọi API vẫn xác thực Auth và quyền tại server.
- Các báo cáo/nhật ký/lịch/route được memo hóa theo dữ liệu liên quan; không dựng lại toàn bộ khi thông báo hoặc trường nhập thay đổi.
- Khi lưu online được server chấp nhận, cập nhật ngay mảng/cache. Một lượt đọc nền đối chiếu sau đó, gộp với Realtime trong khoảng 220 ms; không refetch danh sách chuyến khi chỉ sửa chi phí.
- Danh sách chuyến polling 120 giây; dữ liệu chuyến 120 giây khi Realtime hoạt động hoặc 30 giây khi Realtime lỗi. Khi quay lại cửa sổ vẫn kiểm tra dữ liệu stale; server luôn kiểm tra quyền khi ghi.
- Chỉ resolve Maps khi mở Bản đồ trong tab Lịch trình.

## Build và cache offline

`npm run build` tự chạy `scripts/generate-sw-manifest.cjs` sau Next build, lấy chính các tên chunk vừa build để tạo `public/sw.js`. Không sửa tay danh sách hash. Khóa cache có version như `tripflow-shell-2.5.0`.

File `public/sw.js` trong source ZIP là bản bootstrap không chứa hash từ máy kiểm thử. Chạy build production để tạo gói cache đầy đủ; không đánh giá offline bằng `npm run dev`.

Các chunk tải riêng được tải nền vào cache khi worker cài xong để không làm mất khả năng mở form/Media khi offline. **Chỉ coi gói offline sẵn sàng sau khi worker cài thành công**; một lần truy cập chớp nhoáng khi mạng yếu chưa đảm bảo tải đủ cache. API, Auth và tài nguyên khác origin không được worker cache. File Google Drive/Maps không tự thành dữ liệu offline.

Mỗi lần đổi phiên bản phải đổi version trong package và lib/types theo bản phát hành, để metadata, popup và cache nhất quán. Nên phát hành với version mới thay vì tái dùng số cũ. Header `/sw.js` và `/api/version` không cache; HTML gốc yêu cầu revalidate. Giữ đủ các file static của lần deploy hiện hành.

## Kiểm tra source và giao diện

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run measure:bundle
```

- UI regression: chạy app local có URL/key test như hướng dẫn docs/TESTING.md, rồi `npm run test:ui`.
- Update lifecycle: build với `TRIPFLOW_UI_TEST=1` nếu muốn output `.next-ui`, giữ cùng biến khi chạy `npm run test:update:ui`. Nếu không dùng biến đó, build mặc định `.next` rồi chạy test mặc định. Test tự tạo server local và chạy trình duyệt; không cần website production hoặc tài khoản thật.
- Cài Chromium qua `npx playwright install chromium`, hoặc đặt `CHROMIUM_PATH` trỏ tới browser có sẵn.
- Thử V2.5.0 → bản mới trên staging bằng cách tăng version, build và deploy: popup, Để sau, draft chưa lưu, mất mạng, một tab khác đang mở và queue offline.

Chưa push GitHub/deploy production trong lần bàn giao source này. Chưa kiểm chứng Service Worker trên Safari/PWA iPhone thật; cần UAT theo checklist ở trên. Phiên bản tiếp theo: V2.6.0 — UI/UX Motion & Visual Polish.
