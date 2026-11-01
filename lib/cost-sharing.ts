import { z } from "zod";
import type { Budget, Expense, Participant } from "./types";

export const costSharingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("equal") }),
  z.object({
    mode: z.literal("selected_equal"),
    participants: z
      .array(z.uuid())
      .min(1, "Chọn ít nhất một người để chia đều.")
      .max(999),
  }),
  z.object({
    mode: z.literal("fixed_remainder"),
    fixed: z
      .array(
        z.object({
          participant_id: z.uuid(),
          amount: z.number().int().positive().max(1e12),
        }),
      )
      .min(1)
      .max(999),
    participants: z
      .array(z.uuid())
      .min(1, "Chọn ít nhất một người chia phần còn lại.")
      .max(999),
  }),
]);
export type CostSharing = z.infer<typeof costSharingSchema>;
export type CostShare = {
  participant_id: string;
  name: string;
  amount: number;
};

/** Integer VND; stable UUID order assigns rounding remainders deterministically. */
export function allocateCost(
  total: number,
  rule: CostSharing,
  participants: Pick<Participant, "id" | "name">[],
): CostShare[] {
  if (!Number.isSafeInteger(total) || total < 0 || total > 1e12)
    throw Error("Tổng tiền không hợp lệ.");
  const people = new Map(participants.map((p) => [p.id, p.name]));
  const amounts = new Map<string, number>();
  let remainder = total;
  let selected: string[];
  if (rule.mode === "equal") selected = [...people.keys()];
  else if (rule.mode === "selected_equal") {
    selected = rule.participants;
    if (new Set(selected).size !== selected.length)
      throw Error("Danh sách người chia bị trùng.");
  } else {
    const fixedIds = rule.fixed.map((x) => x.participant_id);
    if (
      new Set(fixedIds).size !== fixedIds.length ||
      new Set(rule.participants).size !== rule.participants.length
    )
      throw Error("Danh sách người chia bị trùng.");
    for (const entry of rule.fixed) {
      if (!people.has(entry.participant_id))
        throw Error("Người chịu phần cố định không còn trong chuyến đi.");
      if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0)
        throw Error("Phần cố định phải là số tiền nguyên dương.");
      remainder -= entry.amount;
      amounts.set(entry.participant_id, entry.amount);
    }
    if (remainder < 0)
      throw Error("Phần cố định vượt tổng tiền khoản dự toán.");
    selected = rule.participants;
  }
  if (!selected.length)
    throw Error("Hãy thêm người tham gia trước khi chia chi phí.");
  if (selected.some((id) => !people.has(id)))
    throw Error("Người được chia không còn trong chuyến đi. Hãy chọn lại.");
  const ids = [...selected].sort();
  const quotient = Math.floor(remainder / ids.length),
    extra = remainder % ids.length;
  ids.forEach((id, i) =>
    amounts.set(id, (amounts.get(id) || 0) + quotient + (i < extra ? 1 : 0)),
  );
  return [...amounts]
    .map(([id, amount]) => ({
      participant_id: id,
      name: people.get(id)!,
      amount,
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "vi") ||
        a.participant_id.localeCompare(b.participant_id),
    );
}

export function costPayments(
  budget: Budget,
  expenses: Expense[],
  participants: Participant[],
) {
  const linked = expenses.filter((e) => e.budget_id === budget.id);
  const paid = new Map<string, number>();
  let fund = 0,
    unassigned = 0;
  for (const expense of linked) {
    const original =
      expense.kind === "refund"
        ? expenses.find((e) => e.id === expense.refund_of) || expense
        : expense;
    const value = Number(expense.amount) * (expense.kind === "refund" ? -1 : 1);
    if (original.payment_source === "fund") {
      fund += value;
      continue;
    }
    const matches = participants.filter(
      (p) => p.name.trim() === original.payer.trim(),
    );
    const id =
      original.payer_participant_id ||
      (matches.length === 1 ? matches[0].id : "");
    if (!id) unassigned += value;
    else paid.set(id, (paid.get(id) || 0) + value);
  }
  return {
    paid,
    fund,
    unassigned,
    total: linked.reduce(
      (s, e) => s + Number(e.amount) * (e.kind === "refund" ? -1 : 1),
      0,
    ),
  };
}
