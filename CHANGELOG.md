# Changelog

## V2.12.1 — Mobile Layout & Interaction Polish

- Bỏ nền khung/viền/shadow của logo hiển thị trong app; pin đứng độc lập, màu phù hợp sáng/tối. Không thay icon nút điều hướng hoặc dữ liệu người dùng.
- Timeline/Board/Bản đồ có ba cột vừa khung, icon Điều phối và GPS cùng thanh công cụ. Điều phối chỉ mở bằng icon, các chức năng quản lý và preview giữ nguyên trong bottom sheet.
- Phân chia chi phí chuyển vào nút cùng tiêu đề **Báo cáo theo hoạt động**, mở danh sách dài trong bottom sheet, không có nút đứng một hàng riêng. Thiết lập cách chia vẫn ở Dự toán.
- Sheet chuẩn bị vùng cuộn trước animation, bỏ transform/will-change trên nội dung cuộn và bỏ việc ép kết thúc animation tại cử chỉ đầu; có thanh chỉ báo cuộn thụ động ngay khi nội dung dài. Giữ native touch scroll, kéo đóng, motion, dirty/busy guard và popup cập nhật nhỏ ở giữa.
- Tải lại dữ liệu: giữ một thông báo đang cập nhật trong khi chờ; tải xong đổi cùng thông báo sang thành công/dấu kiểm và tự ẩn sau 3,5 giây. Lỗi/offline báo cảnh báo, không báo thành công giả.
- Chuẩn bị chuyến đi: hành động header gọn, tên đầy đủ qua aria-label/title, input/select và progress phù hợp iOS; tiêu đề dài, nhóm nút, báo cáo/bản đồ được chỉnh để vừa khung.
- **Không cần chạy migration mới. App 2.12.1, database giữ 2.12.0.** Nếu chưa nâng database V2.12.0, dùng TXT V2.12.0 đã bàn giao trước, không chạy lại SQL đã áp dụng.

Hướng dẫn: `docs/UPGRADE-V2.12.1.md`; xác minh: `docs/VALIDATION-V2.12.1.md`.


## V2.12.0 — Flexible Itinerary & Route Planning

- Lịch trình có giờ cố định/linh hoạt, giới hạn không bắt đầu trước và phải hoàn tất trước. Các trường mới nằm trong form hoạt động; giới hạn giờ nằm trong Thêm chi tiết khi tạo mới.
- Chặng đến từng điểm có phương tiện, phút di chuyển, phút dự phòng và nút chỉ đường. Dữ liệu do người dùng khai báo; chưa gọi API tính quãng đường/thời gian hoặc giao thông trực tiếp.
- Điều chỉnh một điểm hoặc nhóm điểm linh hoạt phía sau trong ngày, đến trước mốc cố định tiếp theo. Xem trước giờ cũ/mới, cảnh báo xung đột rồi xác nhận trong một transaction. Không tự đổi mốc cố định, lịch sử đã diễn ra, đặt chỗ hoặc chi phí.
- Muốn đi/phương án B nằm trong Lịch trình, không thêm tab chính. Đưa điểm vào lịch có xem trước. Khi dùng phương án B, điểm cũ chuyển sang Bỏ qua để giữ liên kết booking/chi phí; tùy chọn lưu bản sao điểm cũ vào Muốn đi.
- Offline queue, optimistic UI, chống gửi trùng, version/context conflict, RLS Owner/Editor/Viewer; backup/restore và mẫu kế hoạch giữ các ràng buộc, ánh xạ ID chặng.
- Đăng nhập được thiết kế lại: bỏ khung thô trên mobile, chỉnh logo/typography/input, thu gọn bộ chọn sáng/tối, bố cục desktop cân đối. Sửa khôi phục tab trong history để chuyển bước bottom sheet sau reload không nhảy về Tổng quan.
- App/DB **2.12.0**. Từ V2.11.0 chỉ chạy `202611010006_v2120_flexible_itinerary.sql` trong TXT đi kèm, trước deploy. Không reset database hoặc chạy lại SQL cũ.

Xem `docs/UPGRADE-V2.12.0.md` và `docs/VALIDATION-V2.12.0.md`.


## V2.11.0 — Packing, Checklist & Family Travel

- Thêm → **Chuẩn bị chuyến đi**, không thêm tab điều hướng chính. Checklist chung/cá nhân, sáu nhóm gấp/mở, bộ lọc Tất cả / Của tôi / Chưa xong / Chưa phân công.
- Đồ mang theo: Cần chuẩn bị → Đã có → Đã đóng gói; công việc: Chưa làm → Hoàn tất; Không áp dụng được loại khỏi mẫu số tiến độ. Có số lượng, hạn, người phụ trách và ghi chú.
- Bốn mẫu biển/nghỉ dưỡng/tự túc/gia đình có em bé. Áp dụng mỗi mẫu trong một transaction, tạo các mục độc lập với UUID mới; sửa/xóa mục không đổi mẫu hoặc chuyến khác.
- Người tham gia có nhóm Người lớn/Trẻ em/Em bé, nhóm gia đình và nhu cầu. Không tự đổi số người hoặc cách chia chi phí. Liên hệ khách sạn/tài xế/người thân có gọi điện và mở bản đồ.
- Tổng quan chuyến đang lên kế hoạch/sẵn sàng có tiến độ và mục quá hạn, bấm mở module. Dữ liệu mới dùng hàng đợi offline, version/conflict, kiểm tra Owner/Editor/Viewer tại database và backup/restore ánh xạ lại người.
- App/DB **2.11.0**. Từ V2.10.1 chỉ chạy `202611010005_v2110_packing_checklist_family.sql` trong TXT riêng trước deploy. Không reset DB, không chạy lại migration cũ.

Xem `docs/UPGRADE-V2.11.0.md` và `docs/VALIDATION-V2.11.0.md`.


## V2.10.1 — Sheet & Cost Sharing UX Fix

- Thu gọn header bottom sheet: tay nắm 18px, nút đóng 36px, tiêu đề 18px; tổng khoảng 63px với tiêu đề một dòng. Bỏ mô tả phụ khỏi header mobile; popup compact và desktop giữ bố cục riêng.
- Tạo sẵn vùng cuộn native và lớp nội dung, giữ scrollbar gutter ổn định, chạm vùng nội dung sẽ kết thúc animation mở đang chạy để không cạnh tranh với thao tác cuộn. Không chặn hoặc bắt pointer của nội dung; header/tay nắm vẫn kéo đóng được.
- Thêm cách chia thứ ba: Chia đều cho danh sách được chọn. Tích người được chia, tự đếm số người; không cần phần cố định, không chia cho những người ngoài danh sách. Giữ nguyên hai cách chia trước.
- Nút sấm sét và mũi tên thu gọn tính giới hạn theo taskbar thật và chiều cao nút, cho phép kéo sát còn 6px; nhớ vị trí, tự bám mép và xử lý resize.
- Bảng Phân chia chi phí chuyển từ Đối chiếu sang Báo cáo. Thiết lập cách chia vẫn ở từng khoản Dự toán; Đối chiếu tập trung dự toán gốc/hiện tại/thực tế.
- App/DB 2.10.1. Chạy migration 202611010004_v2101_selected_cost_sharing.sql sau V2.10.0 và trước deploy source; TXT gửi riêng. Không reset hoặc chạy lại SQL đã áp dụng.

