import type {
  Budget,
  Bundle,
  Expense,
  Item,
  Media,
  Mutation,
  Participant,
  QueuedMutation,
  TripListResponse,
} from "./types";

const CORE_OFFLINE_ACTIONS: Record<string, Set<string>> = {
  trip: new Set(["update"]),
  item: new Set(["create", "update", "delete", "status"]),
  budget: new Set(["create", "update", "delete"]),
  expense: new Set(["create", "update", "delete"]),
  media: new Set(["create", "update", "delete"]),
  participant: new Set(["create", "update", "delete"]),
};

export function isCoreOfflineMutation(mutation: Mutation) {
  return CORE_OFFLINE_ACTIONS[mutation.entity]?.has(mutation.action) === true;
}

export function retryDelayMs(attempts: number) {
  const schedule = [2000, 5000, 15000, 30000, 60000, 120000, 300000];
  return schedule[Math.min(Math.max(0, attempts - 1), schedule.length - 1)];
}

export function compareQueuedMutations(a: QueuedMutation, b: QueuedMutation) {
  return (
    a.createdAt.localeCompare(b.createdAt) ||
    (a.sequence || 0) - (b.sequence || 0) ||
    a.operationId.localeCompare(b.operationId)
  );
}

export function queueRecordKey(mutation: Mutation) {
  const id = mutation.entity === "trip" ? mutation.tripId : mutation.id;
  if (!id) return null;
  return `${mutation.tripId}:${mutation.entity}:${id}`;
}

function mergeData(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
) {
  return { ...(left || {}), ...(right || {}) };
}

export type QueueCompactionResult = {
  rows: QueuedMutation[];
  queued: QueuedMutation | null;
  compacted: boolean;
  cancelled: boolean;
};

export function compactQueueRows(
  rows: QueuedMutation[],
  incoming: Mutation,
  userId: string,
  nowIso: string,
  options: {
    allowCompaction?: boolean;
    attempted?: boolean;
    createdAt?: string;
    sequence?: number;
  } = {},
): QueueCompactionResult {
  const key = queueRecordKey(incoming);
  const allowCompaction = options.allowCompaction !== false;
  let existingIndex = -1;
  if (allowCompaction && key && incoming.action !== "status") {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (
        row.state === "pending" &&
        row.attempts === 0 &&
        !row.lastAttemptAt &&
        row.mutation.action !== "status" &&
        queueRecordKey(row.mutation) === key
      ) {
        existingIndex = index;
        break;
      }
    }
  }

  if (existingIndex >= 0) {
    const existing = rows[existingIndex];
    const previous = existing.mutation;

    if (previous.action === "create" && incoming.action === "delete") {
      return {
        rows: rows.filter((_, index) => index !== existingIndex),
        queued: null,
        compacted: true,
        cancelled: true,
      };
    }

    if (previous.action === "create" && incoming.action === "update") {
      const queued: QueuedMutation = {
        ...existing,
        mutation: {
          ...previous,
          data: mergeData(previous.data, incoming.data),
        },
        updatedAt: nowIso,
        error: undefined,
        nextAttemptAt: undefined,
      };
      const next = [...rows];
      next[existingIndex] = queued;
      return { rows: next, queued, compacted: true, cancelled: false };
    }

    if (previous.action === "update" && incoming.action === "update") {
      const queued: QueuedMutation = {
        ...existing,
        mutation: {
          ...previous,
          data: mergeData(previous.data, incoming.data),
          version: previous.version,
        },
        updatedAt: nowIso,
        error: undefined,
        nextAttemptAt: undefined,
      };
      const next = [...rows];
      next[existingIndex] = queued;
      return { rows: next, queued, compacted: true, cancelled: false };
    }

    if (previous.action === "update" && incoming.action === "delete") {
      const queued: QueuedMutation = {
        ...existing,
        mutation: {
          ...incoming,
          operationId: previous.operationId,
          version: previous.version,
          data: undefined,
        },
        updatedAt: nowIso,
        error: undefined,
        nextAttemptAt: undefined,
      };
      const next = [...rows];
      next[existingIndex] = queued;
      return { rows: next, queued, compacted: true, cancelled: false };
    }
  }

  const attempted = options.attempted === true;
  const nextSequence =
    options.sequence ??
    rows.reduce((max, row) => Math.max(max, row.sequence || 0), 0) + 1;
  const queued: QueuedMutation = {
    operationId: incoming.operationId,
    userId,
    tripId: incoming.tripId,
    mutation: incoming,
    state: "pending",
    attempts: attempted ? 1 : 0,
    sequence: nextSequence,
    createdAt: options.createdAt || nowIso,
    updatedAt: nowIso,
    ...(attempted
      ? {
          lastAttemptAt: nowIso,
          nextAttemptAt: new Date(Date.parse(nowIso) + retryDelayMs(1)).toISOString(),
        }
      : {}),
  };
  return {
    rows: [...rows, queued].sort(compareQueuedMutations),
    queued,
    compacted: false,
    cancelled: false,
  };
}

