import { CATEGORIES, type Budget, type Expense, type Participant } from "./types";
import { inferExpenseCategory } from "./expense-intelligence";

export type QuickEntryContext = {
  baseDay: string; // YYYY-MM-DD in trip timezone
  nowLocal: string; // YYYY-MM-DDTHH:mm in trip timezone
  participants?: Participant[];
  budgets?: Budget[];
  expenseHistory?: Expense[];
  defaultPayer?: string;
  defaultBudgetId?: string;
  forcedPayerId?: string;
  forcedBudgetId?: string;
};

type MatchState = "exact" | "fuzzy" | "default" | "none" | "ambiguous";

export type QuickMatchOption = {
  id: string;
  label: string;
  score: number;
};

export type QuickContextMatch = {
  state: MatchState;
  score: number;
  options: QuickMatchOption[];
};

export type QuickExpensePreview = {
  kind: "expense";
  title: string;
  amount: number;
  transaction_kind: "payment";
  category: (typeof CATEGORIES)[number];
  spent_on: string;
  time_hint: string | null;
  payer: string;
  payer_id: string | null;
  payer_match: QuickContextMatch;
  budget_id: string;
  budget_title: string;
  budget_match: QuickContextMatch;
  confidence: number;
  valid: boolean;
  error?: string;
};

export type QuickItemPreview = {
  kind: "item";
  title: string;
  start_local: string;
  location: string;
  valid: boolean;
  error?: string;
};

