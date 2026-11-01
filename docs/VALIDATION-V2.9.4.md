# TripFlow V2.9.4 — Bottom Sheets & Module Navigation

Ngày kiểm tra: 01/11/2026. App 2.9.4, DB 2.9.0. Nền source V2.9.3 do Boss gửi.

## Đã kiểm tra

- `npm ci`: cài sạch 103 packages; dependency/lockfile đồng bộ. Không nâng dependency stack; giữ tslib 2.9.1 dưới @swc/helpers.
- `npm test`: 83/83 qua.
- `npm run build`: production build + TypeScript + manifest offline 42 assets qua.
- Quỹ: đủ năm tab tài chính; số dư, mức đóng, đóng/hoàn/trả quỹ; input/footer trong sheet, Hủy trái/Lưu phải, 320/390/430/1280px, đọc cache offline và khóa ghi khi offline.
- Viewport: hai vòng mô phỏng bàn phím 420px + offset 55px rồi blur khi visual viewport còn giá trị cũ; sheet bám đúng đáy và phục hồi. Kéo tay nắm đóng có dữ liệu chưa lưu vẫn cho từ chối, giữ dữ liệu. Focus ô ngày không cuộn mất header.
- Thêm: chỉ một lưới module trong sheet; đóng trước khi chọn về màn trước; từ quản lý mở lại danh sách, native Back đóng sheet; tên module đầy đủ/wrap tại 320/390/430px. CRUD đặt chỗ/tài liệu qua đêm và tên người đứng cũ được giữ.
- Motion/focus: sheet mobile PWA, dialog desktop căn giữa, giảm chuyển động, khóa đóng khi đang lưu, lỗi/retry giữ draft, focus trở lại nút mở.
- Cập nhật: service worker thật; popup nhỏ giữa màn hình tại 320/390/430px, draft chặn cập nhật, một lần bấm kích hoạt bản mới; giữ queue/theme/view, không reload tab khác.
- Hồi quy: năm quyền, lưu quyền owner, ẩn nút viewer, ví offline + sync, theme và 40 bố cục responsive, xóa chuyến và dọn cache; không lỗi JavaScript.

## Giới hạn

Browser integration chạy Chromium và SQL/PGlite với toàn bộ migration; Auth/HTTP được mô phỏng. Chưa kiểm tra Supabase/Vercel production hoặc thiết bị iPhone/Safari thật. Chưa push GitHub/deploy.

Boss nên UAT trên iPhone: mở form, nhập, đóng bàn phím, cuộn, chuyển tab trong quản lý quỹ, mở/đóng nhiều lần; kiểm tra đáy sheet không lộ thanh điều hướng. Các hộp cập nhật/xác nhận là popup nhỏ có chủ đích.

## Nâng cấp

Không cần chạy migration mới. Không reset DB. Giữ env, cài sạch bằng npm ci, build và deploy source như README. SQL cũ giữ nguyên. Phiên bản kế tiếp đề xuất: V2.10.0 — Travel Readiness & Reminders; chưa triển khai.