const baseRow = (id: string, nowIso: string) => ({
  id,
  version: 1,
  created_at: nowIso,
  updated_at: nowIso,
});

const bumped = <T extends { version: number; updated_at: string }>(
  row: T,
  patch: Partial<T>,
  nowIso: string,
): T => ({
  ...row,
  ...patch,
  version: row.version + 1,
  updated_at: nowIso,
});

function optimisticItem(mutation: Mutation, nowIso: string): Item | null {
  if (!mutation.id || mutation.action !== "create") return null;
  const data = mutation.data || {};
  return {
    ...baseRow(mutation.id, nowIso),
    trip_id: mutation.tripId,
    title: String(data.title || ""),
    location: String(data.location || ""),
    start_at: String(data.start_at || nowIso),
    end_at: data.end_at ? String(data.end_at) : null,
    status: "planned",
    map_url: String(data.map_url || ""),
    note: String(data.note || ""),
    checked_in_at: null,
    completed_at: null,
  };
}

function optimisticBudget(mutation: Mutation, nowIso: string): Budget | null {
  if (!mutation.id || mutation.action !== "create") return null;
  const data = mutation.data || {};
  const quantity = Number(data.quantity || 0);
  const unitPrice = Number(data.unit_price || 0);
  return {
    ...baseRow(mutation.id, nowIso),
    title: String(data.title || ""),
    category: String(data.category || "Khác"),
    quantity,
    unit_price: unitPrice,
    amount: Math.round(quantity * unitPrice),
    item_id: data.item_id ? String(data.item_id) : null,
    note: String(data.note || ""),
  };
}

function optimisticExpense(mutation: Mutation, nowIso: string): Expense | null {
  if (!mutation.id || mutation.action !== "create") return null;
  const data = mutation.data || {};
  return {
    ...baseRow(mutation.id, nowIso),
    title: String(data.title || ""),
    category: String(data.category || "Khác"),
    amount: Number(data.amount || 0),
    kind: data.kind === "refund" ? "refund" : "payment",
    spent_on: String(data.spent_on || nowIso.slice(0, 10)),
    budget_id: data.budget_id ? String(data.budget_id) : null,
    refund_of: data.refund_of ? String(data.refund_of) : null,
    payer: String(data.payer || ""),
    note: String(data.note || ""),
    receipt_url: String(data.receipt_url || ""),
  };
}

function optimisticMedia(mutation: Mutation, nowIso: string): Media | null {
  if (!mutation.id || mutation.action !== "create") return null;
  const data = mutation.data || {};
  const kind = ["album", "photo", "video", "document"].includes(String(data.kind))
    ? (String(data.kind) as Media["kind"])
    : "album";
  return {
    ...baseRow(mutation.id, nowIso),
    title: String(data.title || ""),
    kind,
    url: String(data.url || ""),
    item_id: data.item_id ? String(data.item_id) : null,
    note: String(data.note || ""),
    taken_on: data.taken_on ? String(data.taken_on) : null,
    is_highlight: Boolean(data.is_highlight),
    is_cover: Boolean(data.is_cover),
    story_order: Number(data.story_order || 0),
  };
}

function optimisticParticipant(
  mutation: Mutation,
  nowIso: string,
): Participant | null {
  if (!mutation.id || mutation.action !== "create") return null;
  const data = mutation.data || {};
  return {
    ...baseRow(mutation.id, nowIso),
    name: String(data.name || ""),
    note: String(data.note || ""),
  };
}

