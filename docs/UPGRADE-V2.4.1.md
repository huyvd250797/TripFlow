# Nâng cấp TripFlow V2.4.1 — Travel Reliability Fix

## 1. Nếu Boss đang dùng V2.4.0

1. Khi còn mạng, đồng bộ hết thao tác chờ trên các thiết bị; xử lý các conflict. Không xóa dữ liệu trình duyệt/PWA để nâng cấp.
2. Tạo backup chuyến trong app và sao lưu database theo cách đang vận hành.
3. Vào **Supabase → SQL Editor → New query**. Mở file `supabase/migrations/202610310001_v241_travel_reliability_permissions.sql`, sao chép toàn bộ và chạy **một lần**. File này chạy sau migration V1.4.0 mà App V2.4.0 đang sử dụng. Không chạy lại migration khởi tạo, không reset database.
4. Đăng nhập và chạy truy vấn sau bằng phiên SQL có ngữ cảnh Auth phù hợp, hoặc kiểm tra qua màn hình Trạng thái Production của app sau khi deploy:

   ```sql
   select version, migration_name
   from public.tf_schema_versions
   where version = '2.4.1';
   ```

5. Dùng source V2.4.1 để push lên repository đang kết nối Vercel. Giữ nguyên biến môi trường Supabase hiện có. Build command vẫn `npm run build`, Node **24.x**, root directory là thư mục chứa `package.json`. Xem README cho lần deploy đầu và trường hợp repo đã có source.
6. Mở lại app; nếu PWA báo cập nhật thì đồng bộ trước và bấm cập nhật. Service worker mới: `tripflow-shell-v241`. IndexedDB/queue dùng cấu trúc hiện tại, không cần dọn dữ liệu.
7. Kiểm tra **Thêm → Ứng dụng, dữ liệu & vận hành → Trạng thái Production**: App **2.4.1**, DB **2.4.1**, stable, các guard đạt. Nếu thiếu migration mới, API hiển thị hướng dẫn V2.4.1 thay vì tự suy quyền.

Nếu tạo database mới, chạy tất cả SQL trong `supabase/migrations` theo thứ tự tên file, gồm migration V2.4.1 cuối cùng. Nếu DB cũ hơn V1.4.0, chạy các migration còn thiếu trước; giữ thứ tự của README.

## 2. Năm quyền độc lập

| Quyền                  | Cho phép                                        | Không tự bao gồm                                                               |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Mời thành viên         | Tạo lời mời Editor/Viewer, xem link lời mời     | Đổi/thu hồi quyền, xóa chuyến, chốt dự toán, cấp quyền đặc biệt cho người khác |
| Đổi quyền thành viên   | Đổi Editor/Viewer của thành viên khác           | Tự đổi vai trò của mình; cấp/thay đổi năm quyền đặc biệt; thu hồi truy cập     |
| Thu hồi quyền truy cập | Thu hồi lời mời hoặc xóa thành viên khỏi chuyến | Mời mới, đổi quyền hoặc xóa chuyến                                             |
| Xóa chuyến đi          | Xóa mềm chuyến đang có quyền truy cập           | Chốt dự toán; khôi phục chuyến (việc phục hồi vẫn do Owner thực hiện)          |
| Chốt dự toán           | Tạo baseline hoặc revision bất biến             | Sửa dự toán hoặc thay đổi dữ liệu chuyến nếu vai trò chỉ là Viewer             |

- Owner luôn có đủ quyền, không thể xóa Owner bằng thao tác xóa thành viên.
- Editor vẫn được sửa lịch/chi phí/media và check-in. Viewer vẫn chỉ đọc dữ liệu, trừ từng thao tác đặc biệt được Owner cấp riêng.
- Thành viên và lời mời cũ giữ nguyên vai trò; cả năm quyền mới mặc định **tắt**. Không tự nâng quyền khi chạy migration.
- Chỉ Owner bật/tắt năm quyền, kể cả trên lời mời. Cách làm: **Thêm → Chuyến đi, thành viên & kế hoạch → Chia sẻ & phân quyền → Mời thành viên hoặc Sửa quyền → chọn từng checkbox → Lưu**.
- Người được quyền Đổi quyền có thể đổi vai trò cơ bản của người khác; các checkbox đặc biệt chỉ hiển thị với Owner. Đây là giới hạn ủy quyền có chủ đích để tránh tự cấp quyền xóa chuyến hoặc cấp tiếp quyền quản trị.
- Database kiểm tra mọi thao tác bằng quyền hiện tại, version và transaction; giấu nút ở giao diện không thay thế kiểm tra server. Thay đổi riêng checkbox cũng phát access event qua Realtime.

## 3. Xóa chuyến đi

