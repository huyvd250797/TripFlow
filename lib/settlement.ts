import { z } from "zod";
import type { FundEntry } from "./fund";
export type SettlementRow = {
  id: string;
  name: string;
  share: number;
  paid: number;
  contributed: number;
  returned: number;
  reimbursed: number;
  sent: number;
  received: number;
  balance: number;
};
export type SettlementEntry = {
  id: string;
  kind: "transfer" | "reversal" | "close" | "reopen";
  from_id: string | null;
  to_id: string | null;
  amount: number;
  reverses_id: string | null;
  occurred_on: string;
  note: string;
  receipt_url: string;
  actor_id: string;
  created_at: string;
};
export type SettlementData = {
  revision: number;
  closed_at: string | null;
  can_close: boolean;
  generated_at: string;
  rows: SettlementRow[];
  details: {
    participant_id: string;
    kind: string;
    title: string;
    amount: number;
    id: string;
  }[];
  issues: { code: string; id?: string; title: string; message: string }[];
  fund_history: FundEntry[];
  actual: number;
  allocated: number;
  fund_balance: number;
  unpaid: number;
  budgets: {
    id: string;
    title: string;
    planned: number;
    actual: number;
    remaining: number;
  }[];
  advances: { id: string; title: string; payer: string; remaining: number }[];
  history: SettlementEntry[];
};
export type TransferSuggestion = {
  from_id: string;
  to_id: string;
  amount: number;
};
/** Deterministic greedy matching, not a promise of the globally fewest transfers. */
export function transferSuggestions(
  rows: SettlementRow[],
): TransferSuggestion[] {
  const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const debtors = ordered
    .filter((x) => x.balance < 0)
    .map((x) => ({ id: x.id, value: -Number(x.balance) }));
  const creditors = ordered
    .filter((x) => x.balance > 0)
    .map((x) => ({ id: x.id, value: Number(x.balance) }));
  const result: TransferSuggestion[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const a = debtors[i],
      b = creditors[j],
      amount = Math.min(a.value, b.value);
    if (amount > 0) result.push({ from_id: a.id, to_id: b.id, amount });
    a.value -= amount;
    b.value -= amount;
    if (!a.value) i++;
    if (!b.value) j++;
  }
  return result;
}
const amount = z.coerce.number().int().positive().max(1e12);
const note = z.string().trim().max(2000).default("");
const link = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || /^https:\/\/\S+$/.test(v),
    "Chứng từ phải là link HTTPS.",
  )
  .default("");
const base = {
  tripId: z.uuid(),
  operationId: z.uuid(),
  revision: z.number().int().nonnegative(),
};
const entry = { amount, occurred_on: z.iso.date(), note, receipt_url: link };
export const settlementMutation = z.discriminatedUnion("action", [
  z.object({
    ...base,
    action: z.literal("transfer"),
    data: z
      .object({ ...entry, from_id: z.uuid(), to_id: z.uuid() })
      .refine(
        (x) => x.from_id !== x.to_id,
        "Người chuyển và nhận phải khác nhau.",
      ),
  }),
  z.object({
    ...base,
    action: z.literal("fund_return"),
    data: z.object({ ...entry, participant_id: z.uuid() }),
  }),
  z.object({
    ...base,
    action: z.literal("reimbursement"),
    data: z.object({ ...entry, expense_id: z.uuid() }),
  }),
  z.object({
    ...base,
    action: z.literal("reversal"),
    data: z.object({
      reverses_id: z.uuid(),
      note: z.string().trim().min(1, "Nhập lý do hủy.").max(2000),
    }),
  }),
  z.object({ ...base, action: z.literal("close"), data: z.object({ note }) }),
  z.object({
    ...base,
    action: z.literal("reopen"),
    data: z.object({
      note: z.string().trim().min(1, "Nhập lý do mở lại.").max(2000),
    }),
  }),
]);
export const settlementErrors: Record<string, string> = {
  SETTLEMENT_LIMIT:
    "Tổng giao dịch vượt giới hạn hiển thị chính xác. Liên hệ quản trị để đối chiếu và xuất sổ trước khi quyết toán.",
  SETTLEMENT_CLOSED:
    "Quyết toán đã chốt. Người có quyền cần mở lại trước khi thay đổi tài chính.",
  SETTLEMENT_NOT_READY:
    "Chưa thể chốt: kiểm tra khoản chưa phân chia, số dư thành viên, quỹ dư và dự toán chưa thanh toán đủ.",
  SETTLEMENT_INCOMPLETE:
    "Còn khoản thiếu người trả hoặc cách chia. Sửa các mục Cần kiểm tra trước khi ghi nhận quyết toán.",
  TRANSFER_EXCEEDS_BALANCE:
    "Số tiền vượt số còn phải trả/được nhận. Tải lại công nợ và kiểm tra số tiền.",
  PARTICIPANT_HAS_SETTLEMENT:
    "Người này có giao dịch tài chính. Hãy giữ người trong chuyến đi để bảo toàn công nợ.",
  STALE_VERSION:
    "Dữ liệu tài chính vừa thay đổi. Tải lại, kiểm tra số dư mới và xác nhận lại.",
  INVALID_REVERSAL: "Giao dịch đã hủy hoặc không thuộc chuyến đi này.",
  REASON_REQUIRED: "Nhập lý do hủy hoặc mở lại quyết toán.",
  PERMISSION_DENIED: "Bạn chưa được cấp quyền Chốt/mở lại quyết toán.",
  READ_ONLY: "Bạn chỉ có quyền xem quyết toán.",
  FORBIDDEN: "Bạn không còn quyền truy cập chuyến đi.",
  OPERATION_REUSED: "Mã giao dịch đã dùng cho nội dung khác.",
  INVALID_AMOUNT: "Số tiền phải là số nguyên dương, tối đa 1.000 tỷ đồng.",
  INVALID_PARTICIPANT: "Người tham gia không còn hợp lệ.",
  ACCOUNT_DEACTIVATED: "Tài khoản đã ngừng hoạt động.",
};
