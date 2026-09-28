# Nâng cấp TripFlow V0.9.0 → V1.0.0

V1.0.0 là **Stable Production Release**. Bản này không thêm nghiệp vụ mới và không thay đổi dữ liệu chuyến đi; mục tiêu là chốt marker production, đồng bộ version giữa source/database và hoàn thiện vận hành.

## 1. Migration

Nếu database đã ở V0.9.0, chỉ chạy:

```text
supabase/migrations/202609280005_v100_stable_production_release.sql
```

Migration tạo marker `1.0.0` và thay `tf_release_readiness()` để trả `channel = stable`. Migration không thêm/xóa/sửa dữ liệu nghiệp vụ.

## 2. Deploy

1. Backup/staging check trước production.
2. Chạy migration V1.0.0 trên đúng Supabase project.
3. Deploy source V1.0.0 bằng Node 24.x.
4. Đăng nhập → **Thêm → Trạng thái Production**.
5. Xác nhận app/database đều `1.0.0`, channel `stable`, server/client checks đều đạt.
6. Chạy smoke test theo `docs/PRODUCTION-RUNBOOK.md`.

## 3. Rollback

Có thể rollback frontend về deployment V0.9.0 nếu cần. Không cần xóa marker V1.0.0 chỉ để rollback frontend vì migration Stable không sửa schema nghiệp vụ. Nếu có migration sửa chữa khác sau V1.0.0, đánh giá riêng khả năng tương thích trước khi rollback.

## 4. Lưu ý

Source V1.0.0 cố ý không coi RPC V0.9.0 là Production-ready. Nếu quên chạy migration V1.0.0, `/api/release` trả `V100_MIGRATION_REQUIRED`.
