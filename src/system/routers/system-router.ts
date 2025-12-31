import { Router } from "express";

import { SystemController } from "../controllers/system-controller.js";

const systemRouter = Router();
const systemController = new SystemController();

systemRouter.get("/system/ping", systemController.ping);

export { systemRouter };
