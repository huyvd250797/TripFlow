import { z } from "zod";
import type { Expense } from "./types";
export type FundEntry = {
  id: string;
  trip_id: string;
  kind: "contribution" | "return" | "reimbursement" | "reversal";
  participant_id: string | null;
  expense_id: string | null;
  reverses_id: string | null;
  amount: number;
  occurred_on: string;
  note: string;
  method: string;
  receipt_url: string;
  created_at: string;
};
export type FundData = {
  fund: { id: string; keeper: string; note: string; version: number } | null;
  targets: {
    id: string;
    participant_id: string;
    amount: number;
    due_on: string | null;
    version: number;
  }[];
  entries: FundEntry[];
};
export const emptyFund: FundData = { fund: null, targets: [], entries: [] };
export const FUND_LABELS = {
  contribution: "Đóng quỹ",
  return: "Trả quỹ",
  reimbursement: "Hoàn ứng",
  reversal: "Hủy giao dịch",
};
const amount = z.coerce.number().int().min(0).max(1e12);
const base = {
  tripId: z.uuid(),
  operationId: z.uuid(),
  version: z.number().int().positive().optional(),
};
export const fundMutation = z.discriminatedUnion("action", [
  z.object({
    ...base,
    action: z.literal("setup"),
    data: z.object({
      keeper: z.string().trim().max(160),
      note: z.string().max(2000),
    }),
  }),
  z.object({
    ...base,
    action: z.literal("target"),
    data: z.object({
      participant_id: z.uuid(),
      amount,
      due_on: z.union([z.iso.date(), z.literal("")]),
    }),
  }),
  z.object({
    ...base,
    action: z.literal("entry"),
    data: z.object({
      kind: z.enum(["contribution", "return", "reimbursement", "reversal"]),
      participant_id: z.string().default(""),
      expense_id: z.string().default(""),
      reverses_id: z.string().default(""),
      amount: amount.positive(),
      occurred_on: z.iso.date(),
      note: z.string().max(2000).default(""),
      method: z.string().max(100).default(""),
      receipt_url: z
        .string()
        .max(2000)
        .refine(
          (v) => !v || /^https:\/\/\S+$/.test(v),
          "Chứng từ phải là link HTTPS.",
        )
        .default(""),
    }),
  }),
]);
export function fundTotals(data: FundData, expenses: Expense[]) {
  const reversed = new Set(
    data.entries.map((e) => e.reverses_id).filter(Boolean),
  );
  const active = data.entries.filter(
    (e) => e.kind !== "reversal" && !reversed.has(e.id),
  );
  const sum = (kind: string) =>
    active
      .filter((e) => e.kind === kind)
      .reduce((s, e) => s + Number(e.amount), 0);
  const fundSpent = expenses
    .filter((e) => e.payment_source === "fund")
    .reduce((s, e) => s + (e.kind === "refund" ? -1 : 1) * Number(e.amount), 0);
  const advances = expenses
    .filter((e) => e.kind === "payment" && e.payment_source !== "fund")
    .map((e) => ({
      expense: e,
      remaining:
        Number(e.amount) -
        expenses
          .filter((x) => x.refund_of === e.id)
          .reduce((s, x) => s + Number(x.amount), 0) -
        active
          .filter((x) => x.kind === "reimbursement" && x.expense_id === e.id)
          .reduce((s, x) => s + Number(x.amount), 0),
    }))
    .filter((x) => x.remaining > 0);
  return {
    active,
    reversed,
    collected: sum("contribution"),
    returned: sum("return"),
    reimbursed: sum("reimbursement"),
    fundSpent,
    balance:
      sum("contribution") - sum("return") - sum("reimbursement") - fundSpent,
    advances,
    outstanding: advances.reduce((s, x) => s + x.remaining, 0),
    target: data.targets.reduce((s, x) => s + Number(x.amount), 0),
  };
}
export const fundErrors: Record<string, string> = {
  FUND_INSUFFICIENT:
    "Quỹ không đủ tiền. Hãy kiểm tra số đã thu và khoản chi từ quỹ.",
  REIMBURSEMENT_EXCEEDS_ADVANCE:
    "Số hoàn ứng vượt phần cá nhân còn ứng. Kiểm tra khoản chi và các lần hoàn trước.",
  RETURN_EXCEEDS_CONTRIBUTION: "Số trả quỹ vượt số thành viên đã đóng còn lại.",
  FUND_SETUP_REQUIRED: "Hãy lưu người giữ quỹ trước khi ghi giao dịch.",
  STALE_VERSION: "Dữ liệu đã đổi trên thiết bị khác. Tải lại trước khi sửa.",
  OPERATION_REUSED: "Mã giao dịch đã dùng cho nội dung khác.",
  READ_ONLY: "Bạn chỉ có quyền xem quỹ.",
  FORBIDDEN: "Bạn không còn quyền truy cập chuyến đi này.",
  INVALID_ADVANCE: "Khoản ứng không còn hợp lệ.",
  INVALID_PARTICIPANT: "Người tham gia không còn hợp lệ.",
  INVALID_REVERSAL: "Không tìm thấy giao dịch cần hủy.",
};
