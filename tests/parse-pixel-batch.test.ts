import { describe, expect, it } from "vitest";

import {
  MAX_BATCH_SIZE,
  parsePixelBatch,
} from "../src/canvas/utils/parse-pixel-batch.js";

const valid = { x: 1, y: 2, color: "#A1b2C3" };

describe("parsePixelBatch", () => {
  it("accepts valid pixels and drops extra fields", () => {
    expect(
      parsePixelBatch([{ ...valid, userId: "someone-else", placedAt: "x" }]),
    ).toEqual([valid]);
  });

  it("accepts the canvas corners", () => {
    expect(() =>
      parsePixelBatch([
        { x: 0, y: 0, color: "#000000" },
        { x: 999, y: 999, color: "#FFFFFF" },
      ]),
    ).not.toThrow();
  });

  it("collapses duplicate coordinates to the last color", () => {
    expect(
      parsePixelBatch([
        { x: 1, y: 1, color: "#000000" },
        { x: 1, y: 1, color: "#FFFFFF" },
      ]),
    ).toEqual([{ x: 1, y: 1, color: "#FFFFFF" }]);
  });

  it.each([
    ["not an array", "pixels"],
    ["undefined", undefined],
    ["an empty batch", []],
    ["a null pixel", [null]],
    ["a string pixel", ["#000000"]],
    ["a negative x", [{ ...valid, x: -1 }]],
    ["x past the edge", [{ ...valid, x: 1000 }]],
    ["y past the edge", [{ ...valid, y: 1000 }]],
    ["a fractional coordinate", [{ ...valid, x: 1.5 }]],
    ["a numeric string coordinate", [{ ...valid, x: "1" }]],
    ["a missing color", [{ x: 1, y: 1 }]],
    ["a color without a hash", [{ ...valid, color: "000000" }]],
    ["a short color", [{ ...valid, color: "#000" }]],
    ["markup in a color", [{ ...valid, color: "#<script>" }]],
    ["a long color", [{ ...valid, color: `#${"0".repeat(5000)}` }]],
    [
      "an oversized batch",
      Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, x) => ({ ...valid, x })),
    ],
  ])("rejects %s", (_, input) => {
    expect(() => parsePixelBatch(input)).toThrow(
      "canvas.errors.invalid-pixel-data",
    );
  });
});
