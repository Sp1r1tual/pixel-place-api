import { Express, Request, Response } from "express";

import { authRouter } from "./auth/routers/auth-router.js";

const router = (app: Express) => {
  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Pixel Place API is running" });
  });
  app.use("/", authRouter);
};

export { router };
