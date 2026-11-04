import type { IPixelInput } from "../../types/index.js";

import { ApiError } from "../../shared/exceptions/api-error.js";
import { CANVAS_ERRORS } from "./errors/errors-messages.js";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
// Above the highest reachable energy (10 base + 12 upgrades), low enough to stay cheap.
const MAX_BATCH_SIZE = 64;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const isCoordinate = (value: unknown, limit: number): value is number =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) < limit;

/** Validates untrusted socket input. Duplicate coordinates collapse to the last one. */
const parsePixelBatch = (input: unknown): IPixelInput[] => {
  if (!Array.isArray(input) || input.length === 0) {
    throw ApiError.BadRequest(CANVAS_ERRORS.invalidPixel);
  }

  if (input.length > MAX_BATCH_SIZE) {
    throw ApiError.BadRequest(CANVAS_ERRORS.invalidPixel);
  }

  const unique = new Map<string, IPixelInput>();

  for (const pixel of input) {
    const { x, y, color } = (pixel ?? {}) as Record<string, unknown>;

    if (
      !isCoordinate(x, CANVAS_WIDTH) ||
      !isCoordinate(y, CANVAS_HEIGHT) ||
      typeof color !== "string" ||
      !COLOR_PATTERN.test(color)
    ) {
      throw ApiError.BadRequest(CANVAS_ERRORS.invalidPixel);
    }

    unique.set(`${x}:${y}`, { x, y, color });
  }

  return [...unique.values()];
};

export { parsePixelBatch, MAX_BATCH_SIZE };
