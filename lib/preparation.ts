import { z } from "zod";
import type { ChecklistItem, Participant } from "./types";
export const PREPARATION_CATEGORIES = [
  "Giấy tờ",
  "Hành lý",
  "Đồ điện tử",
  "Thuốc & vật dụng cá nhân",
  "Đồ cho bé",
  "Việc trước khi đi",
] as const;
const title = z.string().trim().min(1, "Vui lòng nhập tên.").max(200);
const nullableId = z.preprocess(
  (x) => (x === "" || x == null ? null : x),
  z.uuid().nullable(),
);
export const checklistSchema = z
  .object({
    title,
    category: z.enum(PREPARATION_CATEGORIES),
    kind: z.enum(["packing", "task"]),
    scope: z.enum(["shared", "personal"]),
    assignee_id: nullableId,
    quantity: z.coerce.number().int().min(1).max(999),
    due_on: z.preprocess(
      (x) => (x === "" || x == null ? null : x),
      z.iso.date().nullable(),
    ),
    note: z.string().max(5000).default(""),
    status: z.enum(["needed", "ready", "packed", "done"]),
    excluded: z.boolean().default(false),
  })
  .refine(
    (x) => x.scope !== "personal" || !!x.assignee_id,
    "Hãy chọn người phụ trách mục cá nhân.",
  )
  .refine(
    (x) =>
      x.kind === "task"
        ? ["needed", "done"].includes(x.status)
        : x.status !== "done",
    "Trạng thái không phù hợp loại mục.",
  );
export const checklistBatchSchema = z
  .object({
    entries: z
      .array(checklistSchema.safeExtend({ id: z.uuid() }))
      .min(1)
      .max(60),
  })
  .refine(
    (x) => new Set(x.entries.map((i) => i.id)).size === x.entries.length,
    "Mã mục bị trùng.",
  );
export const contactSchema = z.object({
  name: title,
  kind: z.enum(["hotel", "driver", "family", "other"]),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+\d\s().-]*$/, "Số điện thoại không hợp lệ."),
  address: z.string().trim().max(500).default(""),
  map_url: z
    .string()
    .max(3000)
    .refine((x) => {
      try {
        return !x || new URL(x).protocol === "https:";
      } catch {
        return false;
      }
    }, "Liên kết bản đồ phải là HTTPS."),
  note: z.string().max(5000).default(""),
});
export const checklistComplete = (x: ChecklistItem) =>
  x.kind === "task" ? x.status === "done" : x.status === "packed";
export function preparationProgress(items: ChecklistItem[], today: string) {
  const active = items.filter((x) => !x.excluded),
    unfinished = active.filter((x) => !checklistComplete(x));
  return {
    total: active.length,
    complete: active.length - unfinished.length,
    missing: unfinished.length,
    overdue: unfinished.filter((x) => x.due_on && x.due_on < today).length,
    unassigned: unfinished.filter((x) => !x.assignee_id).length,
  };
}
export function filterPreparation(
  items: ChecklistItem[],
  filter: string,
  person: string,
  participants: Participant[],
) {
  const ids = new Set(participants.map((p) => p.id));
  return items.filter((x) =>
    filter === "mine"
      ? !!person && ids.has(person) && x.assignee_id === person
      : filter === "unfinished"
        ? !x.excluded && !checklistComplete(x)
        : filter === "unassigned"
          ? !x.excluded &&
            !checklistComplete(x) &&
            (!x.assignee_id || !ids.has(x.assignee_id))
          : true,
  );
}
type Seed = [
  string,
  (typeof PREPARATION_CATEGORIES)[number],
  "packing" | "task",
];
const common: Seed[] = [
  ["Giấy tờ tùy thân", "Giấy tờ", "packing"],
  ["Quần áo & đồ ngủ", "Hành lý", "packing"],
  ["Sạc điện thoại", "Đồ điện tử", "packing"],
  ["Thuốc dùng thường ngày", "Thuốc & vật dụng cá nhân", "packing"],
  ["Kiểm tra đặt chỗ và giờ khởi hành", "Việc trước khi đi", "task"],
  ["Khóa cửa, kiểm tra điện nước", "Việc trước khi đi", "task"],
];
export const PACKING_TEMPLATES: { id: string; name: string; items: Seed[] }[] =
  [
    {
      id: "beach",
      name: "Du lịch biển",
      items: [
        ...common,
        ["Đồ bơi & khăn tắm", "Hành lý", "packing"],
        ["Kem chống nắng", "Thuốc & vật dụng cá nhân", "packing"],
      ],
    },
    {
      id: "resort",
      name: "Nghỉ dưỡng",
      items: [
        ...common,
        ["Xác nhận giờ nhận phòng", "Việc trước khi đi", "task"],
        ["Trang phục đi dạo", "Hành lý", "packing"],
      ],
    },
    {
      id: "independent",
      name: "Du lịch tự túc",
      items: [
        ...common,
        ["Pin dự phòng", "Đồ điện tử", "packing"],
        ["Kiểm tra phương tiện và tuyến đường", "Việc trước khi đi", "task"],
        ["Lưu địa chỉ lưu trú", "Việc trước khi đi", "task"],
      ],
    },
    {
      id: "baby",
      name: "Gia đình có em bé",
      items: [
        ...common,
        ["Bỉm, khăn ướt & túi đựng đồ", "Đồ cho bé", "packing"],
        ["Sữa, bình sữa & đồ ăn", "Đồ cho bé", "packing"],
        ["Quần áo dự phòng cho bé", "Đồ cho bé", "packing"],
        ["Xe đẩy hoặc địu", "Đồ cho bé", "packing"],
        ["Kiểm tra nhu cầu ăn ngủ của bé", "Việc trước khi đi", "task"],
      ],
    },
  ];
export function copyPackingTemplate(
  id: string,
  assignee: string | null,
  scope: "shared" | "personal",
  due: string | null,
) {
  const template = PACKING_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error("Không tìm thấy mẫu.");
  return template.items.map(([title, category, kind]) => ({
    id: crypto.randomUUID(),
    title,
    category,
    kind,
    scope,
    assignee_id: assignee,
    quantity: 1,
    due_on: due,
    note: "",
    status: "needed" as const,
    excluded: false,
  }));
}
export const CONTACT_KINDS = {
  hotel: "Khách sạn",
  driver: "Tài xế",
  family: "Người thân",
  other: "Khác",
};
export const AGE_GROUPS = {
  adult: "Người lớn",
  child: "Trẻ em",
  infant: "Em bé",
};
