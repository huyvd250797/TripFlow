# Kiến trúc TripFlow 0.1.0

## Công nghệ và luồng dữ liệu

- Next.js App Router 16.3.6, React 19.3, TypeScript strict, Node.js 24. Phiên bản chính xác được khóa trong package-lock.json.
- Giao diện client dùng React Query, React Hook Form, Radix Dialog, Lucide; CSS responsive và Tailwind 4. Không tải font hoặc ảnh nền từ dịch vụ ngoài.
- Route Handlers `/api/tripflow` là backend HTTP cùng domain trên Vercel. Zod kiểm tra dữ liệu; xác thực `auth.getUser()` trên mỗi request. GET không cache dữ liệu cá nhân.
- Supabase Auth lưu phiên bằng cookie qua `@supabase/ssr`. Server client chỉ được gọi trong route có thể cập nhật cookie; ứng dụng không đặt dữ liệu riêng trong HTML render tĩnh. Browser client tự làm mới phiên, route handlers ghi lại cookie khi cần.
- Supabase PostgreSQL là nguồn dữ liệu chính. RLS bảo vệ đọc, RPC `tf_mutate` kiểm tra quyền và xử lý ghi trong transaction. Không có service-role key trong ứng dụng.
- Realtime thử làm mới các bảng con; polling 30 giây và refetch khi quay lại cửa sổ là cơ chế dự phòng. Đây không phải cam kết đồng bộ tức thì mọi loại sự kiện.

Luồng ghi: form → Zod → POST cùng origin → kiểm tra phiên → RPC → khóa theo chuyến đi → kiểm tra quyền/version/liên kết → cập nhật + audit + receipt → commit → tải dữ liệu mới. Client Supabase cũng có thể gọi RPC trực tiếp; vì vậy các quy tắc quan trọng và kiểm tra quyền nằm trong database, không chỉ trong API/UI.

## Cấu trúc source

| Vị trí                                    | Trách nhiệm                                         |
| ----------------------------------------- | --------------------------------------------------- |
| `app/page.tsx`, `components/tripflow.tsx` | Shell, điều hướng và màn hình nghiệp vụ             |
| `components/editor.tsx`                   | Form tạo/sửa, kiểm tra nhập, retry operation ID     |
| `components/auth.tsx`                     | Đăng nhập, đăng ký, phục hồi mật khẩu               |
| `components/ui/dialog.tsx`                | Dialog, focus trap, thao tác bàn phím               |
| `app/api/tripflow/route.ts`               | Đọc bundle, validation, mutation API                |
| `app/auth/confirm`, `app/auth/callback`   | Email token/PKCE exchange                           |
| `lib/domain.ts`                           | Tính toán chi phí, lịch trình, thời gian, CSV       |
| `lib/validation.ts`, `lib/types.ts`       | Hợp đồng dữ liệu và schema                          |
| `lib/supabase`                            | Browser/server client                               |
| `supabase/migrations`                     | Schema, constraints, RLS, transaction, audit        |
| `tests`                                   | Unit, PostgreSQL integration và browser integration |

## Mô hình dữ liệu

`trips` là gốc. Các bảng nghiệp vụ gắn `trip_id`. Chủ chuyến là `trips.owner_id`; `trip_members` chứa editor/viewer. `trip_participants` chỉ là danh sách người đi, độc lập với tài khoản.

Hoạt động → dự toán qua `budget_items.item_id`; hoạt động → media qua `media_links.item_id`; dự toán → thực chi qua `expenses.budget_id`; hoàn tiền → khoản chi gốc qua `expenses.refund_of`. FK tổng hợp giữ các liên kết trong cùng một chuyến đi. `budget_snapshots.data` lưu bản sao dự toán lúc chốt; thay đổi hiện hành không sửa snapshot.

`audit_logs` lưu trước/sau với actor và thời điểm; app hiển thị 15 thay đổi mới nhất, API trả tối đa 50. `private.mutation_receipts` lưu kết quả thao tác theo user/operation ID để retry không tạo bản sao.

## Quyền

