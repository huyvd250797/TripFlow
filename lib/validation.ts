import { z } from "zod";
import { CATEGORIES } from "./types";
const text = z.string().trim().min(1, "Vui lòng nhập nội dung.").max(200);
const note = z.string().max(5000).default("");
const link = z
  .string()
  .max(3000)
  .refine((v) => {
    if (!v) return true;
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "Liên kết phải là URL HTTPS hợp lệ.")
  .default("");
const ref = z.union([z.uuid(), z.literal(""), z.null()]).optional();
const day = z.iso.date();
const amount = z.coerce.number().int().min(1).max(1e12);
export const schemas = {
  trip: z
    .object({
      name: text.max(160),
      destination: z.string().max(300),
      start_date: day,
      end_date: day,
      timezone: z.string().min(1).max(100),
      people: z.coerce.number().int().min(1).max(999),
      status: z.enum([
        "planning",
        "ready",
        "traveling",
        "completed",
        "cancelled",
      ]),
      note,
    })
    .refine(
      (x) => x.end_date >= x.start_date,
      "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
    ),
  item: z
    .object({
      title: text,
      location: z.string().max(300),
      start_at: z.iso.datetime(),
      end_at: z.iso.datetime(),
      map_url: link,
      note,
    })
    .refine((x) => x.end_at > x.start_at, "Giờ kết thúc phải sau giờ bắt đầu."),
  budget: z
    .object({
      title: text,
      category: z.enum(CATEGORIES),
      item_id: ref,
      quantity: z.coerce
        .number()
        .positive()
        .max(100000)
        .refine(
          (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6,
          "Số lượng tối đa 2 chữ số thập phân.",
        ),
      unit_price: z.coerce.number().int().min(0).max(1e12),
      note,
    })
    .refine(
      (x) => x.quantity * x.unit_price <= 1e12,
      "Tổng tiền vượt giới hạn.",
    ),
  expense: z.object({
    title: text,
    category: z.enum(CATEGORIES),
    amount,
    kind: z.enum(["payment", "refund"]),
    budget_id: ref,
    refund_of: ref,
    spent_on: day,
    payer: z.string().max(160),
    note,
    receipt_url: link,
  }),
  media: z.object({
    title: text,
    kind: z.enum(["album", "photo", "video", "document"]),
    item_id: ref,
    url: link.refine((v) => !!v, "Vui lòng nhập liên kết."),
    note,
  }),
  participant: z.object({ name: text.max(160), note }),
  invitation: z.object({
    email: z.email().max(254),
    role: z.enum(["editor", "viewer"]),
  }),
  member: z.object({ role: z.enum(["editor", "viewer"]) }),
  snapshot: z.object({ title: text }),
};
export const mutationSchema = z
  .object({
    operationId: z.uuid(),
    tripId: z.uuid(),
    entity: z.enum([
      "trip",
      "item",
      "budget",
      "expense",
      "media",
      "participant",
      "invitation",
      "member",
      "snapshot",
    ]),
    action: z.enum(["create", "update", "delete", "status", "accept"]),
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .transform((req, ctx) => {
    let parsed;
    if (req.action === "delete") parsed = { success: true, data: {} };
    else if (req.action === "status")
      parsed = z
        .object({
          status: z.enum(["planned", "active", "done", "skipped"]),
          previous_id: ref,
        })
        .safeParse(req.data);
    else if (req.action === "accept")
      parsed = z.object({ token: z.uuid() }).safeParse(req.data);
    else parsed = schemas[req.entity].safeParse(req.data);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error?.issues[0]?.message || "Dữ liệu không hợp lệ",
      });
      return z.NEVER;
    }
    return { ...req, data: parsed.data };
  });
