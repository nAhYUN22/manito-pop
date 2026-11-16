import { test } from "node:test";
import assert from "node:assert/strict";
import { draw } from "../lib/draw.ts";
test("every participant receives exactly one other person across sizes 2–100", () => {
  for (let count = 2; count <= 100; count++) {
    for (let trial = 0; trial < 100; trial++) {
      const result = draw(count);
      assert.equal(result.length, count);
      assert.equal(new Set(result).size, count);
      result.forEach((target, i) => {
        assert.notEqual(target, i);
        assert.ok(target >= 0 && target < count);
      });
    }
  }
});
test("two participants always draw each other", () =>
  assert.deepEqual(draw(2), [1, 0]));
test("invalid group sizes are rejected", () => {
  for (const n of [0, 1, -1, 1.5, 101, NaN]) assert.throws(() => draw(n));
});
