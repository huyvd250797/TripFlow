# TripFlow 2.10.1 · Sheet & Cost Sharing UX Fix

Web app quản lý chuyến đi, viết mới từ kế hoạch TripFlow, ưu tiên điện thoại. Giao diện tiếng Việt, tiền VNĐ, ngày DD/MM/YYYY. Frontend và backend triển khai chung trên Vercel; dữ liệu và tài khoản dùng Supabase.

**Bắt đầu:** giải nén → chạy migration theo thứ tự → cấu hình Supabase/Vercel → tạo tài khoản → nếu cần thì nâng một tài khoản thành Master bằng SQL tin cậy → kiểm thử tài chính, online/offline và phân quyền.

ZIP chứa mã nguồn. Vercel không tự tạo database từ ZIP; cần hoàn thành cấu hình dưới đây. Không cần máy chủ backend riêng. Không có dữ liệu mẫu hoặc tài khoản mặc định trong bản chạy thật.

## V2.10.1 — Sheet & Cost Sharing UX Fix

- Thu gọn header bottom sheet: tay nắm 18px, nút đóng 36px, tiêu đề 18px; tổng khoảng 63px với tiêu đề một dòng. Bỏ mô tả phụ khỏi header mobile; popup compact và desktop giữ bố cục riêng.
- Tạo sẵn vùng cuộn native và lớp nội dung, giữ scrollbar gutter ổn định, chạm vùng nội dung sẽ kết thúc animation mở đang chạy để không cạnh tranh với thao tác cuộn. Không chặn hoặc bắt pointer của nội dung; header/tay nắm vẫn kéo đóng được.
- Thêm cách chia thứ ba: Chia đều cho danh sách được chọn. Tích người được chia, tự đếm số người; không cần phần cố định, không chia cho những người ngoài danh sách. Giữ nguyên hai cách chia trước.
- Nút sấm sét và mũi tên thu gọn tính giới hạn theo taskbar thật và chiều cao nút, cho phép kéo sát còn 6px; nhớ vị trí, tự bám mép và xử lý resize.
- Bảng Phân chia chi phí chuyển từ Đối chiếu sang Báo cáo. Thiết lập cách chia vẫn ở từng khoản Dự toán; Đối chiếu tập trung dự toán gốc/hiện tại/thực tế.
- App/DB 2.10.1. Chạy migration 202611010004_v2101_selected_cost_sharing.sql sau V2.10.0 và trước deploy source; TXT gửi riêng. Không reset hoặc chạy lại SQL đã áp dụng.

Xem `docs/UPGRADE-V2.10.1.md` và `docs/VALIDATION-V2.10.1.md`.

## V2.10.0 — Custom Cost Sharing

- Dự toán có đúng hai cách chia: chia đều toàn bộ danh sách người tham gia (không chọn người), hoặc cố định một phần rồi chia đều phần còn lại cho những người được chọn. Có xem trước, làm tròn VNĐ bảo toàn tổng tiền, kiểm tra danh sách và phần cố định.
- Đối chiếu hiển thị phần phải chịu, thanh toán theo người, tổng đã trả và còn trả nhà cung cấp theo khoản dự toán. Cọc nhiều lần cùng khoản không làm thay đổi thỏa thuận chia.
- Cá nhân thanh toán chọn hình thức trả phần phải chịu hoặc ứng trước cần hoàn. Khoản trả trực tiếp không tự thành đóng quỹ/hoàn ứng. Chọn Quỹ chuyến đi ẩn người thanh toán và lưu người trả rỗng ở server.
- Bottom sheet dùng một khung portal fixed bám đáy; chỉ dùng kích thước visual viewport khi bàn phím mở. Mở trượt lên, đóng trượt xuống cả khi lưu/hủy/Back; kéo tay nắm hoặc header theo tay, kéo ngắn trả về, bảo vệ dữ liệu chưa lưu và thao tác đang xử lý. Giảm chuyển động được tôn trọng.
- Thêm: một danh sách module hai cột theo mẫu Mẹ Yêu Bé, màu TripFlow, tên đầy đủ và mô tả từng chức năng; không có menu trùng ở trang nền. Popup cập nhật/xác nhận nhỏ căn giữa, desktop giữ hộp thoại giữa màn hình.
- Bắt buộc chạy `202611010003_v2100_custom_cost_sharing.sql` sau database V2.9.0, trước deploy V2.10.0. App/DB 2.10.0. Không reset hoặc chạy lại SQL cũ. TXT được bàn giao riêng.

Xem `docs/UPGRADE-V2.10.0.md` và `docs/VALIDATION-V2.10.0.md`.

## V2.9.4 — Bottom Sheets & Module Navigation

- Mobile: form, quản lý và danh sách dùng bottom sheet bo góc trên, bám đáy vùng hiển thị; nội dung cuộn dọc, footer hành động giữ trong khung. Kéo xuống từ tay nắm để đóng, vẫn giữ kiểm tra dữ liệu chưa lưu và trạng thái đang xử lý.
- Popup cập nhật phần mềm và xác nhận giữ dạng nhỏ căn giữa. Desktop giữ hộp thoại căn giữa.
- Đồng bộ lại vùng hiển thị khi resize, đổi hướng, focus/blur, mở sheet và quay lại app; phục hồi kích thước sau bàn phím, tránh giữ chiều cao cũ tạo khoảng trống dưới sheet.
- Thêm chỉ có một sheet danh sách module; bỏ lưới module ở trang nền. Đóng khi chưa chọn module quay về màn trước; từ màn quản lý có thể mở lại danh sách module.
- Tên module hiển thị đầy đủ và được xuống dòng. Nút hành động nhỏ giữ một dòng; Hủy/Đóng bên trái, Lưu/Xác nhận bên phải.
- Không cần chạy migration mới. App 2.9.4 / DB 2.9.0. Giữ các migration hiện có; không chạy lại SQL đã áp dụng.

