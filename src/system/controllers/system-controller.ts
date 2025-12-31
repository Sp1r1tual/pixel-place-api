import { Request, Response, NextFunction } from "express";

class SystemController {
  async ping(req: Request, res: Response, next: NextFunction) {
    try {
      console.info("[WAKE-UP] system ping");

      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}

export { SystemController };
