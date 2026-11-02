# Quy tắc công nợ V2.13.0

## Nguồn duy nhất

`tf_settlement_snapshot` tính trên server, khóa cùng chuyến với các ghi tài chính. API riêng không sửa bảng thực chi. Đề xuất ở client chỉ ghép người thiếu với người được nhận, thứ tự UUID ổn định; không cam kết số lượt chuyển tối ưu toàn cục.

Số dư người = tiền cá nhân đã trả + đóng quỹ − trả quỹ − hoàn ứng + chuyển quyết toán − nhận quyết toán − phần chịu thực chi.

Số dư dương là được nhận; âm là phải trả. Khi đã phân bổ đủ, tổng số dư người phải bằng tiền còn trong quỹ. Khi chốt, tất cả số dư người và quỹ bằng 0. Giao dịch đóng/trả quỹ, hoàn ứng và chuyển tiền không phải chi phí du lịch phát sinh mới.

## Phân bổ

- Kế thừa equal, selected_equal và fixed_remainder từ dự toán. Không dùng số lượng người khai báo trên chuyến thay cho người tham gia thực tế.
- Khoản không có dự toán/cách chia/người trả hợp lệ: báo chi tiết và chặn ghi quyết toán; không ngầm chia đều. Thay đổi cách chia làm tính lại phần chịu; giao dịch đã xác nhận giữ nguyên, chênh lệch trở thành số dư mới.
- Phân bổ một lần theo tổng thực chi ròng của từng dự toán, không làm tròn riêng mỗi lần cọc/hoàn tiền. Khi thực chi thấp hơn dự toán, tỷ trọng phần chịu toàn khoản được dùng để tính phần chịu tạm thời. Hoàn tiền làm giảm tổng thực chi ròng.
- Với fixed_remainder: nếu thực chi bằng dự toán, phần cố định đúng số đã chốt; nếu vượt dự toán, phần cố định giữ nguyên, phần tăng chia nhóm phần dư. Nếu thực chi thấp hơn dự toán, cả phần cố định và phần dư được thu theo tỷ trọng dự toán.
- Số nguyên VNĐ, phương pháp phần dư lớn nhất, hòa thì theo UUID. Tổng phân bổ luôn bằng thực chi ròng. Tối đa 1.000 tỷ mỗi giao dịch; nếu số tổng vượt giới hạn số nguyên an toàn của giao diện, từ chối hiển thị quyết toán thay vì làm tròn sai.
- Không suy ra ai được miễn phần chịu từ age_group; người lớn/trẻ em/em bé giữ đúng cách chia đã khai báo.

## Tiền cá nhân và quỹ

Ứng trước hay trả trực tiếp đều là tiền cá nhân đã trả. Chỉ phần chênh lệch với phần chịu mới quyết định công nợ. Hoàn ứng qua quỹ chỉ dành cho khoản advance còn hợp lệ và không vượt quyền được nhận hiện tại trong giao diện quyết toán. Khoản ứng gốc chưa hoàn qua quỹ có thể đã được bù qua chuyển tiền thành viên; không ép hoàn lần nữa nếu các số dư đã cân bằng.

Trả quỹ dư theo số được nhận hiện tại, tiền còn trong quỹ và phần đóng còn được trả theo sổ quỹ cũ; không chia đều tự động. Mỗi lần trả/hoàn được ghi bằng tf_fund_mutate, cùng transaction với kiểm tra revision.

## Ghi sổ và quyền

Xác nhận nghĩa là người có quyền ghi nhận tiền đã thực chuyển, không phải đối soát ngân hàng hoặc hai bên cùng phê duyệt. Cho phép chọn người chuyển đang thiếu/người nhận đang dư và thanh toán một phần. Có ngày, ghi chú, link HTTPS chứng từ. Không có tích hợp ngân hàng hay tải file chứng từ mới trong bản này.

Owner/Editor ghi giao dịch; Viewer xem. can_close_settlement là quyền riêng, mặc định false với thành viên/lời mời cũ. Chỉ Owner cấp hoặc thu hồi; Editor không tự nâng quyền. Chốt/mở lại chỉ cho Owner hoặc Editor được cấp quyền. Hủy chuyển tiền và mở lại phải có lý do, lịch sử gốc còn nguyên. Sổ quỹ có hủy giao dịch riêng như trước.

Mỗi thao tác có operationId, hash nội dung và revision chụp khi mở form. Retry cùng nội dung/cùng ID không tạo thêm giao dịch; ID tái dùng khác nội dung bị từ chối. Các ghi tài chính cập nhật revision, gồm budget/expense/participant/fund/history. Server phát hiện stale trước khi ghi. Trigger bảo vệ tài chính đã chốt cho cả app cũ và khôi phục mục đã xóa.

## Dữ liệu và vận hành

Hai bảng mới: trip_settlements (trạng thái/revision), settlement_entries (chuyển tiền/hủy/chốt/mở lại). SELECT qua RLS theo chuyến, client không được ghi trực tiếp; RPC kiểm tra đăng nhập, trạng thái tài khoản, vai trò và quyền. Helper private/phiên bản RPC cũ không được gọi trực tiếp từ client.

Snapshot offline theo user/chuyến, xóa cùng cache chuyến hoặc khi mất quyền. Offline chỉ xem; không xác nhận/chốt; chặn ghi khi còn queue trên thiết bị. Định kỳ tải lại khi mở quyết toán; revision server vẫn là chốt kiểm tra cuối cùng. Backup/restore sao chép đủ ledger, remap tham chiếu, giữ trạng thái đã chốt; mẫu kế hoạch không sao chép giao dịch quyết toán.
