import test from "node:test";
import assert from "node:assert/strict";
import { allowedGoogleMapsUrl, resolveGoogleMapsUrl, type GoogleMapsRequestFn } from "../lib/google-maps-resolver";

const SHORT = "https://maps.app.goo.gl/YVvszUd4AFD1VXPt6?g_st=ic";
const FULL = "https://www.google.com/maps/place/La+Vague+Nha+Trang/@12.2200647,109.2036555,17z/data=!3m1!4b1!4m9!3m8!1s0x317067f70ac1740f:0xa910907217f566d!8m2!3d12.2200647!4d109.2036555";
const FULL_WITH_WRONG_VIEWPORT = "https://www.google.com/maps/place/La+Vague+Nha+Trang/@-77.844326,39.0267995,3z/data=!4m9!3m8!1s0x317067f70ac1740f:0xa910907217f566d!8m2!3d12.2200647!4d109.2036555";

const expected = { lat: 12.2200647, lng: 109.2036555 };

test("V1.8.4 resolves the exact user short link with browser-style GET", async () => {
  const calls: string[] = [];
  const request: GoogleMapsRequestFn = async (url, method) => {
    calls.push(`${method} ${url.toString()}`);
    return { status: 302, headers: { location: FULL }, body: "" };
  };

  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, expected);
  assert.equal(result.originalUrl, SHORT);
  assert.equal(result.normalizedUrl, "https://www.google.com/maps/search/?api=1&query=12.2200647,109.2036555");
  assert.equal(result.source, "location");
  assert.deepEqual(calls, [`GET ${SHORT}`]);
});

test("V1.8.4 prefers the actual place coordinate over a conflicting @ viewport", async () => {
  const request: GoogleMapsRequestFn = async () => ({
    status: 302,
    headers: { location: FULL_WITH_WRONG_VIEWPORT },
    body: "",
  });
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, expected);
  assert.notDeepEqual(result.coordinate, { lat: -77.844326, lng: 39.0267995 });
});

test("V1.8.4 parses Location even when an upstream proxy rewrites the status", async () => {
  const request: GoogleMapsRequestFn = async () => ({
    status: 200,
    headers: { location: FULL },
    body: "",
  });
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, expected);
  assert.equal(result.source, "location");
});

test("V1.8.4 reads trusted canonical URL but ignores unrelated coordinates in HTML", async () => {
  const request: GoogleMapsRequestFn = async () => ({
    status: 200,
    headers: {},
    body: `<html><head><link rel="canonical" href="${FULL.replaceAll("&", "&amp;")}"></head><body><script>window.telemetry={lat:-77.844326,lng:39.0267995}</script></body></html>`,
  });
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, expected);
  assert.equal(result.source, "html");
});

test("V1.8.4 never promotes an arbitrary coordinate from Google HTML into a destination", async () => {
  const request: GoogleMapsRequestFn = async () => ({
    status: 200,
    headers: {},
    body: `<html><body><script>window.telemetry={lat:-77.844326,lng:39.0267995}</script><div>-77.844326,39.0267995</div></body></html>`,
  });
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.equal(result.coordinate, null);
  assert.equal(result.normalizedUrl, null);
  assert.equal(result.source, "unresolved");
});

test("V1.8.4 follows an intermediate Google redirect and checks each Location before the next request", async () => {
  const intermediate = "https://www.google.com/maps?entry=ttu";
  const calls: string[] = [];
  const request: GoogleMapsRequestFn = async (url, method) => {
    calls.push(`${method} ${url.toString()}`);
    if (url.toString() === SHORT) return { status: 302, headers: { location: intermediate }, body: "" };
    return { status: 302, headers: { location: FULL }, body: "" };
  };
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, expected);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.startsWith("GET ")));
});

test("V1.8.4 Google host allow-list supports regional Google domains without allowing lookalikes", () => {
  assert.ok(allowedGoogleMapsUrl("https://www.google.com.vn/maps/@12.2,109.2,17z"));
  assert.ok(allowedGoogleMapsUrl("https://maps.google.co.jp/maps/@35.6,139.7,17z"));
  assert.equal(allowedGoogleMapsUrl("https://google.evil.com/maps/@12.2,109.2,17z"), null);
  assert.equal(allowedGoogleMapsUrl("http://www.google.com/maps/@12.2,109.2,17z"), null);
});