## V2.10.0 — Custom Cost Sharing

- Dự toán có đúng hai cách chia: chia đều toàn bộ danh sách người tham gia (không chọn người), hoặc cố định một phần rồi chia đều phần còn lại cho những người được chọn. Có xem trước, làm tròn VNĐ bảo toàn tổng tiền, kiểm tra danh sách và phần cố định.
- Đối chiếu hiển thị phần phải chịu, thanh toán theo người, tổng đã trả và còn trả nhà cung cấp theo khoản dự toán. Cọc nhiều lần cùng khoản không làm thay đổi thỏa thuận chia.
- Cá nhân thanh toán chọn hình thức trả phần phải chịu hoặc ứng trước cần hoàn. Khoản trả trực tiếp không tự thành đóng quỹ/hoàn ứng. Chọn Quỹ chuyến đi ẩn người thanh toán và lưu người trả rỗng ở server.
- Bottom sheet dùng một khung portal fixed bám đáy; chỉ dùng kích thước visual viewport khi bàn phím mở. Mở trượt lên, đóng trượt xuống cả khi lưu/hủy/Back; kéo tay nắm hoặc header theo tay, kéo ngắn trả về, bảo vệ dữ liệu chưa lưu và thao tác đang xử lý. Giảm chuyển động được tôn trọng.
- Thêm: một danh sách module hai cột theo mẫu Mẹ Yêu Bé, màu TripFlow, tên đầy đủ và mô tả từng chức năng; không có menu trùng ở trang nền. Popup cập nhật/xác nhận nhỏ căn giữa, desktop giữ hộp thoại giữa màn hình.
- Bắt buộc chạy `202611010003_v2100_custom_cost_sharing.sql` sau database V2.9.0, trước deploy V2.10.0. App/DB 2.10.0. Không reset hoặc chạy lại SQL cũ. TXT được bàn giao riêng.

## V2.9.4 — Bottom Sheets & Module Navigation

- Mobile: form, quản lý và danh sách dùng bottom sheet bo góc trên, bám đáy vùng hiển thị; nội dung cuộn dọc, footer hành động giữ trong khung. Kéo xuống từ tay nắm để đóng, vẫn giữ kiểm tra dữ liệu chưa lưu và trạng thái đang xử lý.
- Popup cập nhật phần mềm và xác nhận giữ dạng nhỏ căn giữa. Desktop giữ hộp thoại căn giữa.
- Đồng bộ lại vùng hiển thị khi resize, đổi hướng, focus/blur, mở sheet và quay lại app; phục hồi kích thước sau bàn phím, tránh giữ chiều cao cũ tạo khoảng trống dưới sheet.
- Thêm chỉ có một sheet danh sách module; bỏ lưới module ở trang nền. Đóng khi chưa chọn module quay về màn trước; từ màn quản lý có thể mở lại danh sách module.
- Tên module hiển thị đầy đủ và được xuống dòng. Nút hành động nhỏ giữ một dòng; Hủy/Đóng bên trái, Lưu/Xác nhận bên phải.
- Không cần chạy migration mới. App 2.9.4 / DB 2.9.0. Giữ các migration hiện có; không chạy lại SQL đã áp dụng.

## V2.9.3 — Mobile Layout & Interaction Fix

- Chuẩn hóa nhóm hành động: Hủy/Đóng bên trái, Lưu/Xác nhận bên phải; chuyển cả nút đóng header sang trái. Label nút một dòng, chức năng chính ở bên phải cùng hàng tiêu đề.
- Modal mobile phủ đầy visual viewport, nằm trên thanh điều hướng; input/date/select không tràn cha, cuộn dọc trong nội dung, chặn kéo ngang ngoài ý muốn. Desktop giữ hộp thoại căn giữa.
- Người giữ quỹ, người thanh toán và người đứng tên đặt chỗ chọn từ người tham gia; không nhập tên tùy ý. API thiết lập quỹ kiểm tra người giữ đang thuộc chuyến. Dữ liệu tên cũ được giữ, không tự xóa.
- Chi phí: Tổng quan / Dự toán / Đối chiếu / Thực chi / Báo cáo; tab có cuộn ngang rõ khi màn quá nhỏ. Căn lại hai hàng block xanh và đồng nhất hai KPI của Ví.
- Nút Quick kéo thả, tự bám mép gần nhất, nhớ vị trí theo tài khoản; mũi tên thu gọn 26px. Kéo không mở nhầm Command Center.
- Bỏ banner Smart Defaults, mô tả Form thông minh và nội dung giải thích kỹ thuật trong Ví. Giữ giá trị mặc định và nút Thêm chi tiết gọn.
- Không cần chạy migration mới. App 2.9.3 / DB 2.9.0.

## V2.9.2 — Finance Overview & Fund UX Polish

- Khôi phục block xanh trên toàn bộ ba tab Chi phí: Dự toán hiện tại, Thực chi ròng, Còn/Vượt dự toán và Số dư quỹ thực tế. Quỹ chưa thiết lập/đang tải/offline có nhãn riêng; không nhầm ngân sách với tiền mặt.
- Giảm lặp: bỏ số dư ở card quỹ Tổng quan và số còn ngân sách trong Ví; giữ Đã thu/Mục tiêu, Cá nhân còn ứng, bình quân/người và mức chi/ngày. Dự toán gốc vẫn ở Đối chiếu dự toán.
- Quản lý quỹ dùng một vùng cuộn; danh sách gọn, tìm thành viên, hướng dẫn thiết lập, nút primary đúng màu app. Mở thao tác thành màn nhập riêng thay vì đẩy form xuống dưới danh sách; footer Lưu/Hủy bám cuối màn nhập. Chứng từ/ghi chú mở khi cần; tiền VNĐ có dấu phân cách hàng nghìn.
- Banner và module dùng chung cache truy vấn, tự cập nhật sau giao dịch; API/RLS, version, idempotency và công thức quỹ giữ nguyên. Không cần chạy migration mới, App 2.9.2 / DB 2.9.0.

## V2.9.1 — Deployment Lockfile Fix

- Tạo lại package-lock.json bằng npm; bổ sung tslib 2.9.1 tại nhánh @swc/helpers và các bản ghi dependency thiếu. Giữ các phiên bản dependency trực tiếp, giữ Vercel dùng npm ci.
- App 2.9.1 / database 2.9.0. Không cần chạy migration mới; nếu chưa chạy migration quỹ V2.9.0 thì vẫn phải hoàn thành trước khi dùng quỹ.
- Deploy lại source mới, không bật Use existing Build Cache ở lần redeploy kiểm tra này. Install Command: npm ci; Build Command: npm run build; Node 24.x.

## V2.9.0 — Trip Fund & Settlement

