# Nâng cấp TripFlow V0.8.0 → V0.9.0

V0.9.0 là **Release Candidate & Hardening**. Không mở rộng nghiệp vụ lớn; mục tiêu là xác nhận database đúng phiên bản, tăng bảo vệ HTTP/API, hoàn thiện UAT và đóng lỗi trước V1.0.0.

## 1. Migration bắt buộc

Nếu database hiện đã ở V0.7.0 (V0.8.0 không có migration), chạy:

```text
supabase/migrations/202609280004_v090_release_candidate_hardening.sql
```

Migration này tạo marker `tf_schema_versions` và RPC `tf_release_readiness()` để app xác minh các capability quan trọng của V0.2 → V0.9 thay vì suy đoán từ lỗi truy vấn.

## 2. Deploy

1. Dùng Node.js 24.x.
2. `npm ci`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`
6. Deploy production/preview.
7. Sau deploy, mở **Thêm → Release Candidate** và xác nhận tất cả kiểm tra server/client đều đạt.

Service worker dùng cache `tripflow-shell-v090`. Nếu PWA đang mở bằng worker cũ, bấm **Cập nhật TripFlow** khi được nhắc.

## 3. Hardening V0.9.0

- API private trả `no-store`, `Pragma: no-cache`, version header và request-id để truy vết lỗi.
- Mutation API yêu cầu same-origin, JSON content type và giới hạn payload trước khi parse.
- Security headers bổ sung CSP, CORP và `X-Permitted-Cross-Domain-Policies`.
- Release readiness xác minh account gate, Finance, Live Trip, Collaboration, Backup/Recovery, mutation idempotency, single-active guard và RLS.
- Không dùng `service_role` ở frontend; không mở quyền ghi trực tiếp cho bảng public.

## 4. Rollback

Có thể deploy lại source V0.8.0. Marker/RPC V0.9.0 có thể giữ nguyên vì không thay đổi dữ liệu nghiệp vụ. Không cần xóa migration khỏi production chỉ để rollback frontend.
