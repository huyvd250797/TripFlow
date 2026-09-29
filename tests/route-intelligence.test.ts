import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRouteDay, buildDirectionsUrl, coordinateMapUrl, extractMapCoordinate } from "../lib/route-intelligence";
import type { Item } from "../lib/types";

const item = (id: string, title: string, start: string, end: string | null, map_url: string): Item => ({
  id,
  version: 1,
  created_at: start,
  updated_at: start,
  trip_id: "00000000-0000-0000-0000-000000000001",
  title,
  location: title,
  start_at: start,
  end_at: end,
  status: "planned",
  map_url,
  note: "",
  checked_in_at: null,
  completed_at: null,
});

test("extractMapCoordinate accepts common Google Maps coordinate URLs", () => {
  assert.deepEqual(
    extractMapCoordinate("https://www.google.com/maps/search/?api=1&query=10.7769,106.7009"),
    { lat: 10.7769, lng: 106.7009 },
  );
  assert.deepEqual(
    extractMapCoordinate("https://www.google.com/maps/@10.77,106.69,15z"),
    { lat: 10.77, lng: 106.69 },
  );
});

test("extractMapCoordinate accepts escaped/canonical Google Maps payloads", () => {
  assert.deepEqual(
    extractMapCoordinate('https:\\/\\/www.google.com\\/maps\\/place\\/Foo\\/@10.7769,106.7009,17z'),
    { lat: 10.7769, lng: 106.7009 },
  );
  assert.deepEqual(
    extractMapCoordinate('https://www.google.com/maps/place/Foo/data=!4m2!3d10.8231!4d106.6297'),
    { lat: 10.8231, lng: 106.6297 },
  );
  assert.deepEqual(
    extractMapCoordinate('https://www.google.com/maps/place/La+Vague/@-77.844326,39.0267995,3z/data=!4m2!3d12.2200647!4d109.2036555'),
    { lat: 12.2200647, lng: 109.2036555 },
  );
  assert.equal(
    extractMapCoordinate('<script>window.telemetry={lat:-77.844326,lng:39.0267995}</script>'),
    null,
  );
  assert.equal(
    coordinateMapUrl({ lat: 10.77690001, lng: 106.70090001 }),
    "https://www.google.com/maps/search/?api=1&query=10.7769,106.7009",
  );
});


test("route analysis flags an unrealistically tight transfer", () => {
  const rows = [
    item("a", "Điểm A", "2026-10-09T01:00:00.000Z", "2026-10-09T02:00:00.000Z", "https://www.google.com/maps/search/?api=1&query=10.7769,106.7009"),
    item("b", "Điểm B", "2026-10-09T02:05:00.000Z", null, "https://www.google.com/maps/search/?api=1&query=10.8231,106.6297"),
  ];
  const result = analyzeRouteDay(rows, "UTC", "2026-10-09");
  assert.equal(result.items.length, 2);
  assert.equal(result.mappedItems, 2);
  assert.equal(result.legs.length, 1);
  assert.equal(result.legs[0]?.level, "tight");
  assert.ok(result.totalDistanceKm > 0);
  assert.ok(result.warnings.length > 0);
});

test("directions URL can use place names even when coordinates are missing", () => {
  const rows = [
    item("a", "A", "2026-10-09T01:00:00.000Z", null, ""),
    item("b", "B", "2026-10-09T02:00:00.000Z", null, ""),
  ];
  rows[0].location = "Chợ Bến Thành";
  rows[1].location = "Dinh Độc Lập";
  const url = buildDirectionsUrl(rows);
  assert.match(url, /google\.com\/maps\/dir/);
  assert.match(url, /origin=/);
  assert.match(url, /destination=/);
});
