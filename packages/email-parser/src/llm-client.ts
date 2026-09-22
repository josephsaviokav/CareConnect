import type { ParsedIntent } from "./types.js";

/**
 * Lightweight LLM wrapper for email intent parsing.
 * Priority: OLLAMA_URL (local Phi-3/LLaMA) -> LLM_API_KEY (OpenAI-compatible) -> null (regex fallback).
 * Never throws — returns null when no backend is reachable so callers use the mock parser.
 */

const SYSTEM_PROMPT = `You are a dental practice triage assistant. Classify the inbound email into exactly one intent: booking_request, post_op_complication, review_response, general, spam. Also assign urgency low/medium/high. Return ONLY valid JSON: {"intent":..., "urgency":..., "summary":..., "suggested_action":...}.`;

export async function callLLM(emailText: string): Promise<ParsedIntent | null> {
  const ollamaUrl = process.env.OLLAMA_URL;
  const apiKey = process.env.LLM_API_KEY;

  // 1. Try Ollama local (e.g. phi3 / llama3)
  if (ollamaUrl) {
    try {
      const res = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "phi3",
          prompt: `${SYSTEM_PROMPT}\n\nEmail:\n${emailText}`,
          stream: false,
          format: "json",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { response?: string };
        const parsed = tryParseIntent(data.response || "");
        if (parsed) return parsed;
      }
    } catch {
      // fall through to next backend
    }
  }

  // 2. Try OpenAI-compatible API (LLM_API_KEY)
  if (apiKey) {
    try {
      const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
      const model = process.env.LLM_MODEL || "gpt-4o-mini";
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: emailText },
          ],
          response_format: { type: "json_object" },
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content || "";
        const parsed = tryParseIntent(content);
        if (parsed) return parsed;
      }
    } catch {
      // fall through to null
    }
  }

  return null;
}

function tryParseIntent(raw: string): ParsedIntent | null {
  try {
    // LLM may wrap JSON in markdown fences — strip them
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (!obj.intent || !obj.urgency) return null;
    const validIntents = ["booking_request", "post_op_complication", "review_response", "general", "spam"];
    const validUrgency = ["low", "medium", "high"];
    if (!validIntents.includes(obj.intent) || !validUrgency.includes(obj.urgency)) return null;
    return {
      intent: obj.intent,
      urgency: obj.urgency,
      summary: String(obj.summary || "").slice(0, 300),
      suggested_action: String(obj.suggested_action || "").slice(0, 300),
    };
  } catch {
    return null;
  }
}