**Nâng từ V2.9.3:** thay source bằng bản này, giữ biến môi trường Supabase trên Vercel, dùng Node 24.x và `npm ci` → `npm run build`. Root Directory là thư mục có `package.json`. Không reset database và không chạy lại migration đã áp dụng. Các SQL trong ZIP dùng cho cài mới/lịch sử nâng cấp.

**Kiểm tra V2.9.4:** xem `docs/VALIDATION-V2.9.4.md`. Bàn phím được mô phỏng trên Chromium; cần thử thêm trên iPhone/Safari thật sau deploy.

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

## Lịch sử V2.8.0 — Bookings & Travel Documents

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

## V2.4.0 nổi bật

- **Offline-first cho dữ liệu cốt lõi:** xem dữ liệu cache và tạo/sửa/xóa lịch trình, dự toán, chi tiêu, người tham gia, media; sửa thông tin chuyến hiện tại khi mạng yếu/mất mạng.
- **Optimistic UI:** thao tác offline hiển thị ngay trên giao diện và được ghi vào IndexedDB, không phải chờ server.
- **Queue compaction:** nhiều lần sửa cùng một record trước khi sync được gộp lại; tạo rồi xóa trước khi có mạng sẽ tự triệt tiêu, giảm request và tránh thao tác trùng.
- **Idempotency:** tiếp tục dùng `operationId` + mutation receipt ở database để retry an toàn, không tạo bản ghi trùng khi request đã tới server nhưng client chưa nhận response.
- **Auto retry:** lỗi mạng/5xx dùng exponential backoff tối đa 5 phút; app tự thử lại khi online, focus lại hoặc mở lại PWA.
- **Crash recovery:** thao tác đang ở trạng thái `sending` khi app bị đóng được phục hồi về hàng đợi và gửi lại an toàn.
- **Conflict resolution:** xung đột version không retry mù; người dùng chọn **Giữ bản trên máy** (rebase lên version cloud mới nhất) hoặc **Dùng bản cloud**.
- **Không migration:** App V2.4.0 tiếp tục dùng Database V1.4.0; service worker `tripflow-shell-v240`.
- **Roadmap tiếp theo:** V2.5.0 – Performance, Loading & Perceived Speed.

## V2.3.0 nổi bật

- **Tổng quan theo ngữ cảnh:** không thêm tab Hôm nay mới và không chồng thêm dashboard; tab **Tổng quan** tự đổi nội dung theo giai đoạn chuyến đi.
- **Đang đi:** ưu tiên **Đang diễn ra → Tiếp theo → Lịch hôm nay → Chi hôm nay → Cần chú ý**.
- **Action ngay tại activity:** mở Maps, Ghi chi, Tôi đã đến/Hoàn thành mà không cần đi qua nhiều màn hình.
- **Ghi chi theo activity:** Smart Form tự nhận khoản dự toán gắn với activity, category, ngày hôm nay và Smart Default người thanh toán.
- **Trước chuyến:** Tổng quan tập trung countdown, điểm đầu tiên, số hoạt động, dự toán và người đi.
- **Sau chuyến:** Tổng quan chuyển sang tổng kết lịch trình, thực chi, media và shortcut Báo cáo/Kỷ niệm.
- **Dashboard cũ được tinh gọn:** Trip Operating Center, stats lớn, analytics/memory glance và dashboard grid không còn xếp chồng trên Tổng quan; thay bằng summary 4 chỉ số compact.
- **Không migration:** App V2.3.0 tiếp tục dùng Database V1.4.0; service worker `tripflow-shell-v230`.
- **Roadmap tiếp theo:** V2.4.0 – Offline & Sync Reliability Pro.

## V2.2.1 nổi bật

- **Smart Forms:** form tạo mới chỉ hiện các trường cốt lõi; trường nâng cao được gom vào **Thêm chi tiết** để giảm scroll và số quyết định khi nhập.
- **Travel Wallet CTA:** nút **Ghi chi tiêu** được thu gọn về góc phải, không còn chiếm toàn chiều rộng trên mobile.
- **Quick Entry V2.1.0 được giữ nguyên:** câu lệnh tự nhiên vẫn nhận số tiền, nội dung, dự toán gần đúng và người thanh toán từ người tham gia.

## V1.9.0 nổi bật

- **Travel Wallet:** số tiền còn lại/vượt dự toán, bình quân chi phí theo người và mức chi an toàn mỗi ngày còn lại.
- **Spending Pace:** so sánh % thời gian chuyến đã đi qua với % ngân sách đã dùng, cảnh báo khi tốc độ chi cao hơn đáng kể hoặc đã vượt dự toán.
- **Ai đã thanh toán:** tổng hợp thực chi ròng theo trường `payer`; refund được trừ khỏi người trả tương ứng. V1.9.0 chưa tự chia nợ/quyết toán.
- **Favorite / Recent Expense:** đánh dấu sao, xem khoản gần đây và dùng lại để mở form chi tiêu đã điền sẵn. Favorite được lưu local theo user/chuyến, không tạo nguồn dữ liệu tài chính thứ hai.
- **Category Intelligence:** gợi ý nhóm chi từ lịch sử cùng nội dung hoặc từ khóa du lịch; chỉ áp dụng khi người dùng bấm dùng gợi ý. Quick Entry dùng chung rule.
- Giữ nguyên toàn bộ bản sửa Google Maps V1.8.4: short link `maps.app.goo.gl` được lưu nguyên văn và chỉ resolve tọa độ ngầm.
- Không có migration database mới; App V1.9.0 tiếp tục dùng Database V1.4.0. Service worker cache: `tripflow-shell-v190`.