export type QuickEntryPreview = QuickExpensePreview | QuickItemPreview;

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const words = (value: string) =>
  fold(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const normalizedText = (value: string) => words(value).join(" ");
const compactText = (value: string) => words(value).join("");
const pad2 = (n: number) => String(n).padStart(2, "0");

function addDays(day: string, amount: number) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + amount));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function parseDateToken(text: string, baseDay: string) {
  const raw = fold(text);
  if (/\b(hom qua|yesterday)\b/.test(raw)) return { day: addDays(baseDay, -1), token: /\b(hôm qua|hom qua|yesterday)\b/i };
  if (/\b(ngay mai|mai)\b/.test(raw)) return { day: addDays(baseDay, 1), token: /\b(ngày mai|ngay mai|mai)\b/i };
  if (/\b(hom nay|today)\b/.test(raw)) return { day: baseDay, token: /\b(hôm nay|hom nay|today)\b/i };
  const match = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!match) return { day: baseDay, token: null as RegExp | null };
  const [baseYear] = baseDay.split("-").map(Number);
  let year = match[3] ? Number(match[3]) : baseYear;
  if (year < 100) year += 2000;
  const month = Number(match[2]);
  const day = Number(match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return { day: baseDay, token: null as RegExp | null };
  return {
    day: `${year}-${pad2(month)}-${pad2(day)}`,
    token: new RegExp(`\\b${match[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  };
}

function parseTimeToken(text: string, nowLocal: string) {
  const colon = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colon) return { time: `${pad2(Number(colon[1]))}:${colon[2]}`, token: colon[0] };
  const hour = text.match(/\b([01]?\d|2[0-3])\s*h(?:\s*([0-5]\d))?\b/i);
  if (hour) return { time: `${pad2(Number(hour[1]))}:${pad2(Number(hour[2] || 0))}`, token: hour[0] };
  return { time: nowLocal.slice(11, 16), token: null as string | null };
}

export function parseCompactMoney(input: string): { amount: number; token: string } | null {
  const text = input.replace(/\s+/g, " ");

  const compactMillion = text.match(/\b(\d{1,6})\s*(tr|m)(\d{1,3})\b/i);
  if (compactMillion) {
    const whole = Number(compactMillion[1]);
    const tailRaw = compactMillion[3];
    const tail = Number(tailRaw) / Math.pow(10, tailRaw.length);
    return { amount: Math.round((whole + tail) * 1_000_000), token: compactMillion[0] };
  }

  const million = text.match(/\b(\d+(?:[.,]\d+)?)\s*(tr|triệu|trieu|m)\b/i);
  if (million) {
    const n = Number(million[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return { amount: Math.round(n * 1_000_000), token: million[0] };
  }

  const thousand = text.match(/\b(\d+(?:[.,]\d+)?)\s*(k|nghìn|nghin)\b/i);
  if (thousand) {
    const n = Number(thousand[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return { amount: Math.round(n * 1_000), token: thousand[0] };
  }

  const plain = input.match(/\b\d{1,3}(?:[.]\d{3})+\b|\b\d{4,12}\b/);
  if (plain) {
    const amount = Number(plain[0].replace(/\./g, ""));
    if (Number.isFinite(amount) && amount > 0) return { amount, token: plain[0] };
  }
  return null;
}

function inferCategory(title: string, history: Expense[] = []): (typeof CATEGORIES)[number] {
  return inferExpenseCategory(title, history);
}

function cleanTitle(raw: string, tokens: Array<string | RegExp | null>) {
  let result = raw;
  for (const token of tokens) {
    if (!token) continue;
    result = typeof token === "string" ? result.replace(token, " ") : result.replace(token, " ");
  }
  result = result
    .replace(/^\s*(chi|expense|spend|hd|lich|lịch|hoat dong|hoạt động|activity)\s*[:\-]?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
    .trim();
  return result;
}

function stripWords(input: string, targetWords: string[]) {
  if (!targetWords.length) return input;
  const counts = new Map<string, number>();
  for (const word of targetWords) counts.set(word, (counts.get(word) || 0) + 1);
  return input
    .split(/(\s+)/)
    .filter((part) => {
      if (/^\s+$/.test(part)) return true;
      const token = words(part)[0] || "";
      const remaining = counts.get(token) || 0;
      if (!remaining) return true;
      counts.set(token, remaining - 1);
      return false;
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function phraseContained(input: string, candidate: string) {
  if (!candidate) return false;
  const source = ` ${normalizedText(input)} `;
  return source.includes(` ${candidate} `);
}

function participantScore(input: string, participant: Participant) {
  const inputNorm = normalizedText(input);
  const candidate = normalizedText(participant.name);
  const candidateCompact = compactText(participant.name);
  if (!candidate) return { score: 0, matchedWords: [] as string[] };
  if (phraseContained(input, candidate)) return { score: 1, matchedWords: words(participant.name) };
  if (candidateCompact.length >= 4 && compactText(input).includes(candidateCompact)) {
    const sourceTokens = words(input);
    return {
      score: 0.98,
      matchedWords: sourceTokens.includes(candidateCompact) ? [candidateCompact] : words(participant.name),
    };
  }

  const sourceTokens = words(input);
  const candidateWords = words(participant.name);
  for (const token of sourceTokens) {
    if (token.length < 3) continue;
    if (candidateCompact.includes(token) || token.includes(candidateCompact))
      return { score: 0.82, matchedWords: [token] };
    if (token.length >= 5 && candidateWords.length >= 2) {
      const embedded = candidateWords.filter((word) => word.length >= 2 && token.includes(word));
      if (embedded.length >= 2) return { score: 0.82, matchedWords: [token] };
    }
  }

  const sourceWords = new Set(sourceTokens);
  const overlap = candidateWords.filter((word) => sourceWords.has(word));
  if (!overlap.length) return { score: 0, matchedWords: [] as string[] };
  const coverage = overlap.length / Math.max(1, candidateWords.length);
  const score = coverage >= 1 ? 0.92 : coverage >= 0.67 && overlap.length >= 2 ? 0.78 : 0;
  return { score, matchedWords: overlap };
}

function resolveParticipant(input: string, context: QuickEntryContext) {
  const participants = context.participants || [];
  const forced = context.forcedPayerId ? participants.find((row) => row.id === context.forcedPayerId) : null;
  if (forced) {
    const forcedScore = participantScore(input, forced);
    return {
      participant: forced,
      match: { state: "exact", score: 1, options: [] } as QuickContextMatch,
      matchedWords: forcedScore.matchedWords,
    };
  }
  const ranked = participants
    .map((row) => ({ row, ...participantScore(input, row) }))
    .filter((row) => row.score >= 0.7)
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name, "vi"));
  const top = ranked[0];
  const second = ranked[1];
  if (top && second && second.score >= 0.76 && top.score - second.score < 0.08) {
    return {
      participant: null,
      match: {
        state: "ambiguous",
        score: top.score,
        options: ranked.slice(0, 3).map((x) => ({ id: x.row.id, label: x.row.name, score: x.score })),
      } as QuickContextMatch,
      matchedWords: [] as string[],
    };
  }
  if (top) {
    return {
      participant: top.row,
      match: { state: top.score >= 0.95 ? "exact" : "fuzzy", score: top.score, options: [] } as QuickContextMatch,
      matchedWords: top.matchedWords,
    };
  }
  const fallback = context.defaultPayer?.trim();
  const fallbackParticipant = fallback
    ? participants.find((row) => normalizedText(row.name) === normalizedText(fallback)) || null
    : null;
  return {
    participant: fallbackParticipant,
    match: {
      state: fallbackParticipant ? "default" : "none",
      score: fallbackParticipant ? 0.55 : 0,
      options: [],
    } as QuickContextMatch,
    matchedWords: [] as string[],
  };
}

const BUDGET_PREFIXES = [
  "du toan",
  "khoan du toan",
  "chi phi",
  "tien",
  "ve",
  ...CATEGORIES.map((category) => normalizedText(category)),
].sort((a, b) => b.length - a.length);

function budgetVariants(budget: Budget) {
  const base = normalizedText(budget.title);
  const variants = new Set<string>([base]);
  for (const prefix of BUDGET_PREFIXES) {
    if (base.startsWith(`${prefix} `)) variants.add(base.slice(prefix.length + 1).trim());
  }
  const category = normalizedText(budget.category || "");
  if (category && base.startsWith(`${category} `)) variants.add(base.slice(category.length + 1).trim());
  return [...variants].filter(Boolean);
}

function budgetScore(input: string, budget: Budget) {
  const sourceWords = words(input);
  const sourceSet = new Set(sourceWords);
  let best = { score: 0, matchedWords: [] as string[] };
  for (const variant of budgetVariants(budget)) {
    const candidateWords = variant.split(" ").filter(Boolean);
    if (!candidateWords.length) continue;
    if (phraseContained(input, variant)) {
      const exactScore = candidateWords.length >= 2 ? 1 : 0.95;
      if (exactScore > best.score) best = { score: exactScore, matchedWords: candidateWords };
      continue;
    }
    const overlap = candidateWords.filter((word) => sourceSet.has(word));
    if (!overlap.length) continue;
    const coverage = overlap.length / candidateWords.length;
    const orderedBonus = overlap.length >= 2 && sourceWords.join(" ").includes(overlap.join(" ")) ? 0.05 : 0;
    const score = Math.min(0.94, coverage * 0.88 + orderedBonus);
    if ((overlap.length >= 2 || (candidateWords.length === 1 && coverage === 1)) && score > best.score)
      best = { score, matchedWords: overlap };
  }
  return best;
}

function resolveBudget(input: string, context: QuickEntryContext) {
  const budgets = context.budgets || [];
  const forced = context.forcedBudgetId ? budgets.find((row) => row.id === context.forcedBudgetId) : null;
  if (forced) {
    const forcedScore = budgetScore(input, forced);
    return {
      budget: forced,
      match: { state: "exact", score: 1, options: [] } as QuickContextMatch,
      matchedWords: forcedScore.matchedWords,
    };
  }
  const ranked = budgets
    .map((row) => ({ row, ...budgetScore(input, row) }))
    .filter((row) => row.score >= 0.7)
    .sort((a, b) => b.score - a.score || a.row.title.localeCompare(b.row.title, "vi"));
  const top = ranked[0];
  const second = ranked[1];
  if (top && second && second.score >= 0.8 && top.score - second.score < 0.08) {
    return {
      budget: null,
      match: {
        state: "ambiguous",
        score: top.score,
        options: ranked.slice(0, 3).map((x) => ({ id: x.row.id, label: x.row.title, score: x.score })),
      } as QuickContextMatch,
      matchedWords: [] as string[],
    };
  }
  if (top) {
    return {
      budget: top.row,
      match: { state: top.score >= 0.95 ? "exact" : "fuzzy", score: top.score, options: [] } as QuickContextMatch,
      matchedWords: top.matchedWords,
    };
  }
  const fallback = context.defaultBudgetId ? budgets.find((row) => row.id === context.defaultBudgetId) || null : null;
  return {
    budget: fallback,
    match: {
      state: fallback ? "default" : "none",
      score: fallback ? 0.5 : 0,
      options: [],
    } as QuickContextMatch,
    matchedWords: [] as string[],
  };
}

function confidenceScore(parts: Array<{ state: MatchState; score: number }>) {
  const meaningful = parts.filter((row) => row.state !== "none");
  if (!meaningful.length) return 70;
  const average = meaningful.reduce((sum, row) => sum + row.score, 0) / meaningful.length;
  return Math.max(0, Math.min(100, Math.round(average * 100)));
}

export function parseQuickEntry(input: string, context: QuickEntryContext): QuickEntryPreview | null {
  const raw = input.trim();
  if (!raw) return null;
  const folded = fold(raw);
  const explicitItem = /^\s*(hd|lich|hoat dong|activity)\b/.test(folded);
  const explicitExpense = /^\s*(chi|expense|spend)\b/.test(folded);
  const money = parseCompactMoney(raw);
  const dateInfo = parseDateToken(raw, context.baseDay);
  const timeInfo = parseTimeToken(raw, context.nowLocal);

  if (explicitExpense || (money && !explicitItem)) {
    let working = cleanTitle(raw, [money?.token || null, dateInfo.token, timeInfo.token]);
    const payerResult = resolveParticipant(working, context);
    if (payerResult.participant && payerResult.matchedWords.length)
      working = stripWords(working, payerResult.matchedWords);

    const budgetResult = resolveBudget(working, context);
    if (budgetResult.budget && budgetResult.matchedWords.length)
      working = stripWords(working, budgetResult.matchedWords);

    const title = cleanTitle(working, []);
    const category = budgetResult.budget && (CATEGORIES as readonly string[]).includes(budgetResult.budget.category)
      ? (budgetResult.budget.category as (typeof CATEGORIES)[number])
      : inferCategory(title, context.expenseHistory || []);
    const ambiguous = payerResult.match.state === "ambiguous" || budgetResult.match.state === "ambiguous";
    const confidence = confidenceScore([payerResult.match, budgetResult.match]);

    if (!money)
      return {
        kind: "expense",
        title: title || "Khoản chi mới",
        amount: 0,
        transaction_kind: "payment",
        category,
        spent_on: dateInfo.day,
        time_hint: timeInfo.token ? timeInfo.time : null,
        payer: payerResult.participant?.name || "",
        payer_id: payerResult.participant?.id || null,
        payer_match: payerResult.match,
        budget_id: budgetResult.budget?.id || "",
        budget_title: budgetResult.budget?.title || "",
        budget_match: budgetResult.match,
        confidence,
        valid: false,
        error: "Chưa nhận được số tiền. Ví dụ: chi 150k ăn trưa Viện Hải Dương Học HuyVo",
      };

    return {
      kind: "expense",
      title: title || "Khoản chi nhanh",
      amount: money.amount,
      transaction_kind: "payment",
      category,
      spent_on: dateInfo.day,
      time_hint: timeInfo.token ? timeInfo.time : null,
      payer: payerResult.participant?.name || "",
      payer_id: payerResult.participant?.id || null,
      payer_match: payerResult.match,
      budget_id: budgetResult.budget?.id || "",
      budget_title: budgetResult.budget?.title || "",
      budget_match: budgetResult.match,
      confidence,
      valid: Boolean(title && money.amount > 0 && !ambiguous),
      error: ambiguous
        ? "Có nhiều dữ liệu gần giống. Hãy chọn đúng người thanh toán/khoản dự toán ngay bên dưới."
        : title
          ? undefined
          : "Vui lòng nhập nội dung khoản chi.",
    };
  }

  const title = cleanTitle(raw, [dateInfo.token, timeInfo.token]);
  return {
    kind: "item",
    title: title || "Hoạt động mới",
    start_local: `${dateInfo.day}T${timeInfo.time}`,
    location: "",
    valid: Boolean(title),
    error: title ? undefined : "Vui lòng nhập tên hoạt động.",
  };
}
