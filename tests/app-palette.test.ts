import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import {
  PALETTES,
  PALETTE_BOOTSTRAP,
  luminance,
  mixHex,
  paletteValues,
  appliedPaletteValues,
  resolvePalette,
} from "../lib/app-palette";

test("palette rejects invalid storage and CSS injection, trusts canonical presets", () => {
  for (const value of [
    null,
    "rose",
    {},
    { id: "custom", start: "red; background:url(x)", end: "#FFFFFF" },
    { id: "custom", start: "#fff", end: "#000000" },
  ])
    assert.equal(resolvePalette(value).id, "default");
  assert.equal(
    resolvePalette({ id: "ocean", start: "evil", end: "evil" }).start,
    PALETTES[1].start,
  );
});

test("preset and extreme custom gradients retain readable white text and accent text", () => {
  for (const start of [
    ...PALETTES.map((p) => p.start),
    "#FFFFFF",
    "#000000",
    "#FF0000",
    "#00FF00",
    "#0000FF",
  ]) {
    for (const end of ["#FFFFFF", "#000000", "#FFFF00"]) {
      const vars = paletteValues({ id: "custom", name: "", start, end });
      for (const stop of [vars["--palette-start"], vars["--palette-end"]])
        assert.ok(
          1.05 / (luminance(mixHex(stop, 255, 24 / 255)) + 0.05) >= 4.5,
        );
      assert.ok(1.05 / (luminance(vars["--palette-light"]) + 0.05) >= 4.5);
      // Dark accent against the brightest standard dark panel (#1b2e3f).
      assert.ok(
        (luminance(vars["--palette-dark"]) + 0.05) /
          (luminance("#1B2E3F") + 0.05) >=
          4.5,
      );
    }
  }
});

test("before-paint bootstrap equals runtime colors, tolerates corrupt or blocked storage", () => {
  for (const value of [
    ...PALETTES,
    { id: "custom", name: "", start: "#FFFFFF", end: "#ff00ff" },
    null,
    { id: "injected" },
  ]) {
    const dataset: Record<string, string> = {},
      values: Record<string, string> = {};
    runInNewContext(PALETTE_BOOTSTRAP, {
      localStorage: { getItem: () => JSON.stringify(value) },
      document: {
        documentElement: {
          dataset,
          style: {
            setProperty: (k: string, v: string) => {
              values[k] = v;
            },
          },
        },
      },
    });
    const p = resolvePalette(value);
    assert.deepEqual(values, p.id === "default" ? {} : appliedPaletteValues(p));
    assert.equal(dataset.palette, p.id === "default" ? undefined : p.id);
  }
  for (const getItem of [
    () => "broken",
    () => {
      throw new Error("blocked");
    },
  ])
    assert.doesNotThrow(() =>
      runInNewContext(PALETTE_BOOTSTRAP, { localStorage: { getItem } }),
    );
});

test("all discovered brand tones preserve luminance for preset, bright and monochrome custom palettes", async () => {
  const { TONE_COLORS, toneValues } = await import("../lib/palette-tones.js");
  assert.ok(TONE_COLORS.length > 500);
  for (const end of ["#8B55B8", "#FFFFFF", "#000000", "#FF4400"]) {
    const values = toneValues(TONE_COLORS, end) as Record<string, string>;
    for (const color of TONE_COLORS) {
      const mapped = values["--brand-tone-" + color.slice(1).toLowerCase()];
      assert.ok(
        Math.abs(luminance(mapped) - luminance(color)) < 0.006,
        `${color} -> ${mapped}`,
      );
    }
  }
});
