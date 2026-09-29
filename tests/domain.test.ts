import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDate,
  utcTime,
  localTime,
  compare,
  live,
  csv,
  buildFinanceReport,
  financeJson,
  buildTripAnalytics,
  postTripCsv,
  postTripJson,
  postTripHtml,
  buildTripStory,
  mediaPreviewUrl,
  dateLabel,
} from "../lib/domain";
import { mutationSchema } from "../lib/validation";
import type { Budget, Expense, Item, Bundle } from "../lib/types";
test("dates and timezones stay consistent", () => {
  assert.equal(parseDate("25/09/2026"), "2026-09-25");
  assert.throws(() => parseDate("31/02/2026"));
  assert.equal(
    utcTime("2026-09-25T10:30", "Asia/Ho_Chi_Minh"),
    "2026-09-25T03:30:00.000Z",
  );
  assert.equal(
    localTime("2026-09-25T03:30:00.000Z", "Asia/Tokyo"),
    "2026-09-25T12:30",
  );
  assert.throws(() => utcTime("2026-03-08T02:30", "America/New_York"));
});
test("financial totals account for refunds and unlinked expenses", () => {
  const r = compare([{ amount: 1000000, category: "Lưu trú" } as Budget], [
    { amount: 300000, kind: "payment", category: "Lưu trú", budget_id: "b" },
    { amount: 800000, kind: "payment", category: "Lưu trú", budget_id: null },
    { amount: 100000, kind: "refund", category: "Lưu trú", budget_id: "b" },
  ] as Expense[]);
  assert.equal(r.actual, 1000000);
  assert.equal(r.remaining, 0);
  assert.equal(r.unlinked, 800000);
});
test("actual check-in remains distinct from planned current activity", () => {
  const r = live(
    [
      {
        id: "1",
        status: "active",
        start_at: "2026-09-25T01:00:00Z",
        end_at: "2026-09-25T02:00:00Z",
      },
      {
        id: "2",
        status: "planned",
        start_at: "2026-09-25T03:00:00Z",
        end_at: "2026-09-25T04:00:00Z",
      },
    ] as Item[],
    "2026-09-25T03:30:00Z",
  );
  assert.equal(r.active?.id, "1");
  assert.equal(r.scheduled[0].id, "2");
});
test("request validation blocks unsafe links", () => {
  const base = {
    operationId: crypto.randomUUID(),
    tripId: crypto.randomUUID(),
    entity: "media",
    action: "create",
    data: {
      title: "Test",
      kind: "album",
      url: "javascript:alert(1)",
      note: "",
    },
  };
  assert.equal(mutationSchema.safeParse(base).success, false);
});
test("CSV neutralizes formula injection", () => {
  const data = {
    trip: { name: "=BAD()" },
    budgets: [],
    expenses: [],
  } as unknown as Bundle;
  assert.match(csv(data), /"'=BAD\(\)"/);
});

test("finance report preserves original baseline and groups by day/activity", () => {
  const bundle = {
    trip: { id: "t", name: "Đà Lạt", destination: "", start_date: "2026-09-25", end_date: "2026-09-27", timezone: "Asia/Ho_Chi_Minh" },
    items: [{ id: "i1", title: "Khách sạn" }],
    budgets: [
      { id: "b1", amount: 1200000, category: "Lưu trú", item_id: "i1" },
    ],
    expenses: [
      { id: "e1", amount: 900000, kind: "payment", category: "Lưu trú", budget_id: "b1", refund_of: null, spent_on: "2026-09-25" },
      { id: "e2", amount: 100000, kind: "refund", category: "Lưu trú", budget_id: "b1", refund_of: "e1", spent_on: "2026-09-26" },
    ],
    snapshots: [
      { id: "s1", snapshot_no: 1, snapshot_kind: "baseline", created_at: "2026-09-24T00:00:00Z", data: [{ id: "b1", amount: 1000000, category: "Lưu trú" }] },
    ],
  } as unknown as Bundle;
  const report = buildFinanceReport(bundle);
  assert.equal(report.totals.original_budget, 1000000);
  assert.equal(report.totals.current_budget, 1200000);
  assert.equal(report.totals.net_actual, 800000);
  assert.equal(report.categories.find((x) => x.category === "Lưu trú")?.variance, 400000);
  assert.equal(report.days.length, 2);
  assert.equal(report.activities[0].actual, 800000);
  assert.equal(report.integrity.status, "ok");
  assert.match(financeJson(bundle), /"original_budget": 1000000/);
});


test("live trip derives Current/Next/Late and delay minutes", () => {
  const r = live(
    [
      {
        id: "active",
        status: "active",
        start_at: "2026-09-25T01:00:00Z",
        end_at: "2026-09-25T02:00:00Z",
      },
      {
        id: "late",
        status: "planned",
        start_at: "2026-09-25T02:10:00Z",
        end_at: "2026-09-25T02:30:00Z",
      },
      {
        id: "next",
        status: "planned",
        start_at: "2026-09-25T04:00:00Z",
        end_at: "2026-09-25T05:00:00Z",
      },
    ] as Item[],
    "2026-09-25T03:00:00Z",
  );
  assert.equal(r.current?.id, "active");
  assert.equal(r.activeLateMinutes, 60);
  assert.equal(r.late[0]?.id, "late");
  assert.equal(r.lateMinutes[0]?.minutes, 30);
  assert.equal(r.next?.id, "next");
  assert.equal(r.nextInMinutes, 60);
});