- Nút nằm tại **Thêm → Chuyến đi, thành viên & kế hoạch**, dưới khu vực mẫu kế hoạch.
- Chỉ có nút khi tài khoản có quyền Xóa chuyến đi (Owner mặc định có).
- Cần online; nút tạm khóa nếu chuyến có thao tác chờ/conflict trên thiết bị. Đồng bộ hoặc xử lý các thay đổi trước khi xóa.
- Có hộp xác nhận. Xóa là xóa mềm: chuyến biến mất khỏi danh sách của nhóm; dữ liệu liên quan không bị xóa vật lý. Cache chuyến trên thiết bị thực hiện được dọn sau khi server xác nhận.
- Owner khôi phục tại thùng rác trong khu vực Backup & Recovery, kể cả khi danh sách không còn chuyến nào. Khi khôi phục, các thành viên/quyền đã có vẫn thuộc chuyến đó.
- Thiết bị khác đang hoàn toàn offline chưa thể nhận tin xóa; khi online, server từ chối đọc/ghi chuyến đã xóa. Dữ liệu đã lưu offline không thể thu hồi từ xa khi thiết bị không kết nối.

## 4. Giao diện sáng/tối

- Đổi nhanh bằng biểu tượng trên thanh trên cùng; chu kỳ **Thiết bị → Sáng → Tối → Thiết bị**.
- Chọn trực tiếp ba chế độ ở **Thêm → Giao diện** hoặc màn hình đăng nhập.
- Mặc định theo thiết bị. Chế độ được lưu tại trình duyệt/PWA hiện tại, chưa đồng bộ giữa các thiết bị.
- Palette tối dùng nền xanh đen, bề mặt phân tầng, chữ sáng, trạng thái đỏ/vàng/teal; không áp bộ lọc đảo màu lên ảnh và video.

## 5. Các sửa lỗi nghiệp vụ

- **Ví offline:** khi expenses/budgets liên quan thay đổi local, bỏ aggregate cloud cũ và tính lại từ các hàng đang hiển thị. Ví, tài chính, analytics và CSV dùng cùng dữ liệu; lấy lại báo cáo server khi đồng bộ/refetch thành công.
- **Qua đêm:** Current ưu tiên hoạt động active toàn chuyến. Hoạt động kéo qua ngày vẫn có trong lịch hôm nay/bộ lọc ngày; kết thúc đúng 00:00 là ranh giới loại trừ ngày mới. Dự toán hoạt động được tính cho ngày bắt đầu, không nhân đôi trên từng ngày kéo dài.
- **Số ngày:** ngày kết thúc khai báo được ưu tiên. Nếu bỏ trống, lấy ngày cuối lịch trình, gồm ngày kết thúc chặng qua đêm. Ngày chi/hoàn hoặc ngày thêm ảnh không tự kéo dài chuyến. Tổng quan, Ví, Board và Analytics dùng quy tắc chung; ngày suy ra chỉ để hiển thị, không tự ghi vào database.
- **Tuyến Maps:** chia thành các đoạn nối tiếp, tối đa 3 điểm trung gian/đoạn, chung điểm cuối/đầu giữa hai đoạn. Hiển thị số đoạn và khoảng chỉ số điểm. Không bỏ điểm giữa một cách âm thầm. Ước tính khoảng cách/thời gian vẫn là ước tính nội bộ, không phải giao thông trực tiếp.

## 6. Kiểm tra trước khi dùng thật

1. Ghi chi khi offline → tổng ví/báo cáo đổi ngay → bật mạng → không ghi trùng.
2. Tạo xe đêm 22:00–07:00 và xem sau nửa đêm; thử cả trạng thái active/planned.
3. Bỏ ngày kết thúc, tạo hoạt động nhiều ngày; số ngày phải khớp giữa các khu vực.
4. Tạo tuyến 12 điểm; mở các đoạn lần lượt và kiểm tra đủ thứ tự.
5. Dùng hai tài khoản để thử cấp riêng từng quyền; tài khoản không được cấp không có nút và không thể gọi RPC để vượt quyền.
6. Xóa chuyến thử nghiệm bằng người được ủy quyền; Owner phục hồi trong thùng rác.
7. Kiểm tra sáng/tối trên desktop và Safari/PWA iPhone, bàn phím, modal, table và ảnh.

## 7. Cài và kiểm tra source tại máy

Trong thư mục giải nén chứa `package.json`:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Để chạy app local, sao chép `.env.example` thành `.env.local`, điền Project URL và publishable/anon key của Boss rồi chạy `npm run dev`. Không điền service_role. Phần local/GitHub/Vercel, Auth callback và lỗi thường gặp có trong README.

Nếu có lỗi khi nâng cấp: giữ nguyên dữ liệu/quyền mới, thu thập lỗi và sửa tiến về phía trước. Không chạy lại SQL khởi tạo hoặc tự DROP cột để quay về. Rollback database chỉ từ backup đã xác minh, có kế hoạch cho dữ liệu phát sinh sau backup; source cũ có thể không hiểu schema marker/quyền mới.

## 8. Phạm vi phiên bản

V2.4.1 thực hiện các mục Boss chọn và thêm phân quyền/theme. Chưa bao gồm sửa thời điểm check-in offline thành thời điểm thao tác của thiết bị; SQL vẫn ghi thời điểm khi xử lý đồng bộ. Nhắc lịch, booking/vé, hành lý, chia tiền nhóm và đa tiền tệ chưa triển khai trong bản này.

Phiên bản kế tiếp: **V2.5.0 — Performance, Loading & Perceived Speed**, tập trung chia module, giảm request và cải thiện loading/mobile theo số đo thực tế.