- Chi phí gọn còn **Tổng quan · Dự toán · Thực chi**. Quỹ nằm trong Tổng quan; Đối chiếu mở từ Dự toán, Báo cáo mở từ Tổng quan.
- Quỹ có người giữ, mức đóng/hạn đóng theo thành viên, đóng nhiều đợt, thu thực tế, hoàn ứng theo khoản chi và trả tiền dư. Sổ giao dịch giữ lịch sử, sửa sai bằng giao dịch hủy.
- Nguồn thực chi: **Quỹ chuyến đi / Cá nhân ứng trước**. Hoàn tiền kế thừa nguồn khoản gốc. Đóng quỹ, hoàn ứng, trả quỹ không cộng thêm thực chi. Kiểm tra số dư, mức hoàn, quyền và chống ghi trùng tại database.
- Quỹ đã tải có thể xem offline; giao dịch quỹ cần online. Backup ứng dụng và restore-as-copy bao gồm sổ quỹ, mức đóng và nguồn tiền của chi phí. Có xuất JSON sổ quỹ riêng.
- Chi tiết đặt chỗ trên mobile xếp nhãn/giá trị dọc; giờ nhận/trả tách dòng, ngày DD/MM/YYYY; không còn cột nhãn vỡ thành từng chữ.
- **Bắt buộc chạy migration mới** `202611010002_v290_trip_fund.sql` sau V2.8.0. Bản TXT cùng nội dung được gửi riêng. Xem [hướng dẫn V2.9.0](docs/UPGRADE-V2.9.0.md).

## V2.8.0 — Bookings & Travel Documents

- Module Đặt chỗ & tài liệu: chuyến bay/tàu xe, khách sạn, thuê xe, tour, vé và tài liệu HTTPS; mã xác nhận, người đứng tên, số lượng, múi giờ, nhận/trả qua đêm, hạn thanh toán/hủy, trạng thái và ghi chú.
- Liên kết hoạt động/dự toán/đặt chỗ; số đã trả ròng lấy từ thực chi/hoàn tiền của dự toán liên kết, không tạo thêm khoản chi tự động. Xuất JSON riêng.
- Mobile: Thêm mở lưới module hai cột theo mẫu tham chiếu; chọn module đi thẳng tới màn hình quản lý riêng. Desktop giữ nhóm quản lý hiện hữu.
- Footer chỉ hiển thị version và chấm xanh/vàng/đỏ, có mô tả cho trình đọc màn hình; không còn chữ “Đang kết nối”.
- Đặt chỗ/tài liệu đã tải được cache IndexedDB theo user/chuyến; thêm/sửa/xóa cần online. RLS + RPC kiểm tra quyền, version và operation ID; xóa mềm và audit.
- **Migration bắt buộc:** App/DB 2.8.0, chạy `202611010001_v280_bookings_documents.sql` sau V2.4.1. File TXT được bàn giao riêng. Xem [docs/UPGRADE-V2.8.0.md](docs/UPGRADE-V2.8.0.md).

## V2.7.0 — Mobile Navigation & Interaction Polish

- Popup cập nhật thành bottom sheet mobile, nút lớn cạnh nhau, cuộn trong vùng nội dung và bám visual viewport; desktop giữ popup căn giữa.
- Timeline tận dụng toàn bộ chiều ngang, giảm khoảng cách/card, thu gọn ghi chú và chỉnh giờ trong mục mở thêm; giữ các thông tin và hành động hiện có.
- Màn hình Thêm mobile chọn nhóm rồi chọn đúng mục trong bottom sheet: người tham gia, phân quyền, mẫu, báo cáo, dữ liệu/vận hành; không bung toàn bộ danh sách lên trang chính.
- Vuốt ngang lịch trình, khoản chi và media để hiện thao tác; giữ nút bấm thường cho bàn phím/desktop. Vuốt không tự xóa; quyền và xác nhận vẫn qua luồng cũ.
- Lịch sử điều hướng tab; Back đóng popup trước, giữ cảnh báo bản nháp/busy và khôi phục scroll theo tab; tăng vùng chạm cho bộ lọc và thao tác.
- **Không cần chạy migration mới.** App 2.7.0 / database 2.4.1. Xem [docs/UPGRADE-V2.7.0.md](docs/UPGRADE-V2.7.0.md).

## V2.6.0 — UI/UX Motion & Visual Polish

- Chuẩn hóa typography, khoảng cách, bán kính, nút, form, card và empty/loading/error state bằng lớp `app/polish.css`; màu semantic tương thích Sáng/Tối.
- Chuyển tab fade 120 ms, popup 180 ms, bottom sheet trên mobile cho Command Center và danh sách chuyến; hover/press ngắn, không trì hoãn tác vụ. Tôn trọng `prefers-reduced-motion`.
- Chỉ báo đang lưu/đăng nhập/cập nhật, `aria-busy`, khóa đóng popup khi đang ghi; đóng form trả focus về nút mở hoặc điều hướng đang chọn.
- Thông báo thành công/thông tin/cần chú ý có icon và nhãn; tự ẩn sau 6 giây, tạm dừng khi hover/focus, có nút đóng. Lỗi lưu giữ dữ liệu để thử lại.
- Sửa `DATABASE_VERSION` của source V2.5.0 từ `2.5.0` về schema thực tế **2.4.1**; thêm kiểm thử đối chiếu capability database.
- **Không cần chạy migration mới.** App **2.6.0**, database **2.4.1**. Hướng dẫn: [docs/UPGRADE-V2.6.0.md](docs/UPGRADE-V2.6.0.md).
- Tiếp theo: **V2.7.0 — Mobile Navigation & Interaction Polish**.

## V2.5.0 — Performance, Loading & Perceived Speed

- Tải riêng Editor, viewer ảnh, quản trị, roadmap, readiness, Media và Analytics khi mở; có skeleton theo khu vực.
- Ghi nhận kết quả lưu ngay sau khi server chấp nhận, cập nhật cache/local rồi đối chiếu nền. Sửa chi tiêu không tải lại danh sách chuyến; gộp Realtime và lượt đọc sau lưu, giữ polling dự phòng.
- Memo hóa báo cáo, lịch và dữ liệu suy ra; chỉ dựng nhật ký khi mở Media, analytics khi mở Thêm; bỏ thời gian chờ splash tối thiểu. API vẫn xác thực người dùng và quyền tại server.
- Popup **Có phiên bản mới → Cập nhật / Để sau**, kiểm tra mỗi phút khi app hiển thị, khi focus/online và khi worker mới sẵn sàng. Nút Cập nhật tự chuyển worker rồi tải lại bình thường; không cần hard reload hoặc đóng app.
- Không cập nhật khi đang lưu hoặc có biểu mẫu chưa lưu. Giữ queue offline, chuyến/tab/bộ lọc/vị trí đang xem; tab khác không bị ép tải lại. Nếu mạng lỗi, giữ trang hiện tại và cho thử lại.
- Build tự tạo manifest cache cho cả các module tải riêng, giữ offline và một shell trước đó cho tab cũ.
- **Không migration mới:** App **2.5.0**, database tiếp tục **2.4.1**. Hướng dẫn tại [docs/UPGRADE-V2.5.0.md](docs/UPGRADE-V2.5.0.md).
- Phiên bản kế tiếp: **V2.6.0 — UI/UX Motion & Visual Polish** theo roadmap hiện có.

