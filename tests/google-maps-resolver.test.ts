import test from "node:test";
import assert from "node:assert/strict";
import { allowedGoogleMapsUrl, resolveGoogleMapsUrl, type GoogleMapsRequestFn } from "../lib/google-maps-resolver";

const SHORT = "https://maps.app.goo.gl/ySoEVvZNbrSWqu168";
const FULL = "https://www.google.com/maps/place/La+Vague+Nha+Trang/@12.2200647,109.2036555,17z/data=!3m1!4b1!4m9!3m8!1s0x317067f70ac1740f:0xa910907217f566d!8m2!3d12.2200647!4d109.2036555";

test("V1.8.3 resolves a Google Maps short link from Location without opening the final page", async () => {
  const calls: string[] = [];
  const request: GoogleMapsRequestFn = async (url, method) => {
    calls.push(`${method} ${url.toString()}`);
    return { status: 302, headers: { location: FULL }, body: "" };
  };

  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, { lat: 12.2200647, lng: 109.2036555 });
  assert.equal(result.normalizedUrl, "https://www.google.com/maps/search/?api=1&query=12.2200647,109.2036555");
  assert.equal(result.source, "location");
  assert.deepEqual(calls, [`HEAD ${SHORT}`]);
});

test("V1.8.3 parses Location even when an upstream proxy rewrites the status", async () => {
  const request: GoogleMapsRequestFn = async () => ({
    status: 200,
    headers: { location: FULL },
    body: "",
  });
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, { lat: 12.2200647, lng: 109.2036555 });
  assert.equal(result.source, "location");
});

test("V1.8.3 falls back from HEAD to GET and reads canonical/meta content", async () => {
  const request: GoogleMapsRequestFn = async (_url, method) => {
    if (method === "HEAD") return { status: 200, headers: {}, body: "" };
    return {
      status: 200,
      headers: {},
      body: `<html><head><link rel="canonical" href="${FULL.replaceAll("&", "&amp;")}"></head></html>`,
    };
  };
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, { lat: 12.2200647, lng: 109.2036555 });
  assert.equal(result.source, "html");
});

test("V1.8.3 follows an intermediate Google redirect and checks each Location before the next request", async () => {
  const intermediate = "https://www.google.com/maps?entry=ttu";
  const calls: string[] = [];
  const request: GoogleMapsRequestFn = async (url) => {
    calls.push(url.toString());
    if (url.toString() === SHORT) return { status: 302, headers: { location: intermediate }, body: "" };
    return { status: 302, headers: { location: FULL }, body: "" };
  };
  const result = await resolveGoogleMapsUrl(SHORT, request);
  assert.deepEqual(result.coordinate, { lat: 12.2200647, lng: 109.2036555 });
  assert.equal(calls.length, 2);
});


test("V1.8.3 Google host allow-list supports regional Google domains without allowing lookalikes", () => {
  assert.ok(allowedGoogleMapsUrl("https://www.google.com.vn/maps/@12.2,109.2,17z"));
  assert.ok(allowedGoogleMapsUrl("https://maps.google.co.jp/maps/@35.6,139.7,17z"));
  assert.equal(allowedGoogleMapsUrl("https://google.evil.com/maps/@12.2,109.2,17z"), null);
  assert.equal(allowedGoogleMapsUrl("http://www.google.com/maps/@12.2,109.2,17z"), null);
});
