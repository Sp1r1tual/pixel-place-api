import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { router } from "./router.js";
import { errorMiddleware } from "./shared/middlewares/error-middleware.js";

const app = express();

// Number of reverse proxies in front of the API. Rate limits key on the client IP,
// so behind a proxy this must be set or all users would share a single limit.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 0));

const allowedOrigins = [process.env.CLIENT_URL];

app.use(
  helmet({
    // The API serves JSON plus activation pages that redirect with an inline script.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

router(app);

app.use(errorMiddleware);

export { app };
