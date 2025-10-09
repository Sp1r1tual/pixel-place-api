import { Express, Request, Response } from "express";

const router = (app: Express) => {
  app.get("/", (req: Request, res: Response) => {
    res.json({ message: "Pixel Place API is running" });
  });
};

export { router };