## V2.4.1 — Travel Reliability Fix

- Ví, báo cáo và xuất CSV phản ánh ngay thực chi/dự toán đang chờ đồng bộ offline.
- Giữ hoạt động qua đêm ở Current và bộ lọc lịch; tính ngày chuyến thống nhất từ ngày khai báo hoặc lịch trình (bao gồm ngày kết thúc chặng qua đêm).
- Tuyến dài được chia đoạn nối tiếp, tối đa 3 điểm trung gian mỗi đoạn để không bỏ điểm trên điện thoại.
- Năm quyền độc lập: **Mời thành viên / Đổi quyền / Thu hồi / Xóa chuyến đi / Chốt dự toán**. Owner có toàn quyền; Editor/Viewer cũ không tự được cấp quyền đặc biệt. Chỉ Owner được cấp năm quyền này; người có Đổi quyền chỉ đổi vai trò cơ bản của thành viên khác.
- Nút **Xóa chuyến đi** nằm trong **Thêm → Chuyến đi, thành viên & kế hoạch**, chỉ hiện khi được cấp quyền. Xóa mềm, cần online và xử lý hết queue của chuyến trước khi xóa; Owner khôi phục trong thùng rác.
- **Sáng / Tối / Thiết bị** ở Thêm, nút đổi nhanh trên thanh trên cùng và màn hình đăng nhập. Lưu lựa chọn tại thiết bị, tự theo hệ điều hành khi chọn Thiết bị; không đảo màu ảnh.
- **Có migration bắt buộc:** App/DB **2.4.1**. Nếu đang dùng App 2.4.0 / DB 1.4.0, chỉ chạy `supabase/migrations/202610310001_v241_travel_reliability_permissions.sql`, sau đó deploy source và cập nhật PWA `tripflow-shell-v241`. Không reset database, không chạy lại migration đầu.
- Xem hướng dẫn từng bước tại [docs/UPGRADE-V2.4.1.md](docs/UPGRADE-V2.4.1.md).
- Phiên bản tiếp theo: **V2.5.0 — Performance, Loading & Perceived Speed**.

## V2.4.0 – Offline & Sync Reliability Pro

- Nâng offline từ queue cơ bản lên offline-first cho dữ liệu cốt lõi: Trip update, Item, Budget, Expense, Participant và Media.
- Optimistic UI + cache IndexedDB: thao tác offline xuất hiện ngay và vẫn còn sau khi đóng/mở lại app.
- Queue compaction gộp create/update hoặc nhiều update cùng record, triệt tiêu create→delete trước khi sync và giữ nguyên version gốc để tránh conflict giả.
- Retry mạng/5xx theo exponential backoff 2s → 5 phút; tự tiếp tục khi online/focus/pageshow.
- Tự phục hồi queue `sending` bị gián đoạn sau crash/đóng PWA.
- Query cloud luôn overlay các mutation pending/sending nên background refresh không làm biến mất dữ liệu đang chờ sync.
- Conflict 409 không retry mù: hỗ trợ **Giữ bản trên máy** (rebase version mới nhất) hoặc **Dùng bản cloud**.
- Tiếp tục dùng `operationId` + `private.mutation_receipts` hiện có để chống duplicate khi retry.
- Không đổi schema; App `2.4.0` tiếp tục dùng Database `1.4.0`. Service worker `tripflow-shell-v240`.
- Phiên bản tiếp theo: **V2.5.0 – Performance, Loading & Perceived Speed**.

## V2.3.0 – Trip Daily Command Center

- Tái cấu trúc **Tổng quan** theo ngữ cảnh, không tạo thêm tab Hôm nay và không chồng thêm dashboard lên giao diện cũ.
- Khi chuyến đang diễn ra: ưu tiên **Đang diễn ra**, **Tiếp theo**, timeline hôm nay, chi hôm nay và các mục cần chú ý.
- Maps, Ghi chi, Tôi đã đến và Hoàn thành có thể thao tác ngay từ activity card; Ghi chi kế thừa budget/category theo activity và Smart Default người trả.
- Trước chuyến: hiển thị countdown, điểm đầu tiên và snapshot kế hoạch. Sau chuyến: chuyển sang tổng kết lịch trình, chi phí và media.
- Tinh gọn dashboard cũ thành 4 chỉ số compact để giảm chiều dài và độ rối của Tổng quan.
- Thêm domain `daily-command-center` và regression test cho current/next, tiền hôm nay và phase trước/sau chuyến.
- Không đổi schema; App `2.3.0` tiếp tục dùng Database `1.4.0`. Service worker `tripflow-shell-v230`.
- Phiên bản tiếp theo: **V2.4.0 – Offline & Sync Reliability Pro**.

## V2.2.1 – Travel Wallet Compact CTA Fix

- Thu nhỏ nút **Ghi chi tiêu** trong Travel Wallet thành CTA compact ở góc phải, không còn `width: 100%` trên mobile.
- Bỏ dòng phụ **Thêm khoản mới** khỏi CTA để giảm chiều cao và giữ phần mô tả Ví chuyến đi cân đối.
- Thêm active/hover transition nhẹ cho CTA; không thêm animation nặng trong bản hotfix.
- Mở rộng roadmap sau V2.3.0 với các nhánh **Offline & Sync Reliability**, **Performance/Loading/Perceived Speed**, **UI/UX Motion & Visual Polish** và **Mobile Navigation & Interaction Polish**.
- Không đổi schema; App `2.2.1` tiếp tục dùng Database `1.4.0`. Service worker `tripflow-shell-v221`.
- Phiên bản tính năng tiếp theo: **V2.3.0 – Trip Daily Command Center**.

## V2.2.0 – Smart Forms & Defaults

- Form tạo mới chuyển sang progressive disclosure: trường quan trọng hiển thị trước, trường ít dùng nằm trong **Thêm chi tiết**.
- Giữ Smart Defaults theo dữ liệu gần nhất/ngữ cảnh hiện tại và vẫn cho phép mở chi tiết để thay đổi đầy đủ.
- Form chỉnh sửa dữ liệu cũ vẫn hiển thị đầy đủ để tránh che thông tin đang tồn tại.
- Sửa nút **X** của Quick dock luôn nằm trên lớp của nút ⚡, không còn bị chìm bên dưới.
- Không đổi schema; App `2.2.0` tiếp tục dùng Database `1.4.0`. Service worker `tripflow-shell-v220`.

## 2.1.0 — Smart Quick Actions & Contextual UX

