import { z } from "zod";
export const BOOKING_KINDS = {
  flight: "Máy bay",
  transport: "Tàu / xe",
  hotel: "Khách sạn",
  rental: "Thuê xe",
  tour: "Tour",
  ticket: "Vé tham quan",
  document: "Tài liệu",
};
export const BOOKING_STATUS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  used: "Đã sử dụng",
  cancelled: "Đã hủy",
};
const text = z.string().max(4000).default("");
const link = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v ||
      (() => {
        try {
          return new URL(v).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "Chỉ chấp nhận liên kết HTTPS.",
  )
  .default("");
const time = z
  .union([z.literal(""), z.iso.datetime({ offset: true })])
  .default("");
const ref = z.union([z.literal(""), z.uuid()]).default("");
export const bookingData = z
  .object({
    kind: z.enum(
      Object.keys(BOOKING_KINDS) as [
        keyof typeof BOOKING_KINDS,
        ...(keyof typeof BOOKING_KINDS)[],
      ],
    ),
    title: z.string().trim().min(1, "Nhập tên đặt chỗ/tài liệu.").max(160),
    status: z.enum(["pending", "confirmed", "used", "cancelled"]),
    provider: text,
    code: text,
    holder: text,
    quantity: z.coerce.number().int().min(1).max(10000).default(1),
    timezone: z
      .string()
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("vi", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Múi giờ không hợp lệ.")
      .default("Asia/Ho_Chi_Minh"),
    start_at: time,
    end_at: time,
    deadline: time,
    cancel_by: time,
    location: text,
    contact: text,
    note: text,
    url: link,
    map_url: link,
    item_id: ref,
    budget_id: ref,
    booking_id: ref,
  })
  .refine(
    (d) =>
      !d.end_at ||
      (!!d.start_at && Date.parse(d.end_at) >= Date.parse(d.start_at)),
    "Giờ kết thúc phải sau giờ bắt đầu.",
  );
export type BookingData = z.infer<typeof bookingData>;
export type Booking = {
  id: string;
  trip_id: string;
  kind: BookingData["kind"];
  title: string;
  status: BookingData["status"];
  payload: BookingData;
  item_id: string | null;
  budget_id: string | null;
  booking_id: string | null;
  version: number;
  deleted_at: string | null;
};
export const bookingMutation = z
  .object({
    tripId: z.uuid(),
    id: z.uuid(),
    operationId: z.uuid(),
    action: z.enum(["create", "update", "delete"]),
    version: z.number().int().positive().optional(),
    data: bookingData.optional(),
  })
  .refine((p) => p.action === "delete" || !!p.data, "Thiếu thông tin đặt chỗ.")
  .refine(
    (p) => p.action === "create" || !!p.version,
    "Thiếu phiên bản dữ liệu.",
  );