| Thao tác                                                   | Chủ chuyến | Editor | Viewer |
| ---------------------------------------------------------- | ---------- | ------ | ------ |
| Xem dữ liệu chuyến đi                                      | Có         | Có     | Có     |
| Sửa chuyến, lịch trình, dự toán, thực chi, media, người đi | Có         | Có     | Không  |
| Check-in/đổi trạng thái hoạt động                          | Có         | Có     | Không  |
| Chốt dự toán gốc                                           | Có         | Không  | Không  |
| Mời, sửa quyền, thu hồi thành viên                         | Có         | Không  | Không  |
| Xóa chuyến đi                                              | Có         | Không  | Không  |
| Nút xuất JSON                                              | Có         | Không  | Không  |

Giới hạn nút xuất không ngăn thành viên lưu thông tin họ có quyền đọc. Không có chức năng chuyển chủ chuyến ở V0.1.

Lời mời là UUID ngẫu nhiên, gắn email, có hạn 7 ngày, dùng một lần. Chỉ chủ chuyến được đọc token trong bảng lời mời. Token lưu dạng UUID trong database V0.1; chưa chuyển sang mô hình token hash của giai đoạn tăng cường bảo mật. Người dùng phải xác thực email theo cấu hình Auth được yêu cầu trong README. App không gửi email mời.

## Quy tắc nhất quán

- Chi phí VNĐ nguyên; dự toán = làm tròn số lượng (2 chữ số thập phân) × đơn giá. Mỗi khoản tối đa 1.000.000.000.000 VNĐ.
- Thực chi ròng = chi tiền − hoàn tiền. Hoàn tiền kế thừa nhóm và dự toán của khoản gốc; tổng hoàn không vượt số tiền gốc. Khoản gốc đang có hoàn tiền không được sửa/xóa; cần xử lý khoản hoàn trước.
- Ngày chi có thể trước/sau chuyến đi để ghi đặt cọc hoặc quyết toán. Hoạt động phải nằm trong khoảng ngày của chuyến đi; độ dài chuyến tối đa 730 ngày.
- Thay đổi múi giờ chuyến đi giữ nguyên thời điểm UTC của hoạt động; giờ hiển thị địa phương đổi. Nếu làm hoạt động ra ngoài ngày chuyến đi, database từ chối.
- Ghi thay đổi theo `version`; dữ liệu cũ bị từ chối, không âm thầm ghi đè. Hiện chưa có UI hợp nhất xung đột từng trường.
- Cùng operation ID + cùng nội dung trả lại kết quả đã ghi; đổi nội dung phải tạo operation ID mới. Form giữ ID khi retry cùng nội dung trong phiên form; không phải hàng đợi bền vững qua reload.
- Khóa transaction theo chuyến đi tuần tự hóa thao tác ghi; phù hợp nhóm nhỏ. Partial unique index đảm bảo chỉ một hoạt động active.
- Chuyển điểm active hoàn thành điểm cũ và cập nhật điểm mới trong cùng transaction. Check-in thay đổi trạng thái chuyến sang traveling.
- Xóa nghiệp vụ là soft delete. Xóa dự toán giữ thực chi và bỏ liên kết; xóa hoạt động giữ dự toán/media và bỏ liên kết. Xóa chuyến đi làm mất quyền đọc qua app. Thu hồi member là xóa membership có audit riêng.
- GET phân trang nội bộ 500 dòng; tối đa 20.000 dòng/bảng/chuyến rồi báo lỗi, không trả bản tổng hợp âm thầm thiếu dữ liệu. Danh sách chuyến tối đa 500, lời mời 100 mới nhất. Không tối ưu cho vận hành đại lý hàng nghìn chuyến.

## Media và vị trí

Chỉ lưu URL HTTPS, tiêu đề, loại, ghi chú, liên kết hoạt động. App không proxy/tải/lưu binary từ Google Drive, không thu token Google, không tự cấp quyền Drive, không nhúng iframe cần cookie bên thứ ba. Nút mở media dẫn sang trang nguồn.

Điểm theo thời gian là suy luận từ lịch. Check-in là xác nhận chủ động. GPS dùng Geolocation API theo thao tác, không ghi tọa độ lên database và không theo dõi nền. Khi lịch trùng giờ, app thông báo thay vì giả định có mặt ở nhiều nơi.