- Chỉ nâng cấp **Quick Entry trong Command Center (nút ⚡)**, không thêm ô nhập hoặc màn hình Quick Entry mới ở nơi khác.
- Một câu lệnh như `chi 150k ăn trưa viện hải dương học HuyVo` được tách thành: loại giao dịch Chi tiền, số tiền 150.000đ, nội dung Ăn trưa, khoản dự toán khớp gần đúng và người thanh toán lấy từ người tham gia chuyến đi.
- Match người thanh toán theo dữ liệu `participants`; ưu tiên exact match, hỗ trợ fuzzy match có kiểm soát và không tự chọn khi có nhiều người gần giống.
- Match khoản dự toán theo tiêu đề `budgets`, bỏ qua các tiền tố phổ biến như Vé/Chi phí/Dự toán và category để nhận các cách nhập rút gọn như `hải dương học`.
- Nếu có nhiều kết quả gần giống, Command Center hiển thị lựa chọn ngay trong preview; người dùng chọn một lần rồi lưu, không phải mở form.
- Preview hiển thị rõ Chi tiền, số tiền, category, ngày, người trả, dự toán và mức tin cậy trước khi lưu.
- Category tiếp tục dùng lịch sử/từ khóa, nhưng khi đã gắn một budget hợp lệ thì dùng category của budget để giữ dữ liệu tài chính nhất quán.
- Không đổi schema; App `2.1.0` tiếp tục dùng Database `1.4.0`. Service worker `tripflow-shell-v210`.
- Phiên bản tiếp theo: **V2.2.0 – Smart Forms & Defaults**.

## 2.0.0 — TripFlow Pro Travel Operating System

- Thêm **Trip Operating Center** tại Tổng quan để nối Planning, Live Trip, Finance và Memories trong một workspace điều hành.
- Thiết kế lại nút **Ghi chi tiêu** trong Travel Wallet theo dạng ngang cân đối, tối ưu mobile.
- Trường **Người thanh toán** khi ghi/chỉnh sửa chi tiêu chuyển sang chọn từ **Người tham gia chuyến đi**; dữ liệu payer cũ ngoài danh sách vẫn được giữ khi chỉnh sửa để không mất dữ liệu lịch sử.
- Không thay đổi schema; App `2.0.0` tiếp tục dùng Database `1.4.0`. Service worker `tripflow-shell-v200`.

## 1.9.0 — Expense Intelligence & Travel Wallet

- Thêm tab **Ví du lịch** trong Chi phí với số tiền còn lại/vượt dự toán, bình quân theo người, mức chi an toàn mỗi ngày và thanh tiến độ chuyến đi so với % ngân sách đã sử dụng.
- Cảnh báo tốc độ chi tiêu theo tiến độ ngày của chuyến: trước chuyến, đang phù hợp, chi nhanh hơn tiến độ, vượt dự toán hoặc chưa có dự toán để đối chiếu.
- Tổng hợp **Ai đã thanh toán** theo `payer`; refund làm giảm phần đã trả và tự kế thừa người trả của khoản gốc khi refund không ghi payer. V1.9.0 chưa tự suy diễn chia nợ/quyết toán.
- Thêm **Favorite / Recent Expense** lưu cục bộ theo user + chuyến; có thể đánh dấu sao và dùng lại khoản chi để mở form đã điền sẵn.
- Gợi ý nhóm chi khi nhập nội dung: ưu tiên category của khoản có cùng tên trong lịch sử, sau đó suy luận từ các từ khóa du lịch phổ biến; người dùng quyết định có áp dụng hay không.
- Quick Entry dùng chung bộ suy luận category V1.9.0 để tránh hai nguồn rule khác nhau.
- Không đổi schema; App `1.9.0` tiếp tục dùng Database `1.4.0`. Service worker `tripflow-shell-v190`.
- Phiên bản tiếp theo theo roadmap: **V2.0.0 – TripFlow Pro Travel Operating System**.

## 1.8.4 — Google Maps Coordinate Integrity Fix

- Giữ nguyên chính xác link Google Maps người dùng paste vào `map_url`; mở form chỉnh sửa vẫn thấy short link ban đầu, không tự thay thành URL `query=lat,lng`.
- Resolver short link chuyển sang `GET` như điều hướng trình duyệt, không dùng HEAD làm nguồn tọa độ.
- Ưu tiên `!3dlat!4dlng` (tọa độ địa điểm) trước `@lat,lng` (viewport), tránh lấy nhầm tâm bản đồ.
- Loại bỏ việc quét tọa độ tự do/JSON trong toàn bộ HTML Google; HTML fallback chỉ đọc tọa độ từ URL Google Maps đáng tin cậy như canonical, `og:url`, meta refresh hoặc JS redirect.
- Thêm regression test cho trường hợp La Vague có tọa độ đúng `12.2200647,109.2036555` nhưng HTML/viewport chứa cặp sai `-77.844326,39.0267995`; kết quả sai phải bị bỏ qua.
- App version `1.8.4`, service worker `tripflow-shell-v184`; Database vẫn yêu cầu `1.4.0`, không có migration mới.

## 1.8.3 — Google Maps Short Link Resolver Fix

- Chuyển resolver `maps.app.goo.gl` sang Node.js runtime và raw `https.request` để đọc chính xác `Location` header trên môi trường deploy.
- Resolver thử `HEAD` trước, fallback `GET`, parse tọa độ ngay tại từng `Location`/`Refresh` trước khi request redirect tiếp theo; không cần mở trang Google Maps cuối nếu URL redirect đã có `@lat,lng` hoặc `!3d...!4d...`.
- Bổ sung fallback canonical/`og:url`/meta refresh/JavaScript redirect/HTML, decode URL nhiều lớp và hỗ trợ `google.com.vn`.
- API `/api/maps/resolve?url=...&debug=1` trả trace theo từng hop để chẩn đoán chính xác status/Location khi môi trường deploy không resolve được.
- Thêm test bắt buộc với link mẫu `https://maps.app.goo.gl/ySoEVvZNbrSWqu168` → `12.2200647,109.2036555` bằng response redirect mô phỏng.
- App version `1.8.3`, service worker `tripflow-shell-v183`; Database vẫn yêu cầu `1.4.0`, không có migration mới.

## 1.8.2 — Google Maps Share & Media Zoom Fix

- Hỗ trợ đúng luồng người dùng Google Maps → Share/Chia sẻ → Copy link/Sao chép đường liên kết, kể cả `maps.app.goo.gl`.
- API Maps resolve theo redirect Google-only, đọc thêm URL/canonical/HTML để lấy tọa độ khi tọa độ không nằm trực tiếp trong URL cuối.
- Sau khi đọc được tọa độ, TripFlow chuẩn hóa thành URL Google Maps dạng `query=lat,lng` để các lần dựng route sau không phụ thuộc link rút gọn.
- Khóa pinch zoom trên toàn bộ giao diện/PWA; chỉ trình xem **Ảnh** được zoom riêng 1x–5x, kéo ảnh, double-click trên desktop và có nút +/-/reset.
- Tăng app version lên `1.8.2`, service worker cache `tripflow-shell-v182`; Database vẫn yêu cầu `1.4.0`, không có migration mới.

## 1.8.1 — Map Link, Media Viewer & PWA Keyboard Fix

