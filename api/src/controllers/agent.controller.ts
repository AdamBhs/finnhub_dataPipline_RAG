
import type { Request, Response } from "express";
import { askQwen } from "../services/ollama.service.js";

export async function chatWithAgent(
  req: Request,
  res: Response,
): Promise<void> {
  const { prompt } = req.body as { prompt?: unknown };

  if (
    typeof prompt !== "string" ||
    prompt.trim().length === 0 ||
    prompt.length > 4000
  ) {
    res.status(400).json({
      error: "Prompt must be a non-empty string of at most 4000 characters",
    });
    return;
  }

  try {
    const answer = await askQwen(prompt.trim());

    res.json({ answer });
  } catch (error) {
    console.error("Agent request failed:", error);

    res.status(502).json({
      error: "Unable to get a response from the local AI model",
    });
  }
}