## Đã có trong phiên bản này

- **Map & Route V1.8.0:** Timeline/Board/Bản đồ; tuyến theo ngày, điểm dừng, Google Maps directions, ước tính khoảng cách/thời gian và cảnh báo transfer quá gấp.
- **Planning Board V1.7.0:** chuyển Timeline/Board, kéo thả activity sang ngày khác trên desktop, đổi ngày trực tiếp trên mobile và chỉnh giờ ±30 phút ngay trên kế hoạch.
- **Quick Entry V1.5.0:** Command Center một dòng cho chi tiêu/lịch trình, hiểu `350k`, `1tr2`, `DD/MM`, `7:30`, `14h`, có preview, lưu nhanh/lưu & nhập tiếp và lịch sử câu nhập gần đây.
- **Command Center V1.5.0:** nút ⚡ nổi toàn app + `Ctrl/Cmd + K`, tìm kiếm, action theo Current/Next, lặp khoản chi gần nhất; dashboard không còn card Command Center; thao tác nhanh đi qua nút ⚡ toàn app.
- **Smart Workspace V1.2.0:** tìm kiếm xuyên lịch trình/chi phí/dự toán/media/người tham gia, quick action theo Current/Next và shortcut thêm chi phí/hoạt động/media ngay trên Tổng quan.
- **Smart Planning V1.4.0:** lưu chuyến hiện tại thành mẫu cá nhân và tạo chuyến mới từ mẫu; lịch trình tự dời theo ngày bắt đầu mới, tái sử dụng dự toán và người tham gia.
- **UX V1.4.0:** ngày/giờ kết thúc không còn bắt buộc; tiền nhập theo dạng `xxx.xxx.xxx`; thao tác nhanh chuyển vào nút ⚡; lịch sử lịch trình mở theo nút riêng; tab Thực chi có nút thêm nhất quán.
- **Memories V1.3.0:** Travel Journal theo ngày, Trip Highlights, cover chuyến đi, caption/story order và báo cáo storytelling sau chuyến.
- **Mobile Layout Fix V1.1.1:** khóa lại responsive shell sau Brand Refresh để không còn lỗi nội dung bị ép sang phải trên điện thoại.
- **Brand Refresh V1.1.0:** logo/app icon chủ đề du lịch mới, splash loading có thương hiệu, hệ màu Ocean Teal + Sunset, shell/app navigation chuyên nghiệp hơn, auth/travel landing và card/form/modal được chuẩn hóa lại.
- **V1.4.0 có migration database:** chạy `202609290001_v140_smart_planning_templates_reuse.sql` để thêm Planning Templates, cho phép ngày/giờ kết thúc để trống và nâng Database Version lên 1.4.0. V1.3.0 vẫn phải được chạy trước đó nếu database chưa có.

- Đăng ký, xác nhận email, đăng nhập, quên/đổi mật khẩu, đăng xuất.
- Nhiều chuyến đi: ngày, múi giờ, số người, trạng thái, ghi chú.
- Lịch trình theo ngày; thêm/sửa/xóa/sao chép hoạt động; roadmap, đánh dấu đã đến, hoàn thành, bỏ qua. Chỉ một hoạt động được check-in tại một thời điểm.
- Điểm hiện tại theo lịch, điểm đã check-in, hoạt động quá giờ chưa cập nhật; mở Google Maps/GPS khi người dùng yêu cầu.
- Dự toán theo khoản và nhóm, số lượng × đơn giá; chốt bản dự toán gốc.
- Ghi thực chi, người trả, ngày chi, link chứng từ; liên kết dự toán, chi ngoài kế hoạch và hoàn tiền.
- **Finance V0.3.0:** lần chốt đầu tiên là baseline dự toán gốc bất biến; các lần sau là revision có số thứ tự. Đối chiếu dự toán gốc / hiện tại / tổng chi / hoàn tiền / thực chi ròng / chênh lệch.
- **Live Trip V0.4.0:** Current / Next / Late, cảnh báo trễ, check-in giao dịch, lịch sử trạng thái bất biến và Realtime nhiều thiết bị với refetch fallback.
- **Collaboration V0.5.0:** ma trận Owner/Editor/Viewer, lời mời chống trùng, chặn mời tài khoản đã có quyền, Realtime member/invitation/participant và access-event để phản ánh đổi/thu hồi quyền nhanh trên thiết bị online.
- **Backup, Recovery & Operations V0.7.0:** backup snapshot server-side có checksum, tải recovery JSON, restore thành chuyến mới, thùng rác/tombstone, retention policy và operations health.
- **Trip Analytics & Post-Trip Report V0.8.0:** dashboard tổng kết lịch trình/tài chính/media, KPI theo ngày, độ trễ check-in, cảnh báo cần rà soát và export CSV/JSON/bản in HTML.
- **Stable Production V1.0.0:** production-readiness trong app, schema marker V1.0.0, kiểm tra RLS/guard dữ liệu, hardening API/HTTP, runbook và checklist vận hành production.
- **Mobile UX & PWA V0.6.0:** safe-area iPhone/Android, dialog/form fullscreen theo `visualViewport`, giữ tab/filter/scroll, cài/cập nhật PWA và cache offline bền vững khi trình duyệt hỗ trợ.
- Báo cáo tài chính theo nhóm, ngày và hoạt động; theo dõi khoản ngoài dự toán; tab Data Integrity phát hiện refund/link/snapshot không nhất quán.
- Export tài chính CSV và JSON; CSV chống formula injection.
- Gắn link Google Drive/HTTPS cho album, ảnh, video, tài liệu; liên kết với hoạt động. Media mở tại nguồn, không upload vào app.
- Danh sách người tham gia; mời tài khoản qua liên kết ràng buộc email, quyền chủ chuyến/chỉnh sửa/chỉ xem; thu hồi quyền.
- Nhật ký thay đổi, xuất dữ liệu chuyến đi JSON, phát hiện xung đột khi nhiều người sửa, chống ghi trùng khi thử lại.
- **Offline V0.2.0:** cache IndexedDB theo tài khoản; hàng đợi thao tác; tự đồng bộ khi mạng trở lại; trạng thái chờ/gửi/xung đột/bị từ chối; service worker cache app shell.
- **Master Administration:** Master xem danh sách user, dữ liệu/chuyến đi và audit; hủy kích hoạt hoặc kích hoạt lại tài khoản. User bị hủy kích hoạt không thể sử dụng app/API và bị đăng xuất khi account gate phát hiện trạng thái.
- Điều hướng dưới trên mobile, dialog co giãn, vùng an toàn màn hình; web manifest và icon để cài PWA.
- Roadmap phiên bản hiển thị trong **Thêm → Ứng dụng, dữ liệu & vận hành → TripFlow roadmap**; V0.1.0 đến V2.9.0 đều được đánh dấu ✅.

