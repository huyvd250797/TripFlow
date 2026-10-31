import type { Bundle, TripPermissions } from "./types";
export const PERMISSION_FIELDS = [
  ["can_invite", "Mời thành viên"],
  ["can_change_roles", "Đổi quyền thành viên"],
  ["can_revoke_access", "Thu hồi quyền truy cập"],
  ["can_delete_trip", "Xóa chuyến đi"],
  ["can_close_budget", "Chốt dự toán"],
] as const;
export function tripPermissions(
  bundle?: Pick<Bundle, "role" | "permissions"> | null,
): TripPermissions {
  return Object.fromEntries(
    PERMISSION_FIELDS.map(([key]) => [
      key,
      bundle?.role === "owner" || bundle?.permissions?.[key] === true,
    ]),
  ) as TripPermissions;
}