- Tự động resolve link Google Maps rút gọn `maps.app.goo.gl` ở server để lấy URL đầy đủ/tọa độ, đồng thời chuẩn hóa link khi lưu activity và tự xử lý các activity cũ khi mở tab Bản đồ.
- Làm rõ Map view trong app là **sơ đồ vị trí tương đối**; tuyến thực tế vẫn mở bằng Google Maps. Có trạng thái đang đọc tọa độ và cảnh báo khi Google không trả được tọa độ.
- Fix editor/PWA trên iOS khi bàn phím mở bằng cách bám `visualViewport.offsetTop + height`, giữ header/body/footer trong vùng nhìn thấy thay vì bị đẩy/ép bất thường.
- Media hỗ trợ preview Google Drive tốt hơn bằng thumbnail; ảnh mở trực tiếp trong lightbox TripFlow, album Drive có thể mở dạng embedded grid và video/document Drive dùng preview khi nguồn cho phép.
- App version `1.8.1`, service worker `tripflow-shell-v181`, Database yêu cầu vẫn `1.4.0`; không có migration mới.
- Phiên bản tiếp theo: V1.9.0 – Expense Intelligence & Travel Wallet.

## 1.8.0 — Map, Places & Route Intelligence

- Thêm chế độ **Bản đồ** bên cạnh Timeline/Board; chọn ngày, xem điểm dừng, mở từng địa điểm hoặc toàn tuyến trên Google Maps.
- Phân tích tọa độ từ các URL Google Maps phổ biến; ước tính quãng đường đường bộ, thời gian di chuyển và cảnh báo khi khoảng trống giữa hai hoạt động quá ngắn.
- Map view vẫn hoạt động theo tên địa điểm khi chưa có tọa độ; phần ước tính được ghi rõ là tham khảo, không thay thế route thực tế từ Google Maps.
- Fix PWA taskbar bằng cách cố định app viewport và chuyển scrolling vào `.app-body`, giữ thanh điều hướng ở một độ cao vật lý thay vì bị kéo lên khi scroll/iOS visual viewport thay đổi.
- Nút ⚡ Quick bỏ gesture kéo; thêm dấu × nhỏ để ẩn. Sau khi ẩn mới hiện mũi tên mở lại.
- Bỏ card Command Center khỏi Tổng quan vì đã có nút ⚡ toàn app.
- Thêm motion cơ bản chuyên nghiệp cho page/card/button/dialog và tôn trọng `prefers-reduced-motion`.
- App version `1.8.0`, service worker `tripflow-shell-v180`, Database yêu cầu vẫn `1.4.0`; không có migration mới.
- Phiên bản tiếp theo: V1.9.0 – Expense Intelligence & Travel Wallet.

## 1.7.0 — Planning Board & Timeline Pro

- Lịch trình có hai chế độ Timeline/Planning Board; Board nhóm activity theo ngày và hỗ trợ kéo thả đổi ngày trên desktop.
- Mobile/desktop đều có đổi ngày trực tiếp và chỉnh giờ nhanh ±30 phút mà không cần mở modal.
- Fix header tab Thực chi trên mobile để nút Ghi chi tiêu thẳng hàng, không ép tiêu đề rớt dòng; giữ trải nghiệm nhất quán với tab Dự toán.
- Nút ⚡ Quick chuyển sang thao tác kéo sang phải để ẩn; mũi tên chỉ xuất hiện khi icon đã ẩn và bấm mũi tên sẽ trượt icon ra lại.
- App version `1.7.0`, service worker `tripflow-shell-v170`, Database yêu cầu vẫn `1.4.0`; không có migration mới.
- Phiên bản tiếp theo: V1.8.0 – Map, Places & Route Intelligence.

## 1.6.0 — Smart Defaults & Context Automation

- Smart Defaults tự gợi ý người trả, nhóm chi, budget, ngày chi, giờ hoạt động và địa điểm từ dữ liệu/context hiện tại.
- Quick Entry hiển thị cảnh báo vượt dự toán, khoản chi bất thường, trùng giờ hoặc nằm ngoài phạm vi chuyến trước khi lưu.
- Bottom taskbar trong PWA standalone được neo cố định sát đáy, tôn trọng safe-area và chống dịch chuyển khi scroll.
- Nút ⚡ Quick chuyển thành dock có thể thu sang mép phải, giữ lại mũi tên để mở lại; trạng thái được nhớ theo user.
- Mục Thêm được gom thành Module Hub theo block đóng/mở để giảm mật độ thông tin.
- App version `1.6.0`, service worker `tripflow-shell-v160`, Database yêu cầu vẫn `1.4.0`; không có migration mới.
- Phiên bản tiếp theo: V1.7.0 – Planning Board & Timeline Pro.

## 1.5.1 — Deploy Typecheck Fix

- Sửa lỗi `TS18048: data is possibly undefined` ở thao tác **Lặp khoản chi gần nhất** bằng optional access trước khi đọc `expenses`.
- Sửa lỗi `TS2304: Cannot find name dateLabel` trong domain test bằng import đúng `dateLabel` từ `lib/domain`.
- Tăng App version lên `1.5.1` và service worker cache lên `tripflow-shell-v151`.
- Không có migration database; Database requirement vẫn là `1.4.0`.

## 1.5.0 — Quick Entry & Command Center

- Thay **Thao tác nhanh** bằng **Command Center** có Quick Entry một dòng; hỗ trợ nhập trực tiếp từ dashboard hoặc nút ⚡ nổi toàn app.
- Parser rule-based hiểu số tiền kiểu `350k`, `1tr2`, `1.250.000`, ngày `hôm nay/ngày mai/DD/MM` và giờ `7:30/14h`; không phụ thuộc AI.
- Tự phân loại nhanh khoản chi theo nội dung phổ biến (Di chuyển/Ăn uống/Lưu trú/Tham quan/Mua sắm), chỉ tự gắn budget theo ngữ cảnh khi category khớp để tránh liên kết sai.
- Preview trước khi lưu, **Lưu nhanh**, **Lưu & nhập tiếp** hoặc chuyển sang form đầy đủ; thao tác offline được đưa vào queue hiện có.
- Lưu tối đa 6 câu nhập gần đây theo user/chuyến trong localStorage và cho chọn lại bằng một chạm.
- Bổ sung **Lặp khoản chi gần nhất** ở Command Center và shortcut `Ctrl/Cmd + K`; `/` tiếp tục mở tìm kiếm xuyên chuyến đi.
- Floating Quick button được đặt trên desktop/mobile, tránh làm dày dashboard.
- Service worker nâng cache shell lên `tripflow-shell-v150`.
- Không có migration database mới; App V1.5.0 tiếp tục dùng Database V1.4.0.
- Roadmap đổi hướng sang nhập nhanh/thông minh: tiếp theo **V1.6.0 – Smart Defaults & Context Automation**.

## 1.4.0 — Smart Planning Templates & Reuse

