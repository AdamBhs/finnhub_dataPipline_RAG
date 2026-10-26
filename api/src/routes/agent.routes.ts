
import { Router } from "express";
import { chatWithAgent } from "../controllers/agent.controller.js";

const router = Router();

router.post("/chat", chatWithAgent);

export default router;
