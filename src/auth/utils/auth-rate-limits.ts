import { rateLimit } from "express-rate-limit";

const MINUTE = 60 * 1000;

const createLimiter = (
  windowMinutes: number,
  limit: number,
  skipSuccessfulRequests = false,
) =>
  rateLimit({
    windowMs: windowMinutes * MINUTE,
    limit,
    skipSuccessfulRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "errors.too-many-requests", errors: [] },
  });

const loginLimiter = createLimiter(15, 20, true);
const registrationLimiter = createLimiter(60, 10);
const forgotPasswordLimiter = createLimiter(15, 5);
const resetPasswordLimiter = createLimiter(15, 10);

export {
  loginLimiter,
  registrationLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
};