test("trip analytics summarizes itinerary, finance, media and post-trip exports", () => {
  const bundle = {
    trip: {
      id: "t",
      name: "=Đà Lạt",
      destination: "Đà Lạt",
      start_date: "2026-09-25",
      end_date: "2026-09-27",
      timezone: "Asia/Ho_Chi_Minh",
      people: 2,
      status: "completed",
    },
    role: "owner",
    items: [
      {
        id: "i1",
        title: "Nhận phòng <script>",
        status: "done",
        start_at: "2026-09-25T01:00:00Z",
        end_at: "2026-09-25T02:00:00Z",
        checked_in_at: "2026-09-25T01:10:00Z",
        completed_at: "2026-09-25T02:05:00Z",
      },
      {
        id: "i2",
        title: "Ăn tối",
        status: "skipped",
        start_at: "2026-09-26T11:00:00Z",
        end_at: "2026-09-26T12:00:00Z",
        checked_in_at: null,
        completed_at: null,
      },
    ],
    budgets: [
      { id: "b1", amount: 1000000, category: "Lưu trú", item_id: "i1" },
    ],
    expenses: [
      { id: "e1", title: "KS", amount: 800000, kind: "payment", category: "Lưu trú", budget_id: "b1", refund_of: null, spent_on: "2026-09-25" },
    ],
    snapshots: [
      { id: "s1", snapshot_no: 1, snapshot_kind: "baseline", created_at: "2026-09-24T00:00:00Z", data: [{ id: "b1", amount: 1000000, category: "Lưu trú" }] },
    ],
    media: [{ id: "m1", kind: "album", item_id: "i1" }],
    participants: [],
    members: [],
    invitations: [],
    audits: [],
  } as unknown as Bundle;
  const analytics = buildTripAnalytics(bundle);
  assert.equal(analytics.report_state, "post_trip");
  assert.equal(analytics.trip_days, 3);
  assert.equal(analytics.itinerary.completion_rate, 50);
  assert.equal(analytics.itinerary.processed_rate, 100);
  assert.equal(analytics.itinerary.late_checkins, 1);
  assert.equal(analytics.itinerary.average_checkin_delay_minutes, 10);
  assert.equal(analytics.finance.net_actual, 800000);
  assert.equal(analytics.finance.per_person, 400000);
  assert.equal(analytics.media.total, 1);
  assert.equal(analytics.readiness, "ready");
  assert.match(postTripCsv(bundle), /"'=Đà Lạt"/);
  assert.match(postTripJson(bundle), /"format": "tripflow-post-trip-report"/);
  const html = postTripHtml(bundle);
  assert.match(html, /Nhận phòng &lt;script&gt;/);
  assert.doesNotMatch(html, /Nhận phòng <script>/);
});


test("V1.3 trip story groups memories, cover and highlights", () => {
  const bundle = {
    trip: { id: "t", name: "Đà Lạt", destination: "Đà Lạt", start_date: "2026-09-25", end_date: "2026-09-27", timezone: "Asia/Ho_Chi_Minh", people: 2, status: "completed" },
    items: [
      { id: "i1", title: "Hồ Xuân Hương", location: "Đà Lạt", start_at: "2026-09-25T02:00:00Z", end_at: "2026-09-25T03:00:00Z", status: "done" },
    ],
    media: [
      { id: "m1", title: "Bình minh", kind: "photo", url: "https://example.com/a.jpg", item_id: "i1", note: "Khoảnh khắc đầu ngày", created_at: "2026-09-25T03:00:00Z", taken_on: "2026-09-25", is_highlight: true, is_cover: true, story_order: 2 },
      { id: "m2", title: "Album", kind: "album", url: "https://drive.google.com/drive/folders/x", item_id: "i1", note: "", created_at: "2026-09-25T04:00:00Z", taken_on: null, is_highlight: false, is_cover: false, story_order: 3 },
    ],
    budgets: [], expenses: [], snapshots: [], participants: [], members: [], invitations: [], audits: [], role: "owner",
  } as unknown as Bundle;
  const story = buildTripStory(bundle);
  assert.equal(story.cover?.id, "m1");
  assert.equal(story.highlights.length, 1);
  assert.equal(story.memory_days, 1);
  assert.equal(story.days[0].media.length, 2);
  assert.equal(mediaPreviewUrl(bundle.media[0]), "https://example.com/a.jpg");
  assert.match(postTripJson(bundle), /"story"/);
  assert.match(postTripHtml(bundle), /Câu chuyện chuyến đi/);
});

test("V1.4 optional end date/time remains valid and open-ended itinerary is not late", () => {
  assert.equal(dateLabel(null), "Chưa đặt");
  assert.equal(localTime(null, "Asia/Ho_Chi_Minh"), "");

  const tripMutation = {
    operationId: crypto.randomUUID(),
    tripId: crypto.randomUUID(),
    entity: "trip",
    action: "create",
    data: {
      name: "Chuyến chưa chốt ngày về",
      destination: "Đà Lạt",
      start_date: "2026-10-01",
      end_date: null,
      timezone: "Asia/Ho_Chi_Minh",
      people: 2,
      status: "planning",
      note: "",
    },
  };
  assert.equal(mutationSchema.safeParse(tripMutation).success, true);

  const itemMutation = {
    operationId: crypto.randomUUID(),
    tripId: crypto.randomUUID(),
    id: crypto.randomUUID(),
    entity: "item",
    action: "create",
    data: {
      title: "Tự do khám phá",
      location: "",
      start_at: "2026-10-01T02:00:00.000Z",
      end_at: null,
      map_url: "",
      note: "",
    },
  };
  assert.equal(mutationSchema.safeParse(itemMutation).success, true);

  const state = live(
    [
      {
        id: "open-ended",
        status: "planned",
        start_at: "2026-10-01T02:00:00.000Z",
        end_at: null,
      },
    ] as Item[],
    "2026-10-01T03:00:00.000Z",
  );
  assert.equal(state.current?.id, "open-ended");
  assert.equal(state.late.length, 0);
});
