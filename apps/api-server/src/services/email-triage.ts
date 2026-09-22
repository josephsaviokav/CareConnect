import type { ParsedIntent } from "@carrstack/shared-types";

/**
 * Self-contained email triage for api-server (mirrors packages/email-parser).
 * Duplicated to keep api-server build self-contained (rootDir=src).
 * Canonical logic lives in packages/email-parser/src/parse.ts + llm-client.ts.
 */

export interface InboundEmailInput {
  from: string;
  subject: string;
  body: string;
}

function mockParse(text: string): Omit<ParsedIntent, "patient_email"> {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("crypto", "lottery", "winner", "free money", "viagra", "inheritance", "click here to claim", "double your bitcoin")) {
    return { intent: "spam", urgency: "low", summary: "Unsolicited promotional message, unrelated to dental care.", suggested_action: "ignore and mark as spam" };
  }
  if (has("bleeding", "won't stop bleeding", "wont stop bleeding", "blood", "severe pain", "hurts badly", "extraction", "swelling", "infection", "emergency", "numbness", "fever after")) {
    const high = has("bleeding", "won't stop", "wont stop", "severe", "hurts badly", "emergency", "blood");
    return {
      intent: "post_op_complication",
      urgency: high ? "high" : "medium",
      summary: "Patient reports post-procedure symptoms requiring clinical triage.",
      suggested_action: high ? "alert staff immediately" : "schedule urgent follow-up within 24h",
    };
  }
  if (has("review", "stars", "great service", "thank you for", "5 star", "google review", "excellent experience")) {
    return { intent: "review_response", urgency: "low", summary: "Patient feedback / review about their visit.", suggested_action: "thank patient and log review" };
  }
  if (has("book", "appointment", "schedule", "available", "checkup", "cleaning", "enquiry", "enquire", "price", "cost of", "opening hours", "new patient")) {
    const medium = has("soon", "this week", "pain", "broken", "chipped", "toothache");
    return { intent: "booking_request", urgency: medium ? "medium" : "low", summary: "Patient wants to book or enquire about an appointment.", suggested_action: "send booking link and available slots" };
  }
  return { intent: "general", urgency: "low", summary: "General enquiry, no clear booking or clinical intent.", suggested_action: "reply with helpful info or route to staff" };
}

export function parseEmailText(emailText: string, patientEmail?: string): ParsedIntent {
  return { ...mockParse(emailText), patient_email: patientEmail };
}

function tryParseIntent(raw: string): ParsedIntent | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
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

const SYSTEM_PROMPT = `You are a dental practice triage assistant. Classify the inbound email into exactly one intent: booking_request, post_op_complication, review_response, general, spam. Also assign urgency low/medium/high. Return ONLY valid JSON: {"intent":..., "urgency":..., "summary":..., "suggested_action":...}.`;

export async function callLLM(emailText: string): Promise<{ parsed: ParsedIntent; llmUsed: true } | null> {
  const ollamaUrl = process.env.OLLAMA_URL;
  const apiKey = process.env.LLM_API_KEY;
  if (ollamaUrl) {
    try {
      const res = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OLLAMA_MODEL || "phi3", prompt: `${SYSTEM_PROMPT}\n\nEmail:\n${emailText}`, stream: false, format: "json" }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { response?: string };
        const parsed = tryParseIntent(data.response || "");
        if (parsed) return { parsed, llmUsed: true };
      }
    } catch { /* fallback */ }
  }
  if (apiKey) {
    try {
      const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
      const model = process.env.LLM_MODEL || "gpt-4o-mini";
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: emailText }],
          response_format: { type: "json_object" },
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const parsed = tryParseIntent(data.choices?.[0]?.message?.content || "");
        if (parsed) return { parsed, llmUsed: true };
      }
    } catch { /* fallback */ }
  }
  return null;
}

export async function parseInboundEmail(input: InboundEmailInput): Promise<ParsedIntent & { llm_used: boolean }> {
  const combined = `From: ${input.from}\nSubject: ${input.subject}\nBody: ${input.body}`;
  try {
    const llm = await callLLM(combined);
    if (llm) return { ...llm.parsed, patient_email: input.from, llm_used: true };
  } catch { /* ignore */ }
  return { ...parseEmailText(combined, input.from), llm_used: false };
}
