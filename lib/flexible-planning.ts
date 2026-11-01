import { z } from "zod";
import { localTime } from "./domain";
import type { Item, TravelWish } from "./types";
export const TRAVEL_MODES = {
  walk: "Đi bộ",
  motorbike: "Xe máy",
  car: "Ô tô",
  taxi: "Taxi",
  transit: "Công cộng",
  other: "Khác",
};
const nullableTime = z.preprocess(
  (x) => (x === "" || x == null ? null : x),
  z.iso.datetime().nullable(),
);
const nullableId = z.preprocess(
  (x) => (x === "" || x == null ? null : x),
  z.uuid().nullable(),
);
export const routeFields = {
  time_mode: z.enum(["flexible", "fixed"]).optional(),
  earliest_at: nullableTime.optional(),
  latest_at: nullableTime.optional(),
  travel_mode: z
    .enum(["walk", "motorbike", "car", "taxi", "transit", "other"])
    .optional(),
  travel_minutes: z
    .preprocess(
      (x) => (x === "" ? null : x),
      z.coerce.number().int().min(0).max(2880).nullable(),
    )
    .optional(),
  buffer_minutes: z.coerce.number().int().min(0).max(1440).optional(),
  leg_from_id: nullableId.optional(),
};
export function validBounds(x: {
  start_at: string;
  end_at?: string | null;
  earliest_at?: string | null;
  latest_at?: string | null;
}) {
  return (
    (!x.earliest_at || Date.parse(x.start_at) >= Date.parse(x.earliest_at)) &&
    (!x.latest_at ||
      (!!x.end_at && Date.parse(x.end_at) <= Date.parse(x.latest_at))) &&
    (!x.earliest_at ||
      !x.latest_at ||
      Date.parse(x.earliest_at) <= Date.parse(x.latest_at))
  );
}
export const routeItemSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    location: z.string().max(300).default(""),
    start_at: z.iso.datetime(),
    end_at: nullableTime,
    map_url: z
      .string()
      .max(3000)
      .refine((x) => {
        try {
          return !x || new URL(x).protocol === "https:";
        } catch {
          return false;
        }
      }),
    note: z.string().max(5000).default(""),
    ...routeFields,
  })
  .refine(
    (x) => !x.end_at || x.end_at > x.start_at,
    "Giờ kết thúc phải sau bắt đầu.",
  )
  .refine(
    validBounds,
    "Giờ hoạt động vượt giới hạn sớm nhất/muộn nhất; giới hạn hoàn tất cần có giờ kết thúc.",
  );
export const wishSchema = z.object({
  title: z.string().trim().min(1).max(200),
  location: z.string().max(300).default(""),
  duration_minutes: z.coerce.number().int().min(5).max(2880),
  map_url: z
    .string()
    .max(3000)
    .refine((x) => {
      try {
        return !x || new URL(x).protocol === "https:";
      } catch {
        return false;
      }
    }),
  note: z.string().max(5000).default(""),
  backup_for_id: nullableId,
});
const refVersion = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});
export const routeBatchSchema = z
  .object({
    trip_version: z.number().int().positive(),
    days: z.array(z.iso.date()).min(1).max(2),
    context: z.array(refVersion).max(200),
    updates: z
      .array(
        refVersion.extend({ start_at: z.iso.datetime(), end_at: nullableTime }),
      )
      .max(100)
      .default([]),
    create_item: z.object({ id: z.uuid(), data: routeItemSchema }).optional(),
    consume_wish: refVersion.optional(),
    replace_item: refVersion
      .extend({ keep_old: z.boolean(), wish_id: z.uuid() })
      .optional(),
  })
  .refine((x) => !!x.updates.length || !!x.create_item, "Chưa có thay đổi.")
  .refine(
    (x) =>
      new Set(x.context.map((r) => r.id)).size === x.context.length &&
      new Set(x.updates.map((r) => r.id)).size === x.updates.length,
    "Mã hoạt động bị trùng.",
  )
  .refine(
    (x) => !x.replace_item || !!x.create_item,
    "Thay thế cần có hoạt động mới.",
  );