- Thêm Planning Templates cá nhân: lưu chuyến hiện tại làm mẫu, tạo chuyến mới và tự dời lịch theo ngày bắt đầu mới.
- Tái sử dụng lịch trình, dự toán và người tham gia; không sao chép thực chi, media hay lịch sử vận hành.
- Ngày kết thúc chuyến và giờ kết thúc hoạt động không còn bắt buộc.
- Input tiền định dạng `xxx.xxx.xxx` ngay khi nhập.
- Dashboard chuyển Smart Workspace vào nút ⚡ để giảm mật độ thông tin; lịch sử lịch trình chuyển vào dialog riêng.
- Bổ sung nút **Ghi chi tiêu** trong tab Thực chi và nút ✓ lấy ngày/giờ hiện tại ở trường ngày giờ.
- Database nâng lên **V1.4.0** qua migration `202609290001_v140_smart_planning_templates_reuse.sql`.
- Roadmap đánh dấu V1.4.0 ✅; V1.5.0 được điều chỉnh thành **Quick Entry & Command Center** theo roadmap tối ưu thao tác.

## 1.3.0 — Media, Memories & Storytelling

- Nâng Media thành **Travel Journal** theo ngày, liên kết hoạt động và địa điểm.
- Bổ sung metadata `taken_on`, `is_highlight`, `is_cover`, `story_order`; mỗi chuyến chỉ có một cover đang hiệu lực.
- Thêm **Trip Highlights**, cover hero, caption/câu chuyện và thứ tự kể chuyện.
- Post-Trip Report/CSV/JSON bổ sung phần Memories & Storytelling.
- Media được đưa vào Supabase Realtime; backup/restore giữ nguyên metadata storytelling.
- Database nâng lên **V1.3.0** qua migration `202609280006_v130_media_memories_storytelling.sql`.
- Roadmap đánh dấu V1.3.0 ✅; tiếp theo **V1.4.0 – Smart Planning Templates & Reuse**.

## 1.2.0 — Smart Trip Workspace & Quick Actions

- Thêm **Smart Workspace** trên Tổng quan với quick add cho chi tiêu, hoạt động, media và hành động Live Trip theo Current/Next.
- Tìm kiếm xuyên chuyến đi cho lịch trình, chi tiêu, dự toán, media và người tham gia; so khớp không dấu tiếng Việt và điều hướng đúng module/ngày.
- Thêm nút search trên topbar và phím tắt `/` trên desktop; dialog tìm kiếm có gợi ý thao tác nhanh khi chưa nhập từ khóa.
- Quick Expense tự gắn budget của activity hiện tại/tiếp theo khi có thể; Quick Media tự gắn activity theo ngữ cảnh.
- Bổ sung responsive styles riêng cho workspace/search để không tái phát lỗi overflow mobile của V1.1.x.
- Service worker cache shell nâng lên `tripflow-shell-v120`.
- Không đổi schema database; App V1.2.0 tiếp tục dùng Database Stable V1.0.0.
- Roadmap đánh dấu V1.2.0 ✅; tiếp theo V1.3.0 – Media, Memories & Storytelling.

## 1.1.1 — Mobile Layout Fix

- Sửa lỗi CSS cascade của Brand Refresh làm `.app-body` vẫn giữ `margin-left: 248px` trên màn hình điện thoại, khiến toàn bộ nội dung bị ép sang phải và tiêu đề vỡ chữ.
- Re-assert mobile shell/topbar/main padding ở breakpoint `<= 760px`; giữ safe-area cho iPhone nhưng không cộng trùng khoảng đệm.
- Tối ưu page heading và trip selector ở màn hình nhỏ để không đẩy nút thao tác ra ngoài viewport.
- Thêm regression test kiểm tra `.app-body` phải bắt đầu từ mép trái và chiếm đủ chiều rộng viewport ở 320/390px.
- Bump PWA shell cache sang `tripflow-shell-v110-hotfix1` để thiết bị đã cài app nhận CSS mới.
- Không có migration database mới; app tăng PATCH lên V1.1.1, database vẫn giữ V1.0.0.

## 1.1.0 — Brand Refresh, Professional UI & Travel Identity

- Thiết kế lại logo/app icon theo concept **Location Pin + Travel Route**, đồng bộ favicon/PWA icon 192/512.
- Làm mới hệ màu **Ocean Teal + Sunset**, typography, card, button, form, modal, navigation, Live Trip và dashboard để giao diện nhất quán/professional hơn.
- Splash loading ban đầu mới với logo, route animation và tagline `PLAN · GO · REMEMBER`; giữ thời gian tối thiểu ngắn để tránh flash trắng.
- Auth trở thành travel landing experience với nền gradient, waypoint visual và feature chips; mobile login giữ giao diện gọn.
- Bottom navigation mobile chuyển thành floating glass dock; sidebar/topbar desktop nâng cấp glass/surface/shadow.
- Service worker cache shell nâng lên `tripflow-shell-v110`.
- V1.1.0 **không đổi schema database**; app version 1.1.0 tiếp tục tương thích database Stable 1.0.0, release-readiness hiển thị riêng App/DB.
- Roadmap mở giai đoạn 1.x: V1.1.0 ✅, tiếp theo V1.2.0 Smart Trip Workspace & Quick Actions, sau đó V1.3–V1.5.

## 1.0.0 — Stable Production Release

- Chốt kênh phát hành `stable`; app, API và database marker cùng xác minh phiên bản `1.0.0`.
- Thêm migration `202609280005_v100_stable_production_release.sql`; database V0.9.0 sẽ bị nhận diện rõ là chưa đủ cho source V1.0.0.
- Màn hình Release Candidate chuyển thành **Trạng thái Production** và chỉ báo sẵn sàng khi app/database/channel khớp V1.0.0.
- Roadmap 1.0 được đóng hoàn toàn: V0.1.0 → V1.0.0 đều ✅; không tự bịa phiên bản tiếp theo khi chưa chốt phạm vi mới.
- Service worker cache shell nâng lên `tripflow-shell-v100`.
- Bổ sung `docs/UPGRADE-V1.0.0.md` và `docs/PRODUCTION-RUNBOOK.md`; checklist được cập nhật cho phát hành Stable.
- Không thêm nghiệp vụ mới và không thay đổi dữ liệu chuyến đi ở V1.0.0; mục tiêu là phát hành ổn định, vận hành và khả năng rollback có kiểm soát.

## 0.9.0 — Release Candidate & Hardening

- Thêm migration `202609280004_v090_release_candidate_hardening.sql` với schema marker và RPC `tf_release_readiness()`.
- Màn hình **Thêm → Kiểm tra sẵn sàng phát hành** xác minh database, RLS, idempotency, single-active guard và khả năng trình duyệt hiện tại.
- API private bổ sung `Cache-Control: no-store`, `Pragma`, `X-TripFlow-Version`, `X-Request-Id`; mutation kiểm tra same-origin, JSON content type và kích thước payload.
- Security headers bổ sung CSP, Cross-Origin-Resource-Policy và `X-Permitted-Cross-Domain-Policies`.
- Service worker cache shell nâng lên `tripflow-shell-v090`.
- Bổ sung `docs/RELEASE-CHECKLIST.md` và quy trình upgrade/rollback RC.
- Roadmap đánh dấu V0.9.0 ✅; phiên bản tiếp theo là V1.0.0 Stable Production Release.

