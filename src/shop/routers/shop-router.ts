import { Router } from "express";

// import { checkAuthMiddleware } from "../../shared/middlewares/check-auth-middleware.js";

import { ShopController } from "../controllers/shop-controller.js";

const shopRouter = Router();

const shopController = new ShopController();

shopRouter.get("/shop", shopController.getShop);

shopRouter.post("/shop/upgrade", shopController.upgradeItem);

export { shopRouter };
