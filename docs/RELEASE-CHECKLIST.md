# TripFlow V1.0.0 — Stable Production checklist

Chỉ phát hành/duy trì V1.0.0 Production khi toàn bộ mục Critical/High đã đạt hoặc có quyết định chấp nhận rủi ro được ghi lại.

## Build & migration

- [ ] Node.js 24.x đúng với `engines`.
- [ ] `npm ci` sạch từ lockfile.
- [ ] `npm run typecheck` đạt.
- [ ] `npm test` đạt.
- [ ] `npm run build` đạt.
- [ ] Migration V0.9.0 và V1.0.0 đã chạy đúng môi trường theo thứ tự.
- [ ] `tf_release_readiness()` trả app/database `1.0.0`, channel `stable`, ready `true`.
- [ ] **Thêm → Trạng thái Production** báo database `1.0.0` và tất cả server/client checks đạt.

## Auth & permission

- [ ] User A không đọc/sửa chuyến của User B.
- [ ] Viewer không mutation.
- [ ] Editor không mời/đổi quyền/xóa chuyến/chốt snapshot.
- [ ] Owner thu hồi member thì quyền mất ngay ở server.
- [ ] User deactivated không dùng app/API.
- [ ] Không có secret/service_role trong bundle frontend.

## Data integrity

- [ ] Retry cùng `operationId` không tạo record trùng.
- [ ] Conflict version không ghi đè im lặng.
- [ ] Chỉ một itinerary item Active.
- [ ] Refund không vượt giao dịch gốc.
- [ ] Budget baseline bất biến.
- [ ] Backup checksum sai bị từ chối restore.
- [ ] Restore tạo chuyến mới, không overwrite source.

## Offline / PWA / realtime

- [ ] Mất mạng khi đang nhập không làm mất queue đã lưu.
- [ ] Có mạng lại thì queue sync đúng tài khoản.
- [ ] Logout có pending queue hiển thị cảnh báo.
- [ ] Realtime mất kết nối vẫn có refetch fallback.
- [ ] PWA update không tự reload giữa lúc đang nhập.
- [ ] Safari iOS và Chrome Android kiểm tra cài/update/offline shell.

## Thiết bị và UX

- [ ] 320px không horizontal overflow.
- [ ] 390px iPhone safe-area đúng.
- [ ] Android bàn phím không che nút lưu.
- [ ] Tablet và desktop không vỡ layout.
- [ ] Modal dài cuộn bên trong và đóng đúng sau khi lưu.

## Recovery & operations

- [ ] Backup thử nghiệm tải JSON được.
- [ ] Restore thử nghiệm mở được chuyến mới.
- [ ] Thùng rác restore dependency đúng.
- [ ] Operations health không có cảnh báo bất thường chưa xử lý.
- [ ] Có backup/PITR database độc lập theo gói Supabase đang dùng.


## Production cutover

- [ ] Ghi lại deployment Vercel đang chạy và Supabase project/ref đúng môi trường.
- [ ] Backup/PITR hoặc bản sao database phù hợp gói dịch vụ đã được xác nhận trước cutover.
- [ ] Smoke test sau deploy đạt theo `docs/PRODUCTION-RUNBOOK.md`.
- [ ] Không còn lỗi Critical/High mở; Medium có owner và kế hoạch xử lý.
- [ ] Có đường rollback frontend rõ ràng và người chịu trách nhiệm vận hành.


## V1.1.0 UI/brand compatibility

- [ ] Source App version hiển thị `1.1.0`.
- [ ] Database version vẫn `1.0.0` và channel `stable`; không tạo migration V1.1.0 chỉ để đổi UI.
- [ ] Splash, logo/icon, auth, desktop shell và mobile dock đã smoke-test trên thiết bị thật.
- [ ] PWA đã nhận `tripflow-shell-v110` sau refresh/đóng mở app.

## V1.2.0 Smart Workspace compatibility

- [ ] Source App version hiển thị `1.2.0`.
- [ ] Database version vẫn `1.0.0`; không tạo migration chỉ cho workspace/search.
- [ ] Search không trả dữ liệu ngoài bundle/chuyến đang mở.
- [ ] Viewer không được mở quick mutation từ Smart Workspace.
- [ ] 320/390px không horizontal overflow ở Tổng quan và search dialog.
- [ ] Service worker shell đã là `tripflow-shell-v120`.


## V1.3.0 Media storytelling

- [ ] App version `1.3.0`; Database version `1.3.0`; channel `stable`.
- [ ] Migration `202609280006_v130_media_memories_storytelling.sql` đã chạy.
- [ ] Cover/Highlight/Travel Journal hoạt động trên mobile và desktop.
- [ ] Backup/restore metadata storytelling đã test.
- [ ] Media Realtime đã test hai session.
- [ ] Service worker là `tripflow-shell-v130`.

