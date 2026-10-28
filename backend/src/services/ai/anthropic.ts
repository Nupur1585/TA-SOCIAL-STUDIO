/**
 * Minimal Anthropic Messages API client (plain fetch, no SDK dependency).
 * The key is read from the environment on every call and is never logged or returned.
 */
export class AiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const aiConfigured = () => (process.env["ANTHROPIC_API_KEY"] ?? "").trim() !== "";
export const aiModel = () => (process.env["AI_MODEL"] ?? "").trim() || "claude-sonnet-5-5";

interface ToolCall {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
}

/** Forces the model to answer through one tool, so the reply is structured JSON rather than prose. */
export async function callTool(req: ToolCall): Promise<unknown> {
  const key = (process.env["ANTHROPIC_API_KEY"] ?? "").trim();
  if (!key) throw new AiError(503, "AI is not configured on the server. Add ANTHROPIC_API_KEY to backend/.env and restart.");

  const timeout = Math.max(10, Number(process.env["AI_TIMEOUT_SECONDS"]) || 60) * 1000;
  let res: Response;
  try {
    const base = (process.env["ANTHROPIC_BASE_URL"] ?? "").trim().replace(/\/+$/, "") || "https://api.anthropic.com";
    res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: aiModel(),
        max_tokens: req.maxTokens ?? 4096,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        tools: [{ name: req.toolName, description: req.toolDescription, input_schema: req.inputSchema }],
        tool_choice: { type: "tool", name: req.toolName },
      }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const timedOut = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
    throw new AiError(timedOut ? 504 : 502, timedOut ? "The AI request timed out. Try again, or generate for fewer platforms." : "Could not reach the AI provider. Check the server's internet connection.");
  }

  if (!res.ok) {
    // Status only: provider bodies are never logged or forwarded.
    console.error(`[ai] provider responded HTTP ${res.status}`);
    if (res.status === 401 || res.status === 403) throw new AiError(502, "The AI provider rejected the server's API key. Check ANTHROPIC_API_KEY.");
    if (res.status === 429) throw new AiError(429, "The AI provider is rate limiting requests. Wait a minute and try again.");
    if (res.status === 529 || res.status >= 500) throw new AiError(503, "The AI provider is temporarily unavailable. Try again shortly.");
    if (res.status === 404) throw new AiError(502, "The configured AI model was not found. Check AI_MODEL.");
    throw new AiError(502, `The AI provider could not process the request (HTTP ${res.status}).`);
  }

  let body: { content?: { type: string; name?: string; input?: unknown }[]; stop_reason?: string };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new AiError(502, "The AI provider returned an unreadable response.");
  }
  const block = body.content?.find((c) => c.type === "tool_use" && c.name === req.toolName);
  if (!block || block.input == null) {
    throw new AiError(502, body.stop_reason === "max_tokens" ? "The AI response was cut off. Try fewer platforms or variations." : "The AI returned no usable content. Try again.");
  }
  return block.input;
}
