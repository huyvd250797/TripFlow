import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { mutationRequestError, privateHeaders, readJsonText } from "../lib/api-hardening";

test("V1.3 mutation request guard rejects cross-site and wrong content type", async () => {
  const crossSite = new NextRequest("https://tripflow.test/api/tripflow", {
    method: "POST",
    headers: {
      origin: "https://evil.test",
      "content-type": "application/json",
      "sec-fetch-site": "cross-site",
    },
    body: "{}",
  });
  assert.deepEqual(mutationRequestError(crossSite, 100), {
    message: "Nguồn yêu cầu không hợp lệ.",
    status: 403,
  });

  const textBody = new NextRequest("https://tripflow.test/api/tripflow", {
    method: "POST",
    headers: { origin: "https://tripflow.test", "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(mutationRequestError(textBody, 100)?.status, 415);
});

test("V1.3 mutation request guard enforces byte limit and private headers", async () => {
  const req = new NextRequest("https://tripflow.test/api/tripflow", {
    method: "POST",
    headers: { origin: "https://tripflow.test", "content-type": "application/json" },
    body: JSON.stringify({ note: "đ".repeat(20) }),
  });
  assert.equal(mutationRequestError(req, 100), null);
  await assert.rejects(readJsonText(req, 20), /PAYLOAD_TOO_LARGE/);

  const headers = privateHeaders();
  assert.match(headers["Cache-Control"], /no-store/);
  assert.equal(headers["X-TripFlow-Version"], "1.3.0");
  assert.ok(headers["X-Request-Id"].length > 10);
});
