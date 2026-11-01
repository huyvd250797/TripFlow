# TripFlow — Roadmap

Các phiên bản đã phát hành được giữ trong `lib/roadmap.ts` và CHANGELOG. Không thay đổi thứ tự các bản đã chốt.

| Phiên bản | Mục tiêu | Chức năng chính | Kỹ thuật/dữ liệu | Điều kiện hoàn thành | Phụ thuộc/trạng thái |
| --- | --- | --- | --- | --- | --- |
| V2.11.0 — Packing, Checklist & Family Travel | Chuẩn bị trước chuyến đi | Checklist, mẫu hành lý, phân công, gia đình, liên hệ | RLS, offline queue, backup/restore | Theo dõi tiến độ và đồng bộ được | Đã xây dựng |
| V2.12.0 — Flexible Itinerary & Route Planning | Điều chỉnh lịch theo thực tế | Giờ cố định/linh hoạt, giới hạn giờ, chặng di chuyển/dự phòng, xem trước dời nhiều điểm, wishlist/phương án B; đăng nhập mới | Giao dịch điều chỉnh atomic, snapshot version/context, offline, RLS, backup/template remap | Giữ mốc cố định và lịch sử; không ghi đè lịch vừa đổi; mobile sáng/tối và login không tràn | Sau V2.11.0; đã xây dựng |
| V2.12.1 — Mobile Layout & Interaction Polish | Giao diện gọn, vừa khung và thao tác rõ | Logo không khung, bộ chọn view, icon điều phối, sheet phân chia, chuẩn bị và refresh feedback | Không đổi schema; scroll pane/indicator dùng chung, trạng thái toast theo request thật | Kiểm tra containment sáng/tối 320–1280 và vuốt lần đầu; giữ nghiệp vụ | Sau V2.12.0; đã xây dựng |
| V2.13.0 — Group Expenses & Settlement | Hoàn thiện quyết toán nhóm | Công nợ cá nhân, chuyển tiền và quyết toán; kế thừa quỹ và custom cost sharing | Liên kết phần chịu/đã trả/chuyển tiền, phân quyền và kiểm tra tổng | Đối chiếu được số phải trả/nhận, không đếm tiền quỹ hai lần | Sau V2.12.0; tiếp theo |
| V2.14.0 — Travel Reminders & Offline Trip Pack | Dùng tiện khi đang đi | Nhắc việc/ICS, vé/tài liệu tải offline thật, chia sẻ chỉ đọc chọn lọc | Lịch nhắc, cache file, quyền chia sẻ | Nhắc đúng ngữ cảnh, mở tài liệu đã tải khi mất mạng | Dự kiến |
| V2.15.0 — International Travel | Chuyến đi quốc tế | Đa tiền tệ/tỷ giá giao dịch, múi giờ theo chặng, hộ chiếu/visa | Currency/FX và time zone theo chặng | Tổng tiền và giờ hiển thị nhất quán | Dự kiến |

V2.12.0 chưa tích hợp API dẫn đường/giao thông, tự tối ưu thứ tự điểm, push/ICS hoặc tải vé offline. Thời gian di chuyển nhập thủ công. Các bản dự kiến chưa cam kết ngày phát hành.