**Phạm vi offline V2.4.0:** cho phép tạo/sửa/xóa lịch trình, dự toán, chi tiêu, người tham gia, media và sửa chuyến hiện tại; optimistic UI + queue tự đồng bộ. Phân quyền, lời mời, snapshot/chốt dự toán, xóa chuyến và Master Admin vẫn yêu cầu online. Chưa có push notification, định vị nền, chia nợ hoặc đa tiền tệ.

## 1. Tạo database Supabase

1. Tạo một **project Supabase mới, trống**. Giữ mật khẩu database ở nơi riêng; không ghi vào source.
2. Mở **SQL Editor** và chạy migration **đúng thứ tự**:
   - `supabase/migrations/202609250001_tripflow.sql` — nền V0.1.0.
   - `supabase/migrations/202609270001_v020_offline_master_admin.sql` — nâng cấp V0.2.0.
   - `supabase/migrations/202609270002_v030_finance_reporting_integrity.sql` — nâng cấp V0.3.0.
   - `supabase/migrations/202609270003_v040_live_trip_realtime.sql` — nâng cấp V0.4.0.
   - `supabase/migrations/202609280001_v050_collaboration_permission_control.sql` — nâng cấp V0.5.0.
   - `supabase/migrations/202609280002_v050_collaboration_access_policy_fix.sql` — hotfix policy V0.5.0, được giữ lại trong source V0.6.0 cho database mới/cũ chưa áp dụng hotfix.
   - `supabase/migrations/202609280003_v070_backup_recovery_operations.sql` — Backup, Recovery & Operations V0.7.0.
   - `supabase/migrations/202609280004_v090_release_candidate_hardening.sql` — Release Candidate marker + release-readiness V0.9.0.
   - `supabase/migrations/202609280005_v100_stable_production_release.sql` — Stable Production marker + production-readiness V1.0.0.
   - `supabase/migrations/202609280006_v130_media_memories_storytelling.sql` — metadata Media/Storytelling + Realtime/restore compatibility + Database marker V1.3.0.
   - `supabase/migrations/202609290001_v140_smart_planning_templates_reuse.sql` — Planning Templates/Reuse + optional end date/time + Database marker V1.4.0.
   - `supabase/migrations/202610310001_v241_travel_reliability_permissions.sql` — V2.4.1: năm quyền độc lập, RPC/RLS và schema marker mới.
   - `supabase/migrations/202611010001_v280_bookings_documents.sql` — V2.8.0: đặt chỗ/tài liệu, RLS/RPC và marker 2.8.0; chạy sau V2.4.1.
   - `supabase/migrations/202611010002_v290_trip_fund.sql` — V2.9.0: quỹ, nguồn tiền thực chi, backup quỹ và marker 2.9.0; chạy sau V2.8.0.
   - `supabase/migrations/202611010003_v2100_custom_cost_sharing.sql` — V2.10.0: chia chi phí và thanh toán cá nhân; chạy sau V2.9.0.
   - `supabase/migrations/202611010004_v2101_selected_cost_sharing.sql` — V2.10.1: chia đều danh sách chọn và bảo toàn khi backup/restore; chạy sau V2.10.0.
     **V0.6.0, V0.8.0, V1.1.x, V1.2.0, V1.5.x, V1.6.0, V1.7.0, V1.8.0, V1.8.1, V1.8.2, V1.8.3, V1.8.4, V1.9.0, V2.0.0, V2.2.0, V2.2.1, V2.3.0 và V2.4.0 không có migration database. V1.3.0 và V1.4.0 có migration.** Nếu database đang ở V1.4.0 (App V2.4.0), chỉ chạy migration V2.4.1 mới rồi deploy source. Nếu DB V1.3.0, chạy V1.4.0 rồi V2.4.1. Nếu đang ở phiên bản cũ hơn, chạy các migration còn thiếu theo đúng thứ tự; không chạy lại migration đầu. Mỗi migration có transaction; nếu công cụ giữ phiên SQL sau lỗi, chạy `ROLLBACK;` trước khi thử lại.
