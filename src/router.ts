import { Express, Request, Response } from "express";

import { authRouter } from "./auth/routers/auth-router.js";
import { shopRouter } from "./shop/routers/shop-router.js";

const router = (app: Express) => {
  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Pixel Place API is running" });
  });
  app.use("/", authRouter);
  app.use("/", shopRouter);
};

export { router };
