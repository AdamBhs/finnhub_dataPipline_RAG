import { Router } from "express";
import { getMarketData } from "../controllers/market.controller.js";

const router = Router();

router.get("/:symbol", getMarketData);

export default router;
