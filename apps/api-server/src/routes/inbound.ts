import type { FastifyInstance } from "fastify";
import { parseInboundEmail } from "../services/email-triage.js";
import { saveInboundCommunication, listCommunications, resolvePatientIdByEmail } from "../lib/communications.js";

export async function inboundRoutes(app: FastifyInstance) {
  // POST /api/inbound-email { from, subject, body } -> ParsedIntent + stored communication
  app.post("/api/inbound-email", async (req, reply) => {
    const body = (req.body || {}) as { from?: string; subject?: string; body?: string };
    if (!body.from || !body.body) {
      return reply.code(400).send({ error: "Missing required fields: from, body" });
    }
    const parsed = await parseInboundEmail({
      from: body.from,
      subject: body.subject || "",
      body: body.body,
    });
    const patient_id = resolvePatientIdByEmail(body.from);
    const saved = await saveInboundCommunication({
      patient_id,
      patient_email: body.from,
      content: `Subject: ${body.subject || ""}\n${body.body}`,
      intent: parsed.intent,
      urgency: parsed.urgency,
    });
    return {
      intent: parsed.intent,
      urgency: parsed.urgency,
      summary: parsed.summary,
      suggested_action: parsed.suggested_action,
      patient_email: body.from,
      patient_id,
      communication_id: saved.id,
      llm_used: parsed.llm_used,
    };
  });

  // GET /api/communications?patient_id=
  app.get("/api/communications", async (req) => {
    const q = req.query as { patient_id?: string };
    const pid = q.patient_id !== undefined ? Number(q.patient_id) : undefined;
    return listCommunications(pid);
  });
}