3. V0.4.0 thêm `itinerary_events`; V0.5.0 thêm `trip_access_events`, bảo vệ lời mời trùng và mở rộng Realtime cho cộng tác. Schema `private` tiếp tục giữ dữ liệu/hàm nội bộ.
4. Lấy **Project URL** và **Publishable key** từ trang API/Connect của project. Legacy `anon` key cũng dùng được. **Không dùng `service_role` hoặc secret key.**
5. Giữ RLS bật. Không mở schema `private` trong Data API. Không cấp quyền ghi trực tiếp cho bảng; mutation chạy qua hàm `tf_mutate` đã kiểm tra người dùng/quyền.
6. Auth: bật đăng nhập Email/Password và **Confirm email**. Đặt mật khẩu tối thiểu 8 ký tự. Cấu hình SMTP của bạn cho email dùng thật; kiểm tra giới hạn gửi của dịch vụ trước khi mời nhóm sử dụng.

Migration này dành cho project mới; không chạy vào database có ứng dụng khác vì có lệnh thu hồi quyền các bảng public. Các lần nâng cấp sau phải thêm migration mới, không sửa/chạy lại migration đầu trên production.

## 1.1. Tạo tài khoản Master

TripFlow **không tự phong Master từ frontend**. Cách này tránh việc user thường tự nâng quyền. Sau khi đăng ký và xác nhận email của tài khoản sẽ dùng làm Master, chạy trong Supabase SQL Editor:

```sql
select id, email from auth.users order by created_at;

insert into public.tf_user_accounts(user_id, role, status)
select id, 'master', 'active'
from auth.users
where lower(email) = lower('master@example.com')
on conflict (user_id) do update
set role = 'master', status = 'active', deactivated_at = null,
    deactivated_by = null, updated_at = now();
```

Thay `master@example.com` bằng email thật. Chỉ nên có tài khoản Master theo chính sách vận hành của bạn. Master mở **Quản trị Master** từ sidebar desktop hoặc **Thêm → Quản trị Master** trên mobile.

Khi Master hủy kích hoạt user, account gate, RLS và RPC mutation đều chặn quyền. Supabase Auth có thể xác thực credential trong tích tắc trước khi app kiểm tra trạng thái; TripFlow sau đó đăng xuất user và hiển thị thông báo bị hủy kích hoạt. Không cần đưa `service_role` xuống frontend.

## 1.2. Cơ chế offline V0.2.0

- Cache read nằm trong IndexedDB `tripflow-v020`, phân vùng theo `userId`.
- API private không được service worker cache.
- Mutation offline giữ nguyên `operationId`; server `mutation_receipts` chống gửi trùng.
- Khi sync, server kiểm tra lại version và quyền hiện tại. Conflict trả 409 và hàng đợi giữ trạng thái để người dùng xử lý, không ghi đè im lặng.
- Đăng xuất khi không còn thao tác chờ sẽ xóa cache local của user. Nếu còn hàng đợi chưa gửi, app cảnh báo và giữ queue để tránh mất dữ liệu; queue chỉ được đọc/gửi lại khi đúng user đăng nhập.

## 1.3. Finance & Reporting Integrity V0.3.0

- Lần chốt ngân sách đầu tiên tự động là `baseline`; các lần sau là `revision`.
- Snapshot được gắn `snapshot_no`, `snapshot_kind`, `total_amount`, `item_count` và bị chặn UPDATE trực tiếp để giữ lịch sử.
- `tf_finance_report(trip_id)` là nguồn tổng hợp chuẩn phía server cho báo cáo: dự toán gốc, hiện tại, tổng chi, hoàn tiền, thực chi ròng, khoản ngoài dự toán, chênh lệch.
- Báo cáo phân rã theo **nhóm / ngày / hoạt động** và trả về trạng thái **Data Integrity**.
- Integrity kiểm tra các bất thường: hoàn tiền vượt giao dịch gốc, refund sai liên kết, thực chi liên kết budget không hợp lệ/sai nhóm, budget còn gắn activity đã xóa, snapshot metadata lệch payload.
- Nếu chưa chốt baseline, app vẫn tính số liệu hiện tại nhưng hiển thị cảnh báo `NO_BASELINE`.
- Snapshot, đổi quyền, xóa chuyến và Master Admin vẫn yêu cầu online; tạo thực chi offline tiếp tục dùng queue V0.2.0.

## 1.4. Live Trip & Realtime V0.4.0

- Live panel tách rõ **Current / Next / Late**; hiển thị thời gian còn lại đến chặng kế tiếp và số phút/giờ trễ.
- `itinerary_items` là trạng thái hiện tại; `itinerary_events` lưu history bất biến cho check-in, complete, skip, reset và auto-complete.
- Khi check-in chặng mới trong lúc đã có chặng active, transaction hoàn thành chặng cũ rồi kích hoạt chặng mới; unique index vẫn đảm bảo chỉ một active.
- Event history dùng cùng `operation_id` với mutation để retry/offline sync không tạo dòng trùng.
- Realtime subscribe `trips`, `itinerary_items`, `itinerary_events`, `expenses`; app vẫn refetch 30 giây khi Realtime chậm hoặc không khả dụng.
- Check-in timestamp lấy từ database `now()`, không lấy đồng hồ điện thoại làm nguồn sự thật. GPS chỉ mở khi người dùng yêu cầu và không tự xác nhận check-in.

