# Nâng V2.11.0 → V2.12.0 — Flexible Itinerary & Route Planning

1. Sao lưu database. Nền nâng cấp phải có đầy đủ migration V2.11.0.
2. Supabase SQL Editor: chạy duy nhất `202611010006_v2120_flexible_itinerary.sql`; toàn bộ nội dung có trong TXT riêng đi kèm. Migration có transaction và kiểm tra phiên bản nguồn, giữ giờ/lịch/booking/chi phí cũ. Không reset hoặc chạy lại SQL đã áp dụng.
3. Giữ env Supabase; Node 24.x. Mở thư mục có package.json, `npm ci`, `npm run build`; deploy source sau khi SQL thành công. Root Directory trỏ đúng thư mục source. Không đặt lệnh migration trong Build Command.
4. Thêm → Trạng thái Production: app/database 2.12.0, Flexible Itinerary đạt. Người đang mở app lưu/đóng form rồi bấm Cập nhật, không cần hard reload.

## Lập lịch và ràng buộc

- Form hoạt động → Khung giờ: Linh hoạt/Giờ cố định. Khi thêm mới, mở Thêm chi tiết để thấy hai giới hạn giờ; khi sửa hiển thị đầy đủ.
- “Không bắt đầu trước” phù hợp giờ nhận phòng từ 14:00; “Phải hoàn tất trước” phù hợp hạn trả phòng, cần nhập giờ kết thúc để xác minh. Giới hạn là timestamp theo múi giờ chuyến đi, không phải giờ địa phương của trình duyệt.
- Giờ cố định vẫn được chỉnh khi người dùng chọn trực tiếp điểm đó. Dời nhóm giữ nguyên mốc cố định; các hoạt động đã check-in/hoàn thành/bỏ qua không bị dời. Muốn sửa lịch sử cần chủ động sửa form riêng.
- Từ Lịch trình → chọn điểm → Điều chỉnh hoặc dùng các nút +/− giờ/drag ngày sẵn có, app mở bản điều chỉnh thay vì lưu ngay. Chọn giờ mới, thời lượng, riêng điểm đó hoặc các điểm linh hoạt phía sau. Thời lượng thay đổi được tính theo thay đổi giờ kết thúc, giữ khoảng cách các điểm linh hoạt; dừng trước mốc cố định kế tiếp trong ngày.
- Dời nhóm cần có thời lượng gốc và mới, giữ cùng ngày. Nếu tác động đẩy điểm sau sang ngày khác, app yêu cầu điều chỉnh riêng. Không tự chuyển ngày, đảo thứ tự hoặc bỏ điểm. Có thể chọn riêng một điểm để chuyển ngày rõ ràng.
- Xem trước giữ bản chụp giờ cũ/mới và các cảnh báo sau thay đổi. Cảnh báo thiếu địa điểm, trùng giờ, chặng chưa xác nhận hoặc thiếu thời gian phải được người dùng đọc và tích xác nhận mới lưu. Giới hạn giờ không hợp lệ bị chặn ở client và database; checkbox không bỏ qua được giới hạn này.
- Một lần điều chỉnh dùng một transaction: lỗi một điểm hoặc xung đột thì rollback toàn bộ. Context kiểm tra version chuyến và toàn bộ hoạt động chưa Bỏ qua để phát hiện cả việc thêm/xóa điểm sau khi xem trước. Hỗ trợ tối đa 200 hoạt động đang trong lịch, tối đa 100 điểm được dời trong một lần. Chuyến lớn hơn vẫn sửa từng hoạt động bằng form.

## Chặng và Muốn đi

- Trên timeline, “Chặng” của điểm đến mở phương tiện, phút di chuyển và dự phòng từ điểm ngay trước. Khoảng trống được so với tổng hai khoản này. 0 phút có nghĩa là người dùng đã xác nhận không cần di chuyển; để trống nghĩa là chưa biết.
- Chặng lưu ID điểm xuất phát. Đổi thứ tự/thay điểm làm chặng cũ không còn khớp sẽ có cảnh báo xác nhận lại; không dùng nhầm thời gian chặng cũ. Nút Chỉ đường dùng địa chỉ hai điểm để mở Google Maps; app không tính giao thông trực tiếp và không lưu bản đồ offline.
- Lịch trình → Muốn đi → Thêm địa điểm. Có địa chỉ/map URL, thời lượng, ghi chú, và tùy chọn làm phương án B cho một hoạt động chưa bắt đầu.
- Đưa vào lịch: chọn vị trí sau điểm có giờ kết thúc hoặc nhập ngày giờ, xem trước rồi xác nhận. Điểm mới có ID riêng, bản sao tương ứng được bỏ khỏi Muốn đi cùng transaction; các điểm khác không tự dời.
- Dùng phương án B: chọn điểm đã liên kết, xem trước. Điểm cũ chuyển Bỏ qua và giữ trong lịch sử; đặt chỗ/dự toán/chi tiêu vẫn trỏ điểm cũ. Điểm thay thế có ID mới, không tự chuyển liên kết tài chính hoặc booking. Có thể giữ bản sao điểm cũ trong Muốn đi; khi chưa biết thời lượng cũ, bản sao gợi ý 60 phút để sửa lại.
- Xóa hoạt động sẽ gỡ liên kết phương án B khỏi wishlist tương ứng. Xóa địa điểm Muốn đi là soft delete; không nằm trong thùng rác UI cũ, khôi phục qua backup đã tạo trước đó nếu cần.

## Offline, quyền và khôi phục

Owner/Editor sửa, Viewer xem và mở chỉ đường. Sau lần tải chuyến thành công, thay đổi item/wish/route_batch được cache và xếp hàng offline; mất mạng chưa tải dữ liệu lần nào không tự tạo dữ liệu giả. Đợi đồng bộ hoặc xử lý thay đổi xung đột ở Dữ liệu/offline trước khi tiếp tục thao tác phụ thuộc.

Nếu lịch/chuyến vừa được sửa trên thiết bị khác, giao dịch sẽ báo yêu cầu tải lại và xem trước mới. Không tự ghi đè hoặc rebase kế hoạch hàng loạt. Có thể bỏ bản chờ bị xung đột rồi tạo lại từ lịch mới.

Backup server chứa wishlist và metadata mới; restore ID mới, remap chặng và phương án B. Backup cũ thiếu trường vẫn khôi phục được. Mẫu kế hoạch giữ giờ cố định, thời gian chặng và ràng buộc dưới dạng độ lệch giờ địa phương; áp dụng vào ngày mới sẽ tính lại theo múi giờ của mẫu, remap ID chặng. Wishlist là danh sách của chuyến, không tự đưa vào mẫu kế hoạch.

## Đăng nhập và kiểm tra thiết bị

Mobile dùng nền mở, không có khung chữ nhật bao form. Thu gọn bộ chọn giao diện, cân đối logo/headline/input/CTA; desktop có hai vùng nội dung. Giữ luồng đăng nhập/đăng ký/quên mật khẩu/xác thực tài khoản. Sửa đồng bộ tab trong browser history sau khôi phục phiên để chuyển bước sheet không nhảy về Tổng quan.

Chưa chạy iPhone/Safari thật. Sau deploy hãy thử trên điện thoại: đăng nhập, bàn phím, xoay máy, mở/kéo/đóng sheet, đổi bước, reload ở Lịch trình, mất mạng và có mạng lại; kiểm tra timezone và các mốc cố định. Rollback source nếu cần nhưng giữ schema/backup; không chạy ngược SQL.