## V1.4.0 Smart Planning Templates & Reuse

- [ ] Chạy `202609290001_v140_smart_planning_templates_reuse.sql`.
- [ ] App version `1.4.0`; Database version `1.4.0`; channel `stable`.
- [ ] Kiểm thử optional end date/time trên mobile và desktop.
- [ ] Kiểm thử định dạng input tiền `xxx.xxx.xxx`.
- [ ] Kiểm thử save/apply/delete template với Owner và Editor; Viewer bị chặn save.
- [ ] Kiểm thử tạo chuyến từ template không sao chép thực chi/media/history.
- [ ] Service worker là `tripflow-shell-v140`.


## V1.5.0 Quick Entry & Command Center

- [ ] App version `1.5.0`; Database required `1.4.0`; channel `stable`.
- [ ] Quick Entry parser smoke test pass; Command Center usable trên mobile/desktop.
- [ ] Offline queue không tạo duplicate khi retry Quick Entry.
- [ ] Service worker `tripflow-shell-v150` active sau deploy.


## V1.5.1 Deploy Typecheck Fix

- [ ] `npm run build` không còn TS18048 ở `components/tripflow.tsx`.
- [ ] `npm run build` không còn TS2304 `dateLabel` ở `tests/domain.test.ts`.
- [ ] App version `1.5.1`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v151` active sau deploy.


## V1.6.0 Smart Defaults & Context Automation

- [ ] App version `1.6.0`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v160` active.
- [ ] PWA standalone: bottom taskbar không bị kéo lên khi scroll.
- [ ] Quick dock có thể ẩn sang phải và mở lại bằng mũi tên.
- [ ] Thêm hiển thị 3 Module Hub đóng/mở, không bung toàn bộ nội dung.
- [ ] Expense mới gợi ý payer/category/budget hợp lý và vẫn sửa được.
- [ ] Quick Entry cảnh báo vượt budget / trùng lịch trước khi lưu.


## V1.7.0 Planning Board & Timeline Pro

- [ ] App version `1.7.0`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v170` active.
- [ ] Timeline/Board switch hoạt động; desktop drag đổi ngày, mobile select đổi ngày.
- [ ] ±30 phút giữ duration và không làm mất `end_at = null`.
- [ ] Tab Thực chi mobile không vỡ heading/action.
- [ ] Quick icon chỉ ẩn bằng kéo sang phải; arrow chỉ hiện khi collapsed.

## V1.8.0 Map, Places & Route Intelligence

- [ ] App version `1.8.0`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v180` active.
- [ ] Map view, route links và route estimate smoke test đạt.
- [ ] PWA taskbar được kiểm thử bằng scroll dài trên iPhone standalone và Chrome Android standalone.
- [ ] Quick hide/reveal và dashboard declutter đạt.
- [ ] Motion không gây layout shift và tôn trọng Reduce Motion.

## V1.8.1 Map Link, Media Viewer & PWA Keyboard Fix

- [ ] App version `1.8.1`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v181` active.
- [ ] Link `maps.app.goo.gl` cũ và mới đều tự resolve tọa độ khi mở Map view.
- [ ] Ảnh Google Drive mở được trong viewer TripFlow khi có quyền; album/video/document có fallback Mở nguồn.
- [ ] iPhone PWA: keyboard không đẩy header/footer modal ra khỏi vùng nhìn thấy.


## V1.8.2 Google Maps Share & Media Zoom Fix

- [ ] App version `1.8.2`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v182` active.
- [ ] Test Google Maps Share short-link resolve on deployed Vercel runtime.
- [ ] Test global zoom lock and photo-only pinch zoom on iOS/Android.

## V1.8.3 Google Maps Short Link Resolver Fix

- [ ] App version `1.8.3`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v183` active.
- [ ] `/api/maps/resolve` chạy Node.js runtime và resolve link `maps.app.goo.gl` bằng raw HTTPS.
- [ ] Link mẫu ySoEVvZNbrSWqu168 resolve thành `12.2200647,109.2036555` khi Google trả Location tương ứng.
- [ ] Không có migration database mới.


## V1.8.4 Google Maps Coordinate Integrity Fix

- [ ] App version `1.8.4`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v184` active.
- [ ] Paste `https://maps.app.goo.gl/YVvszUd4AFD1VXPt6?g_st=ic`, save, edit again: field still contains exactly the same short link.
- [ ] Map resolver uses GET and returns La Vague coordinate near `12.2200647,109.2036555`.
- [ ] Resolver does not return `-77.844326,39.0267995` from unrelated HTML/viewport data.
- [ ] Clicking Bản đồ opens the Nha Trang destination, not Antarctica.