export function applyOptimisticMutation(
  bundle: Bundle,
  mutation: Mutation,
  nowIso = new Date().toISOString(),
): Bundle {
  if (bundle.trip.id !== mutation.tripId) return bundle;
  let next: Bundle = {
    ...bundle,
    trip: { ...bundle.trip },
    items: [...bundle.items],
    budgets: [...bundle.budgets],
    expenses: [...bundle.expenses],
    media: [...bundle.media],
    participants: [...bundle.participants],
  };
  const data = mutation.data || {};

  if (mutation.entity === "trip" && mutation.action === "update") {
    next.trip = bumped(next.trip, data as Partial<typeof next.trip>, nowIso);
    return next;
  }

  if (mutation.entity === "item") {
    if (mutation.action === "create") {
      const row = optimisticItem(mutation, nowIso);
      if (row && !next.items.some((item) => item.id === row.id)) next.items.push(row);
    } else if (mutation.action === "update" && mutation.id) {
      next.items = next.items.map((item) =>
        item.id === mutation.id
          ? bumped(item, data as Partial<Item>, nowIso)
          : item,
      );
    } else if (mutation.action === "status" && mutation.id) {
      const status = String(data.status || "planned") as Item["status"];
      if (status === "active") {
        next.items = next.items.map((item) => {
          if (item.id !== mutation.id && item.status === "active")
            return bumped(
              item,
              { status: "done", completed_at: nowIso } as Partial<Item>,
              nowIso,
            );
          return item;
        });
        if (next.trip.status !== "traveling")
          next.trip = bumped(
            next.trip,
            { status: "traveling" } as Partial<typeof next.trip>,
            nowIso,
          );
      }
      next.items = next.items.map((item) => {
        if (item.id !== mutation.id) return item;
        return bumped(
          item,
          {
            status,
            checked_in_at:
              status === "active"
                ? nowIso
                : status === "planned"
                  ? null
                  : item.checked_in_at,
            completed_at: status === "done" ? nowIso : null,
          } as Partial<Item>,
          nowIso,
        );
      });
    } else if (mutation.action === "delete" && mutation.id) {
      next.items = next.items.filter((item) => item.id !== mutation.id);
      next.budgets = next.budgets.map((budget) =>
        budget.item_id === mutation.id
          ? bumped(budget, { item_id: null } as Partial<Budget>, nowIso)
          : budget,
      );
      next.media = next.media.map((media) =>
        media.item_id === mutation.id
          ? bumped(media, { item_id: null } as Partial<Media>, nowIso)
          : media,
      );
    }
    return next;
  }

  if (mutation.entity === "budget") {
    if (mutation.action === "create") {
      const row = optimisticBudget(mutation, nowIso);
      if (row && !next.budgets.some((budget) => budget.id === row.id))
        next.budgets.push(row);
    } else if (mutation.action === "update" && mutation.id) {
      next.budgets = next.budgets.map((budget) => {
        if (budget.id !== mutation.id) return budget;
        const quantity = Number(data.quantity ?? budget.quantity);
        const unitPrice = Number(data.unit_price ?? budget.unit_price);
        return bumped(
          budget,
          {
            ...(data as Partial<Budget>),
            quantity,
            unit_price: unitPrice,
            amount: Math.round(quantity * unitPrice),
            item_id: data.item_id ? String(data.item_id) : null,
          },
          nowIso,
        );
      });
      const category = String(data.category || "");
      if (category)
        next.expenses = next.expenses.map((expense) =>
          expense.budget_id === mutation.id
            ? bumped(expense, { category } as Partial<Expense>, nowIso)
            : expense,
        );
    } else if (mutation.action === "delete" && mutation.id) {
      next.budgets = next.budgets.filter((budget) => budget.id !== mutation.id);
      next.expenses = next.expenses.map((expense) =>
        expense.budget_id === mutation.id
          ? bumped(expense, { budget_id: null } as Partial<Expense>, nowIso)
          : expense,
      );
    }
    return next;
  }

  if (mutation.entity === "expense") {
    if (mutation.action === "create") {
      const row = optimisticExpense(mutation, nowIso);
      if (row && !next.expenses.some((expense) => expense.id === row.id))
        next.expenses.push(row);
    } else if (mutation.action === "update" && mutation.id) {
      next.expenses = next.expenses.map((expense) =>
        expense.id === mutation.id
          ? bumped(
              expense,
              {
                ...(data as Partial<Expense>),
                budget_id: data.budget_id ? String(data.budget_id) : null,
                refund_of: data.refund_of ? String(data.refund_of) : null,
              },
              nowIso,
            )
          : expense,
      );
    } else if (mutation.action === "delete" && mutation.id) {
      next.expenses = next.expenses.filter((expense) => expense.id !== mutation.id);
    }
    return next;
  }

  if (mutation.entity === "media") {
    if (mutation.action === "create") {
      const row = optimisticMedia(mutation, nowIso);
      if (row && !next.media.some((media) => media.id === row.id)) next.media.push(row);
    } else if (mutation.action === "update" && mutation.id) {
      next.media = next.media.map((media) =>
        media.id === mutation.id
          ? bumped(
              media,
              {
                ...(data as Partial<Media>),
                item_id: data.item_id ? String(data.item_id) : null,
              },
              nowIso,
            )
          : media,
      );
    } else if (mutation.action === "delete" && mutation.id) {
      next.media = next.media.filter((media) => media.id !== mutation.id);
    }
    return next;
  }

  if (mutation.entity === "participant") {
    if (mutation.action === "create") {
      const row = optimisticParticipant(mutation, nowIso);
      if (row && !next.participants.some((person) => person.id === row.id))
        next.participants.push(row);
    } else if (mutation.action === "update" && mutation.id) {
      next.participants = next.participants.map((person) =>
        person.id === mutation.id
          ? bumped(person, data as Partial<Participant>, nowIso)
          : person,
      );
    } else if (mutation.action === "delete" && mutation.id) {
      next.participants = next.participants.filter((person) => person.id !== mutation.id);
    }
  }
  return next;
}

