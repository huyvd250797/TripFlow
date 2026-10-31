import test from "node:test";
import assert from "node:assert/strict";
import {
  beginAppWrite,
  isNewerVersion,
  prepareAppUpdate,
  registerUpdatePreparation,
  setUpdateBlocker,
  updateBlockReason,
} from "../lib/update-safety";
import { createRefreshScheduler } from "../lib/refresh-scheduler";
test("V2.5 rejects malformed/older versions and compares numeric SemVer", () => {
  assert.equal(isNewerVersion("2.10.0", "2.9.9"), true);
  assert.equal(isNewerVersion("2.5.0", "2.5.0"), false);
  assert.equal(isNewerVersion("2.4.1", "2.5.0"), false);
  assert.equal(isNewerVersion("<script>", "2.5.0"), false);
});
test("V2.5 update is blocked by writes/drafts, flushes preparations and rechecks after awaiting", async () => {
  const done = beginAppWrite();
  await assert.rejects(prepareAppUpdate(), /Đang lưu/);
  done();
  setUpdateBlocker("test-draft", "Unsaved draft");
  assert.equal(updateBlockReason(), "Unsaved draft");
  await assert.rejects(prepareAppUpdate(), /Unsaved/);
  setUpdateBlocker("test-draft");
  let flushed = false;
  const unregister = registerUpdatePreparation("test", async () => {
    flushed = true;
  });
  await prepareAppUpdate();
  assert.equal(flushed, true);
  unregister();
  const stop = registerUpdatePreparation("race", async () => {
    setUpdateBlocker("race", "Write started");
  });
  await assert.rejects(prepareAppUpdate(), /Write started/);
  stop();
  setUpdateBlocker("race");
});
test("V2.5 realtime bursts coalesce and metadata requests upgrade the one scheduled refresh", async () => {
  const calls: boolean[] = [];
  const s = createRefreshScheduler((x) => calls.push(x), 10);
  s.schedule();
  s.schedule();
  s.schedule(true);
  s.schedule();
  await new Promise((r) => setTimeout(r, 25));
  assert.deepEqual(calls, [true]);
  s.schedule();
  s.dispose();
  await new Promise((r) => setTimeout(r, 25));
  assert.deepEqual(calls, [true]);
});