## 1.6. Backup, Recovery & Operations V0.7.0

- **Thêm → Backup & Recovery** dành cho Owner: tạo snapshot, tải recovery JSON, restore thành chuyến mới và khôi phục dữ liệu soft-delete.
- `trip_backups` là snapshot bất biến có checksum; restore không overwrite source trip và không tự phục hồi members/invitations để tránh cấp quyền ngoài ý muốn.
- Tombstone có cửa sổ recovery mặc định 30 ngày; app backup 90 ngày. V0.7.0 không tự purge production.
- Operations health hiển thị số backup, tombstone, audit và mutation receipt.
- Backup ứng dụng không thay thế PostgreSQL/Supabase backup hoặc PITR độc lập.

## 1.5. Mobile UX & PWA Stabilization V0.6.0

- V0.6.0 không thêm bảng/RPC mới; nâng cấp chủ yếu ở frontend/PWA.
- Mobile dùng `env(safe-area-inset-*)` và `visualViewport` để tránh tai thỏ/Dynamic Island, thanh home và bàn phím phần mềm che nội dung.
- Dialog/form trên màn hình ≤760px mở fullscreen; body cuộn độc lập, footer hành động luôn nằm trong visual viewport.
- Tab, ngày, nhóm chi phí, tab Finance và vị trí cuộn được giữ trong `sessionStorage` theo user/chuyến/tab; reload hoặc quay lại màn hình không tự nhảy về đầu.
- Service worker V0.6.0 không cache API/Auth; cache shell được version hóa `tripflow-shell-v060`. Khi có worker mới, app hiển thị nút **Cập nhật TripFlow** thay vì tự thay giữa thao tác.
- Chrome/Edge Android có thể nhận prompt cài PWA; Safari iOS hiển thị hướng dẫn **Chia sẻ → Thêm vào Màn hình chính**.
- Nút **Bảo vệ cache offline** gọi Persistent Storage API khi trình duyệt hỗ trợ. Đây chỉ giúp giảm khả năng browser dọn cache; Supabase vẫn là nguồn dữ liệu chính thức.

## 1.7. Trip Analytics & Post-Trip Report V0.8.0

- **Thêm → Tổng kết chuyến đi** tổng hợp trực tiếp từ bundle hiện tại; không tạo thêm bảng tổng để tránh “hai nguồn sự thật”.
- KPI gồm tỷ lệ hoàn thành/bỏ qua, check-in trễ, thời lượng kế hoạch/thực tế, dự toán/thực chi/chênh lệch, chi phí bình quân người và media.
- Báo cáo theo ngày kết hợp số hoạt động và thực chi; báo cáo nhóm chi phí kế thừa nguồn số liệu Finance V0.3.0.
- Trạng thái **Báo cáo hoàn chỉnh** chỉ xuất hiện khi chuyến đã `completed` và không còn cảnh báo chính; khi đang đi, app hiển thị **Báo cáo tạm thời**.
- Export V0.8.0: CSV tổng kết, JSON đầy đủ và bản in HTML tự chứa. CSV tiếp tục trung hòa formula injection.
- V0.8.0 **không có migration database**. Nguồn dữ liệu vẫn là bảng/RPC hiện có; Analytics được tính lại khi mở hoặc export.

## 1.8. Release Candidate & Hardening V0.9.0

- Chạy migration `202609280004_v090_release_candidate_hardening.sql` trước khi deploy source V0.9.0.
- **Thêm → Kiểm tra sẵn sàng phát hành** gọi `tf_release_readiness()` để xác minh account gate, Finance, Live Trip, Collaboration, Backup/Recovery, idempotency, single-active guard và RLS.
- API mutation yêu cầu request same-origin, `application/json` và giới hạn payload; response private không cache và có request-id phục vụ truy vết lỗi.
- CSP/CORP và security headers được bật trong `next.config.ts`.
- Trước V1.0.0 phải chạy checklist tại `docs/RELEASE-CHECKLIST.md`, kiểm thử thiết bị thật và đóng lỗi Critical/High.

## 1.9. Stable Production Release V1.0.0

- Chạy `202609280005_v100_stable_production_release.sql` sau V0.9.0 trước khi deploy source V1.0.0.
- **Thêm → Trạng thái Production** chỉ báo sẵn sàng khi source, database marker và channel đều là `2.10.1 / stable`, đồng thời các guard server/client đều đạt.
- V1.0.0 không thêm bảng nghiệp vụ mới, không sửa dữ liệu chuyến đi và không thay đổi mô hình quyền; đây là bản đóng roadmap 1.0 để vận hành ổn định.
- Service worker dùng cache `tripflow-shell-v100`; API private tiếp tục `no-store`, same-origin/content-type/payload guard và request-id.
- Trước deploy production thực tế, hoàn tất `docs/RELEASE-CHECKLIST.md`; sau deploy dùng `docs/PRODUCTION-RUNBOOK.md` để smoke test, backup và rollback.
- Nếu source V1.0.0 chạy trên database V0.9.0, app sẽ báo rõ migration V1.0.0 còn thiếu thay vì coi RC là production-ready.

