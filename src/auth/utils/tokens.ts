import { createHash } from "crypto";

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const RESET_MAIL_COOLDOWN_MS = 60 * 1000;
// A second tab may refresh with the old cookie while the first response is in flight.
const ROTATION_GRACE_MS = 30 * 1000;

// Tokens are stored hashed: a leaked table must not contain usable sessions.
const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export {
  REFRESH_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
  RESET_MAIL_COOLDOWN_MS,
  ROTATION_GRACE_MS,
  hashToken,
};
