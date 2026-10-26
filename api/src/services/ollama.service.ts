import "dotenv/config";

interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
  };
}

export async function askQwen(prompt: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

  const model = process.env.OLLAMA_MODEL;

  if (!model) {
    throw new Error("OLLAMA_MODEL is not configured in .env");
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant for a financial market monitoring dashboard.",
            
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status}`);
  }

  const result = (await response.json()) as OllamaChatResponse;

  return result.message.content;
}