## 2. Deploy lên Vercel

### Cách A — GitHub → Vercel

1. Đưa **nội dung thư mục `tripflow-cloud`** vào repository mới của bạn; file `package.json` ở thư mục gốc repo. Đừng đưa `node_modules`, `.next`, `.env.local` vào Git.
2. Vercel → Add New Project → import repo. Framework: **Next.js**. Nếu repo chứa thư mục bao ngoài, chọn Root Directory là `tripflow-cloud`.
3. Node.js: **24.x**. Install Command: `npm ci`; Build Command: `npm run build`; Output Directory để mặc định Next.js.
4. Thêm hai biến cho môi trường Production:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

5. Deploy. Khi đổi hai biến trên phải redeploy vì Next.js đóng gói giá trị public vào frontend.
6. Ghi lại tên miền chính thức, rồi cấu hình Auth ở mục 3. Nếu chạy Preview để thử nghiệm, nên dùng Supabase staging riêng và cấu hình biến Preview riêng.

### Cách B — Deploy thư mục đã giải nén bằng CLI

Cần Node.js 24 và tài khoản Vercel:

```bash
cd tripflow-cloud
npm ci
npx vercel login
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel --prod
```

CLI sẽ hỏi giá trị từng biến và project. Sau khi có URL, tiếp tục mục 3. Không cần chạy migration trong Build Command. `vercel.json` đã có cấu hình Next.js; không xuất static HTML vì ứng dụng có API server.

## 3. Cấu hình email xác thực

Supabase → Authentication → URL Configuration:

- **Site URL:** `https://TEN-APP.vercel.app` (hoặc tên miền chính thức của bạn, không có đường dẫn).
- **Redirect URLs:** `https://TEN-APP.vercel.app/auth/callback` và `https://TEN-APP.vercel.app/auth/callback?recovery=1`.
- Khi phát triển local, thêm `http://localhost:3000/auth/callback` và `http://localhost:3000/auth/callback?recovery=1` trên project staging.

Trong Email Templates, dùng đường dẫn bên dưới để xác thực phía server và hỗ trợ mở email trên thiết bị khác. Thay nội dung thư theo ý bạn nhưng giữ đường dẫn:

**Confirm signup**

```html
<h2>Xác nhận tài khoản TripFlow</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
    >Xác nhận email</a
  >
</p>
```

**Reset password**

```html
<h2>Đặt lại mật khẩu TripFlow</h2>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
    >Chọn mật khẩu mới</a
  >
</p>
```

Template dùng Site URL: email luôn về môi trường được đặt ở Site URL, kể cả đăng ký từ URL Preview. Dùng project staging riêng để tránh lẫn môi trường. Route `/auth/callback` vẫn hỗ trợ luồng code/PKCE. Token đã dùng hoặc hết hạn cần yêu cầu lại.

## 4. Chạy trên máy tính

```bash
npm ci
cp .env.example .env.local
# Điền 2 giá trị của Supabase vào .env.local
npm run dev
```

Mở `http://localhost:3000`. Nếu thiếu cấu hình, app hiện hướng dẫn thiết lập. GPS và clipboard cần HTTPS khi dùng trên điện thoại (localhost là ngoại lệ của trình duyệt).

## 5. Dùng thử sau khi deploy

1. Đăng ký, xác nhận email, đăng nhập; tạo chuyến đi với ngày và múi giờ phù hợp.
2. Trong **Lịch trình**, thêm hoạt động. Giờ nhập là giờ địa phương của chuyến đi.
3. Trong **Chi phí → Dự toán**, thêm các khoản dự kiến; bấm **Đối chiếu dự toán**, rồi **Chốt dự toán gốc**. Lần chốt đầu tiên trở thành baseline bất biến, các lần sau là bản điều chỉnh.
4. Bấm **Ghi chi tiêu**. Chọn khoản dự toán tương ứng hoặc để ngoài dự toán; chi ròng tự trừ khoản hoàn tiền hợp lệ. Mở **Chi phí → Tổng quan → Xem báo cáo** để xem tổng hợp theo ngày/hoạt động và trạng thái Data Integrity.
5. Bấm **Tôi đã đến** khi tới một điểm; xác nhận chuyển điểm sẽ hoàn thành điểm cũ. App không coi giờ kế hoạch là xác nhận bạn đang có mặt.
6. Trong **Media**, gắn link album Drive. Cấp quyền album tại Drive cho người xem; quyền TripFlow không thay đổi quyền Drive.
7. Trong **Thêm**, mời bằng email, sao chép link và tự gửi. Người nhận đăng nhập đúng email rồi mở link để chấp nhận. Nếu vừa đăng ký và xác nhận email, mở lại link mời. Danh sách “Người tham gia” không tự tạo tài khoản hoặc cấp quyền.
8. Thử trên thiết bị thứ hai cùng tài khoản hoặc thành viên được mời. V0.4.0 dùng Realtime để nhận thay đổi sớm giữa thiết bị; refetch 30 giây vẫn hoạt động làm fallback.
9. Kiểm thử offline: mở chuyến khi online → tắt mạng → thêm một khoản chi hoặc check-in → vào **Thêm** kiểm tra hàng đợi → bật mạng → xác nhận trạng thái đồng bộ về 0.
10. Đăng nhập Master → **Quản trị Master** → mở một user/chuyến để kiểm tra dữ liệu → hủy kích hoạt user thử nghiệm → xác nhận user đó bị chặn đăng nhập/sử dụng app → kích hoạt lại.