## V1.9.0 Expense Intelligence & Travel Wallet

- [ ] App version `1.9.0`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v190` active.
- [ ] Travel Wallet không lưu aggregate tài chính riêng; số liệu khớp Finance V0.3.0.
- [ ] Spending Pace, per-person và safe daily remaining xử lý đúng trước/trong/sau chuyến và trường hợp không có budget.
- [ ] Favorite/Recent Expense không sửa dữ liệu cloud khi chỉ đánh dấu sao.
- [ ] Category suggestion là opt-in và Quick Entry dùng cùng inference rule.
- [ ] Không có migration database mới.


## V2.0.0 Pro Travel Operating System

- [ ] App version `2.0.0`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v200` active.
- [ ] Trip Operating Center hiển thị và điều hướng đúng 4 module.
- [ ] Payer dropdown lấy từ trip participants.
- [ ] Travel Wallet CTA không bị co hẹp trên mobile 375–430px.

## V2.1.0 Smart Quick Actions & Contextual UX

- [ ] App version `2.1.0`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v220` active.
- [ ] Nút ⚡ Command Center vẫn là nơi duy nhất dùng Quick Entry; không có ô nhập Quick Entry mới ở module khác.
- [ ] `chi 150k ăn trưa viện hải dương học HuyVo` nhận đúng 150.000đ, nội dung `ăn trưa`, loại `payment`, participant `HuyVo` và budget Viện Hải Dương Học.
- [ ] Budget exact/fuzzy match không tự chọn khi có hai kết quả gần ngang nhau; preview hiển thị lựa chọn ngay trong Command Center.
- [ ] Participant exact/fuzzy match chỉ dùng danh sách Người tham gia của chuyến hiện tại; dữ liệu từ chuyến khác không được dùng.
- [ ] Lưu nhanh dùng đúng payer/budget đã preview; mở form cũng nhận đúng các giá trị này.
- [ ] Regression: lệnh Quick Entry cũ như `Taxi sân bay 350k` và `lịch Ăn sáng 7:30 ngày mai` vẫn hoạt động.
- [ ] Không có migration database mới.

## V2.2.0 Smart Forms & Defaults

- [ ] App version `2.2.0`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v220` active.
- [ ] Smart Forms progressive disclosure hoạt động cho Trip/Item/Budget/Expense.
- [ ] Smart Defaults vẫn được submit khi các trường chi tiết đang ẩn.
- [ ] Form chỉnh sửa dữ liệu cũ vẫn hiển thị đầy đủ.
- [ ] Quick dock close X nằm trên nút ⚡ và không bị che/chìm.


## V2.2.1 Travel Wallet Compact CTA Fix

- [ ] App version `2.2.1`; Database required `1.4.0`; channel `stable`.
- [ ] Service worker `tripflow-shell-v221` active.
- [ ] Travel Wallet CTA compact ở 320–430 px, không full-width và không làm hẹp phần copy.
- [ ] Không có migration database mới.

## V2.3.0 Trip Daily Command Center

- [ ] App version `2.3.0`; Database required `1.4.0`; không có migration mới.
- [ ] Service worker `tripflow-shell-v230` active.
- [ ] Tổng quan theo ngữ cảnh pass trên mobile 320/390/430 px và desktop.
- [ ] Current/Next, chi hôm nay, action Maps/Ghi chi/status và cảnh báo cần chú ý pass UAT.
- [ ] Không xuất hiện lại Trip Operating Center/stats/dashboard-grid cũ trên Tổng quan.
- [ ] Roadmap đánh dấu V2.3.0 hoàn thành và NEXT_VERSION là V2.4.0.



## V2.4.0 Offline & Sync Reliability Pro

- [ ] App version `2.4.0`; Database required `1.4.0`; không có migration mới.
- [ ] Service worker `tripflow-shell-v240` active sau reload/PWA update.
- [ ] IndexedDB `tripflow-v020` nâng schema version 2, giữ cache/queue cũ và có index `tripId`/`state`.
- [ ] Offline optimistic UI + queue compaction pass UAT cho itinerary/budget/expense/participant/media/trip update.
- [ ] Mutation receipt/idempotency trong DB V1.4.0 vẫn hoạt động; retry không sinh duplicate.
- [ ] Backoff + auto resume + stale-sending recovery pass.
- [ ] Conflict UI có **Giữ bản trên máy / Dùng bản cloud** và không retry 409 vô hạn.
- [ ] Background refetch không làm mất mutation pending/sending khỏi UI.
- [ ] Roadmap đánh dấu V2.4.0 hoàn thành và NEXT_VERSION là V2.5.0.