export function routeDayItems(items: Item[], day: string, zone: string) {
  return items.filter(
    (x) =>
      x.status !== "skipped" &&
      localTime(x.start_at, zone).slice(0, 10) <= day &&
      localTime(
        x.end_at
          ? new Date(Date.parse(x.end_at) - 1).toISOString()
          : x.start_at,
        zone,
      ).slice(0, 10) >= day,
  );
}
export function routeContext(items: Item[], days: string[], zone: string) {
  return items
    .filter((x) => x.status !== "skipped")
    .map((x) => ({ id: x.id, version: x.version }));
}
export type RouteIssue = { id: string; message: string };
export function routeIssues(items: Item[], zone: string): RouteIssue[] {
  const sorted = items
    .filter((x) => x.status !== "skipped")
    .sort(
      (a, b) =>
        Date.parse(a.start_at) - Date.parse(b.start_at) ||
        a.id.localeCompare(b.id),
    );
  const issues: RouteIssue[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const x = sorted[i],
      prev = sorted[i - 1];
    if (!x.location.trim())
      issues.push({ id: x.id, message: `${x.title}: chưa có địa điểm.` });
    if (!validBounds(x))
      issues.push({
        id: x.id,
        message: `${x.title}: vượt giới hạn giờ hoặc thiếu giờ kết thúc.`,
      });
    if (
      !prev ||
      localTime(prev.end_at || prev.start_at, zone).slice(0, 10) !==
        localTime(x.start_at, zone).slice(0, 10)
    )
      continue;
    if (!prev.end_at) {
      issues.push({
        id: x.id,
        message: `${prev.title}: chưa có giờ kết thúc để kiểm tra chặng tiếp.`,
      });
      continue;
    }
    const gap = (Date.parse(x.start_at) - Date.parse(prev.end_at)) / 60000;
    if (gap < 0)
      issues.push({
        id: x.id,
        message: `${x.title}: trùng ${Math.ceil(-gap)} phút với ${prev.title}.`,
      });
    else if (x.leg_from_id !== prev.id || x.travel_minutes == null)
      issues.push({
        id: x.id,
        message: `${x.title}: cần xác nhận thời gian di chuyển từ ${prev.title}.`,
      });
    else if (gap < x.travel_minutes + (x.buffer_minutes || 0))
      issues.push({
        id: x.id,
        message: `${x.title}: thiếu ${Math.ceil(x.travel_minutes + (x.buffer_minutes || 0) - gap)} phút để di chuyển và dự phòng.`,
      });
  }
  return issues;
}
export function previewShift(
  items: Item[],
  target: Item,
  start: string,
  duration: number | null,
  following: boolean,
  zone: string,
) {
  const end =
    duration == null
      ? null
      : new Date(Date.parse(start) + duration * 60000).toISOString();
  const delta =
    Date.parse(end || start) - Date.parse(target.end_at || target.start_at);
  const day = localTime(target.start_at, zone).slice(0, 10),
    newDay = localTime(start, zone).slice(0, 10);
  if (following && (duration == null || !target.end_at || day !== newDay))
    throw new Error(
      "Dời các điểm sau cần biết thời lượng và giữ hoạt động trong cùng ngày.",
    );
  const updates = [
    { id: target.id, version: target.version, start_at: start, end_at: end },
  ];
  if (following) {
    for (const x of items
      .filter(
        (x) =>
          x.id !== target.id &&
          x.status !== "skipped" &&
          Date.parse(x.start_at) >= Date.parse(target.start_at),
      )
      .sort(
        (a, b) =>
          Date.parse(a.start_at) - Date.parse(b.start_at) ||
          a.id.localeCompare(b.id),
      )) {
      if (
        localTime(x.start_at, zone).slice(0, 10) !== day ||
        x.time_mode === "fixed"
      )
        break;
      if (x.status !== "planned") continue;
      const nextStart = new Date(Date.parse(x.start_at) + delta).toISOString(),
        nextEnd = x.end_at
          ? new Date(Date.parse(x.end_at) + delta).toISOString()
          : null;
      if (
        localTime(nextStart, zone).slice(0, 10) !== day ||
        (nextEnd &&
          localTime(
            new Date(Date.parse(nextEnd) - 1).toISOString(),
            zone,
          ).slice(0, 10) !==
            localTime(
              new Date(Date.parse(x.end_at!) - 1).toISOString(),
              zone,
            ).slice(0, 10))
      )
        throw new Error(
          "Thay đổi đẩy một điểm sang ngày khác. Hãy điều chỉnh riêng điểm đó.",
        );
      updates.push({
        id: x.id,
        version: x.version,
        start_at: nextStart,
        end_at: nextEnd,
      });
    }
  }
  const next = items.map((x) => ({
    ...x,
    ...updates.find((u) => u.id === x.id),
  }));
  if (next.some((x) => updates.some((u) => u.id === x.id) && !validBounds(x)))
    throw new Error(
      "Thay đổi vượt giới hạn giờ. Hãy sửa giới hạn trong form hoạt động trước.",
    );
  return {
    updates,
    items: next,
    days: [...new Set([day, newDay])],
    issues: routeIssues(next, zone),
  };
}
export function directionsUrl(from: Item, to: Item) {
  if (!from.location.trim() || !to.location.trim()) return "";
  const mode =
    to.travel_mode === "walk"
      ? "walking"
      : to.travel_mode === "transit"
        ? "transit"
        : "driving";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from.location)}&destination=${encodeURIComponent(to.location)}&travelmode=${mode}`;
}
export const wishToItem = (wish: TravelWish, start: string) => ({
  title: wish.title,
  location: wish.location,
  start_at: start,
  end_at: new Date(
    Date.parse(start) + wish.duration_minutes * 60000,
  ).toISOString(),
  map_url: wish.map_url,
  note: wish.note,
  time_mode: "flexible" as const,
});
