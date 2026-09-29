import { CATEGORIES } from "./types";
import { inferExpenseCategory } from "./expense-intelligence";

export type QuickEntryContext = {
  baseDay: string; // YYYY-MM-DD in trip timezone
  nowLocal: string; // YYYY-MM-DDTHH:mm in trip timezone
};

export type QuickExpensePreview = {
  kind: "expense";
  title: string;
  amount: number;
  category: (typeof CATEGORIES)[number];
  spent_on: string;
  time_hint: string | null;
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

const pad2 = (n: number) => String(n).padStart(2, "0");

function addDays(day: string, amount: number) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + amount));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function parseDateToken(text: string, baseDay: string) {
  const raw = fold(text);
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

  // 1tr2 / 1m25 / 2tr250 -> 1.2m / 1.25m / 2.25m
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

  // 120.000 / 1.250.000 / 120000
  const plain = input.match(/\b\d{1,3}(?:[.]\d{3})+\b|\b\d{4,12}\b/);
  if (plain) {
    const amount = Number(plain[0].replace(/\./g, ""));
    if (Number.isFinite(amount) && amount > 0) return { amount, token: plain[0] };
  }
  return null;
}

function inferCategory(title: string): (typeof CATEGORIES)[number] {
  return inferExpenseCategory(title);
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
    const title = cleanTitle(raw, [money?.token || null, dateInfo.token, timeInfo.token]);
    if (!money)
      return {
        kind: "expense",
        title: title || "Khoản chi mới",
        amount: 0,
        category: inferCategory(title),
        spent_on: dateInfo.day,
        time_hint: timeInfo.token ? timeInfo.time : null,
        valid: false,
        error: "Chưa nhận được số tiền. Ví dụ: chi Taxi sân bay 350k",
      };
    return {
      kind: "expense",
      title: title || "Khoản chi nhanh",
      amount: money.amount,
      category: inferCategory(title),
      spent_on: dateInfo.day,
      time_hint: timeInfo.token ? timeInfo.time : null,
      valid: Boolean(title && money.amount > 0),
      error: title ? undefined : "Vui lòng nhập nội dung khoản chi.",
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