## Kiểm thử và vận hành

```bash
npm test
npm run typecheck
npm run build
```

- [Kiến trúc và database](docs/ARCHITECTURE.md)
- [Kết quả kiểm tra và nghiệm thu staging](docs/TESTING.md)
- [Hướng dẫn backup, nâng cấp, xử lý lỗi](docs/OPERATIONS.md)
- [Phạm vi và lộ trình tiếp theo](docs/ROADMAP.md)

Source không chứa credentials thật. Hãy chạy `npm test`, `npm run typecheck` và `npm run build` trên Node.js 24 trước khi deploy production, sau đó hoàn thành checklist staging với Supabase/Vercel thật của bạn.

## Tài liệu chính thức tham chiếu

- Next.js: https://nextjs.org/docs/app
- Supabase SSR/Auth: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Email templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Vercel deploy CLI: https://vercel.com/docs/cli/deploying-from-cli
- Vercel environment variables: https://vercel.com/docs/environment-variables

## 1.10. Brand Refresh V1.1.0

- Không có migration database mới. Giữ database ở marker Stable V1.0.0.
- Deploy source bằng Node 24.x; service worker tự chuyển cache shell sang `tripflow-shell-v110`.
- App version là `1.1.0`, database compatibility version là `1.0.0`; **Thêm → Trạng thái Production** hiển thị riêng App/DB để tránh yêu cầu migration giả.
- Nhận diện mới dùng logo pin + route, màu Ocean Teal + Sunset; icon PWA 192/512 đã thay mới.
- Splash ban đầu có brand animation nhẹ và tối thiểu ~680ms ở lần mở app đầu để tránh flash trắng/giật layout.
- Roadmap hoàn thành đến V2.10.1 — Sheet & Cost Sharing UX Fix. Đề xuất V2.11.0 — Travel Readiness & Reminders, chưa triển khai.

## 1.11. Smart Trip Workspace & Quick Actions V1.2.0

- Không có migration database mới; database compatibility vẫn là Stable V1.0.0.
- Tổng quan có **Smart Workspace** với shortcut ghi chi tiêu, thêm hoạt động, check-in/hoàn thành theo Current/Next và gắn media theo activity đang liên quan.
- Tìm kiếm trong chuyến đi quét lịch trình, chi tiêu, dự toán, media và người tham gia; bỏ dấu tiếng Việt khi so khớp và điều hướng về đúng module/ngày.
- Desktop có phím tắt `/` để mở tìm kiếm; mobile dùng nút search trên topbar hoặc launcher trong Smart Workspace.
- Service worker cache shell: `tripflow-shell-v120`.
- Roadmap đánh dấu V1.2.0 ✅; phiên bản tiếp theo là **V1.3.0 – Media, Memories & Storytelling**.

## 1.12. Media, Memories & Storytelling V1.3.0

- Media được nhóm thành Travel Journal theo ngày kỷ niệm/hoạt động.
- Mỗi chuyến có thể chọn một cover; media có thể đánh dấu Trip Highlight.
- Caption dùng trường ghi chú hiện có; `story_order` điều khiển thứ tự kể chuyện.
- Post-Trip Report/CSV/JSON chứa phần Memories để lưu trữ hoặc chia sẻ sau chuyến.
- Database version yêu cầu: **1.3.0**.

## 1.13. Smart Planning Templates & Reuse V1.4.0

- Lưu lịch trình, dự toán và người tham gia của chuyến hiện tại thành mẫu cá nhân.
- Tạo chuyến mới từ mẫu với ngày bắt đầu mới; TripFlow tự dời thời gian các hoạt động nhưng không sao chép thực chi/media/lịch sử cũ.
- `end_date` của chuyến và `end_at` của hoạt động là tùy chọn.
- Input tiền hiển thị dấu chấm phân cách hàng nghìn khi nhập.
- Dashboard chỉ hiển thị nút ⚡ Thao tác nhanh; danh sách thao tác mở trong dialog.
- Lịch sử Live Trip mở qua nút **Xem lịch sử** thay vì chiếm diện tích lịch trình.
- Tab **Thực chi** có nút **Ghi chi tiêu** riêng để nhất quán với tab **Dự toán**.
- Database version yêu cầu: **1.4.0**.

## 1.14. Quick Entry & Command Center V1.5.0

- Mở Command Center bằng nút ⚡ nổi hoặc `Ctrl/Cmd + K`; `/` vẫn mở Search.
- Quick Entry tự chọn loại: có số tiền → khoản chi; không có số tiền → activity. Có thể ép activity bằng tiền tố `lịch`, `hd`, `hoạt động`; ép chi bằng `chi`.
- Số tiền hỗ trợ `350k`, `1tr2`, `1.2tr`, `120.000`, `1.250.000`; ngày hỗ trợ `hôm nay`, `ngày mai`, `DD/MM`; giờ hỗ trợ `7:30`, `14h`, `14h30`.
- Preview luôn xuất hiện trước khi ghi. Có thể **Lưu nhanh**, **Lưu & nhập tiếp** hoặc **Mở form** để bổ sung chi tiết.
- Quick Entry dùng mutation/queue hiện có nên khoản chi và activity vẫn hỗ trợ offline như trước.
- App version: **2.9.0**; Database version yêu cầu: **2.9.0**; chạy migration V2.9.0 sau V2.8.0.
