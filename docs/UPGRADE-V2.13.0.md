# Nâng cấp TripFlow V2.12.3 → V2.13.0

## Thứ tự thực hiện

1. Sao lưu database theo quy trình Supabase đang dùng; có thể tạo thêm backup chuyến đi trong app. Giữ ZIP V2.12.3 để đối chiếu.
2. Mở TXT migration bàn giao, copy toàn bộ vào **Supabase → SQL Editor**, chạy một lần. File gốc: `supabase/migrations/202611020001_v2130_group_settlement.sql`. 18 migration cũ được giữ nguyên, không chạy lại.
3. Kiểm tra `select version from public.tf_schema_versions where version='2.13.0';` trả một dòng.
4. Giải nén source. Giữ biến môi trường Supabase/Vercel hiện có. Từ thư mục có package.json: `npm ci`, `npm test`, `npm run build`.
5. Tích hợp vào repository đang dùng, kiểm tra diff trước khi commit/push, không force push. Deploy bằng kết nối GitHub hiện có theo README. Source này chưa được push/deploy tự động.
6. Trong app chọn Cập nhật nếu có thông báo. Kiểm tra footer V2.13.0. Vào Chi phí → Báo cáo → Quyết toán.
7. Bổ sung người thanh toán và cách chia cho các khoản cũ thiếu thông tin. Khoản thực chi chưa gắn dự toán cần gắn dự toán có cách chia; app không tự suy đoán.
8. Với Editor cần chốt: chủ chuyến mở quyền thành viên và cấp **Chốt/mở lại quyết toán**. Quyền cũ giữ nguyên; quyền mới mặc định tắt. Owner có quyền tự động, Viewer chỉ xem.

## Sử dụng

- Theo người: kiểm tra phần chịu và nguồn hình thành số dư.
- Chuyển tiền: chọn Ghi nhận, kiểm tra người chuyển/nhận, số tiền thực chuyển, ngày, ghi chú/chứng từ rồi Xác nhận. Có thể trả một phần.
- Quỹ dư/hoàn ứng: xử lý trong Chuyển tiền hoặc Quỹ chuyến đi; cả hai dùng cùng sổ quỹ.
- Lịch sử: xem/hủy chuyển tiền với lý do; giao dịch gốc không bị xóa. Sổ quỹ liên quan hiển thị tại đây, chỉnh/hủy giao dịch quỹ tại Quỹ chuyến đi.
- Chốt: xử lý hết mục thiếu thông tin, quỹ dư, số dư thành viên và dự toán chưa thanh toán đủ. Dự toán chưa chi không phải hóa đơn đã phát sinh; cần đối chiếu thực tế và sửa dự toán cuối cùng nếu phần đó không còn phát sinh.
- Mở lại: người có quyền nhập lý do; server mới cho thay đổi tài chính. Lưu hoặc đóng form trước khi cập nhật PWA.
- Mất mạng: chỉ xem bản quyết toán đã tải, không ghi nhận/chốt. Đồng bộ hết thao tác trên thiết bị trước khi xác nhận. Thiết bị khác có hàng đợi chưa gửi chỉ được phát hiện khi gửi lên; nếu quyết toán đã chốt, server từ chối thay đổi đó để đối chiếu sau khi mở lại.

## Khôi phục và quay lại

Backup mới bao gồm quyết toán và sổ quỹ, khôi phục thành chuyến sao chép với ID người/giao dịch mới; trạng thái đã chốt được giữ. Backup cũ không có quyết toán vẫn khôi phục được như trước.

Nếu cần quay lại giao diện V2.12.3, deploy lại ZIP cũ nhưng giữ migration mới và các bảng dữ liệu. Server vẫn bảo vệ quyết toán đã chốt; dùng app V2.13.0 để mở lại trước khi sửa tài chính. Không xóa bảng quyết toán để rollback UI. Không sửa/xóa migration đã áp dụng.

Tiếp theo đúng roadmap: **V2.14.0 — Travel Reminders & Offline Trip Pack**. Chưa triển khai trong phiên bản này.