export function overlayQueuedMutations(
  bundle: Bundle,
  queueRows: QueuedMutation[],
  nowIso = new Date().toISOString(),
) {
  return queueRows
    .filter(
      (row) =>
        row.tripId === bundle.trip.id &&
        (row.state === "pending" || row.state === "sending"),
    )
    .sort(compareQueuedMutations)
    .reduce(
      (current, row) => applyOptimisticMutation(current, row.mutation, row.updatedAt || nowIso),
      bundle,
    );
}

export function applyOptimisticTripList(
  list: TripListResponse,
  mutation: Mutation,
  nowIso = new Date().toISOString(),
): TripListResponse {
  if (mutation.entity !== "trip" || mutation.action !== "update") return list;
  return {
    ...list,
    trips: list.trips.map((trip) =>
      trip.id === mutation.tripId
        ? bumped(trip, (mutation.data || {}) as Partial<typeof trip>, nowIso)
        : trip,
    ),
  };
}

export function overlayQueuedTripList(
  list: TripListResponse,
  queueRows: QueuedMutation[],
) {
  return queueRows
    .filter(
      (row) =>
        (row.state === "pending" || row.state === "sending") &&
        row.mutation.entity === "trip" &&
        row.mutation.action === "update",
    )
    .sort(compareQueuedMutations)
    .reduce(
      (current, row) =>
        applyOptimisticTripList(current, row.mutation, row.updatedAt),
      list,
    );
}

export function currentVersionForMutation(bundle: Bundle, mutation: Mutation) {
  if (mutation.entity === "trip") return bundle.trip.version;
  const id = mutation.id;
  if (!id) return undefined;
  if (mutation.entity === "item") return bundle.items.find((x) => x.id === id)?.version;
  if (mutation.entity === "budget") return bundle.budgets.find((x) => x.id === id)?.version;
  if (mutation.entity === "expense") return bundle.expenses.find((x) => x.id === id)?.version;
  if (mutation.entity === "media") return bundle.media.find((x) => x.id === id)?.version;
  if (mutation.entity === "participant")
    return bundle.participants.find((x) => x.id === id)?.version;
  return undefined;
}
