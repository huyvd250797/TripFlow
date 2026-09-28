import type { Bundle } from "./types";
import { localTime, money } from "./domain";

export type WorkspaceSearchKind =
  | "item"
  | "expense"
  | "budget"
  | "media"
  | "participant";

export type WorkspaceSearchResult = {
  kind: WorkspaceSearchKind;
  id: string;
  title: string;
  subtitle: string;
  tab: "route" | "money" | "media" | "more";
  day?: string;
};

const fold = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .trim();

export function searchTripWorkspace(
  bundle: Bundle,
  query: string,
  limit = 18,
): WorkspaceSearchResult[] {
  const q = fold(query);
  if (!q) return [];
  const rows: Array<WorkspaceSearchResult & { haystack: string; rank: number }> = [];
  const push = (
    result: WorkspaceSearchResult,
    searchable: unknown[],
    rank = 0,
  ) => {
    const haystack = fold(searchable.join(" "));
    if (!haystack.includes(q)) return;
    const title = fold(result.title);
    const score = title === q ? 0 : title.startsWith(q) ? 1 : rank + 2;
    rows.push({ ...result, haystack, rank: score });
  };

  for (const item of bundle.items) {
    push(
      {
        kind: "item",
        id: item.id,
        title: item.title,
        subtitle: `${item.location || "Chưa có địa điểm"} · Lịch trình`,
        tab: "route",
        day: localTime(item.start_at, bundle.trip.timezone).slice(0, 10),
      },
      [item.title, item.location, item.note],
    );
  }
  for (const expense of bundle.expenses) {
    push(
      {
        kind: "expense",
        id: expense.id,
        title: expense.title,
        subtitle: `${money(expense.amount)} · ${expense.category} · ${expense.spent_on}`,
        tab: "money",
      },
      [expense.title, expense.category, expense.payer, expense.note, expense.spent_on],
      1,
    );
  }
  for (const budget of bundle.budgets) {
    push(
      {
        kind: "budget",
        id: budget.id,
        title: budget.title,
        subtitle: `${money(budget.amount)} · ${budget.category} · Dự toán`,
        tab: "money",
      },
      [budget.title, budget.category, budget.note],
      2,
    );
  }
  for (const media of bundle.media) {
    push(
      {
        kind: "media",
        id: media.id,
        title: media.title,
        subtitle: `${media.kind} · Media`,
        tab: "media",
      },
      [media.title, media.kind, media.note, media.url],
      3,
    );
  }
  for (const person of bundle.participants) {
    push(
      {
        kind: "participant",
        id: person.id,
        title: person.name,
        subtitle: "Người tham gia chuyến đi",
        tab: "more",
      },
      [person.name, person.note],
      4,
    );
  }

  return rows
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, "vi"))
    .slice(0, Math.max(1, limit))
    .map(({ haystack: _haystack, rank: _rank, ...result }) => result);
}
