import { Express, Request, Response } from "express";

import { authRouter } from "./auth/routers/auth-router.js";
import { shopRouter } from "./shop/routers/shop-router.js";
import { profileRouter } from "./profile/routers/profile-router.js";
import { systemRouter } from "./system/routers/system-router.js";

const router = (app: Express) => {
  app.get("/health", async (req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "main-api",
    });
  });

  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Pixel Place API is running" });
  });

  app.use("/", authRouter);
  app.use("/", shopRouter);
  app.use("/", profileRouter);
  app.use("/", systemRouter);
};

export { router };