## 0.8.0 — Trip Analytics & Post-Trip Report

- Dashboard tổng kết mới trong **Thêm**, kèm thẻ tóm tắt trên Tổng quan.
- KPI lịch trình: hoàn thành/bỏ qua/đang xử lý, tỷ lệ completion, số check-in, độ trễ trung bình/lớn nhất và thời lượng kế hoạch/thực tế.
- KPI tài chính: dự toán gốc/hiện tại, thực chi ròng, mức sử dụng ngân sách, chênh lệch, chi phí/người, nhóm chi nhiều nhất và số nhóm vượt dự toán.
- Tổng kết theo ngày kết hợp hoạt động + thực chi; thống kê media/tài liệu và mức gắn với activity.
- Post-trip readiness cảnh báo chuyến chưa kết thúc, activity còn mở, thiếu baseline, integrity warning và thực chi chưa liên kết.
- Export mới: CSV tổng kết, JSON báo cáo và bản in HTML tự chứa.
- Analytics được tính từ dữ liệu nguồn, không lưu tổng độc lập và không cần migration database mới.
- Service worker cache shell nâng lên `tripflow-shell-v080`.
- Roadmap đánh dấu V0.8.0 ✅; phiên bản tiếp theo là V0.9.0 Release Candidate & Hardening.

## 0.7.0 — Backup, Recovery & Operations

- Backup snapshot server-side cho từng chuyến, checksum MD5 để phát hiện payload bị thay đổi, metadata kích thước/thời hạn.
- Backup immutable; Owner có thể tải JSON recovery package hoặc restore thành một chuyến đi mới, không overwrite source.
- Restore remap quan hệ item → budget → expense/refund → media, giữ participant và budget snapshots.
- Thùng rác cho trip/item/budget/expense/media/participant và RPC khôi phục có kiểm tra dependency.
- Retention policy + operations health; không tự purge dữ liệu production ở V0.7.0.
- API `/api/recovery` có Auth, Origin check, validation và lỗi migration V0.7.0 rõ ràng.
- Security headers bổ sung HSTS, Cross-Origin-Opener-Policy và tắt DNS prefetch.
- Roadmap đánh dấu V0.7.0 ✅; phiên bản tiếp theo là V0.8.0 Trip Analytics & Post-Trip Report.
- Migration mới `202609280003_v070_backup_recovery_operations.sql`.

## 0.6.0 — Mobile UX & PWA Stabilization

- Mobile safe-area cho iPhone/Android; topbar, bottom nav, auth và footer tôn trọng vùng hệ thống.
- Dialog/editor fullscreen trên mobile và dùng `visualViewport` để footer thao tác không bị bàn phím che.
- Ghi nhớ tab/filter/scroll theo chuyến trong phiên trình duyệt.
- PWA install/update lifecycle: prompt cài, hướng dẫn Safari iOS, worker update có nút xác nhận và cache shell `v060`.
- Bổ sung yêu cầu Persistent Storage cho cache offline khi trình duyệt hỗ trợ.
- Giữ hotfix policy Collaboration V0.5.0 trong migration riêng và phân biệt lỗi thiếu migration với lỗi policy.
- Roadmap đánh dấu V0.6.0 ✅; phiên bản tiếp theo là V0.7.0 Backup, Recovery & Operations.

## 0.5.0 — Collaboration & Permission Control

- UI cộng tác mới hiển thị quyền hiện tại, số account có quyền, lời mời đang chờ và số participant thực tế.
- Ma trận Owner/Editor/Viewer hiển thị trực tiếp trong màn hình Chia sẻ & phân quyền.
- Chặn lời mời trùng còn hiệu lực và chặn mời owner/member đã có quyền.
- Thêm `updated_at` cho `trip_members` và `trip_invitations`.
- Thêm `trip_access_events` + trigger phát sự kiện granted/role_changed/revoked cho đúng tài khoản bị tác động.
- Realtime mở rộng cho members, invitations, participants và access events; khi quyền thay đổi client refetch trip list/bundle ngay.
- Server RLS/mutation tiếp tục là nguồn quyết định quyền; thiết bị offline chỉ có cache cũ cho đến khi kết nối lại.
- Roadmap đánh dấu V0.5.0 ✅; phiên bản tiếp theo là V0.6.0 Mobile UX & PWA Stabilization.
- Migration mới `202609280001_v050_collaboration_permission_control.sql`.

## 0.4.0 — Live Trip & Realtime

- Live dashboard mới với Current / Next / Late và thời gian còn lại/độ trễ.
- Lịch sử trạng thái `itinerary_events` bất biến cho check-in, complete, skip, reset và auto-complete.
- Status mutation V0.4 vẫn dùng transaction/lock/idempotency cũ và ghi history trong cùng transaction.
- Realtime nhiều thiết bị cho trip, itinerary, live history và expenses; refetch 30 giây vẫn là fallback.
- Hiển thị trạng thái Realtime/Offline ngay trên Live Trip panel.
- Cảnh báo activity active quá giờ và các activity planned đã qua giờ chưa xử lý.
- Roadmap đánh dấu V0.4.0 ✅; phiên bản tiếp theo là V0.5.0 Collaboration & Permission Control.
- Migration mới `202609270003_v040_live_trip_realtime.sql`.

## 0.3.0 — Finance & Reporting Integrity

- Baseline dự toán gốc bất biến; các lần chốt sau được đánh số revision.
- Snapshot lưu metadata `snapshot_no`, `snapshot_kind`, `total_amount`, `item_count`.
- RPC `tf_finance_report` tổng hợp số liệu chuẩn từ database theo nhóm/ngày/hoạt động.
- Đối chiếu dự toán gốc, dự toán hiện tại, tổng chi, hoàn tiền, thực chi ròng và chênh lệch.
- Integrity checks cho refund, liên kết budget/activity và snapshot consistency.
- Tab **Báo cáo** mới trong Chi phí, kèm trạng thái integrity và KPI.
- Export CSV và JSON tài chính nâng cấp.
- Roadmap trong app đánh dấu V0.3.0 ✅; phiên bản tiếp theo là V0.4.0 Live Trip & Realtime.
- Migration mới `202609270002_v030_finance_reporting_integrity.sql`.

## 0.2.0 — Offline, Data Reliability & Master Administration

- IndexedDB cache theo user và queue mutation offline.
- Trạng thái sync: pending, sending, conflict, rejected; tự sync khi mạng trở lại.
- Service worker cho app shell; không cache API/private auth routes.
- Stable ID cho create mutation offline và giữ `operationId` để retry idempotent.
- Account gate + RLS/mutation gate cho tài khoản bị hủy kích hoạt.
- Master dashboard: danh sách user, search, user detail, trip detail, deactivate/reactivate, admin audit.
- Master không được tự deactivate và không deactivate Master khác qua UI/RPC.
- Roadmap hiển thị trong app: V0.1.0 ✅, V0.2.0 ✅; tiếp theo V0.3.0 Finance & Reporting Integrity.
- Migration mới `202609270001_v020_offline_master_admin.sql`.
