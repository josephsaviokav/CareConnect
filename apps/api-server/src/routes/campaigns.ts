import type { FastifyInstance } from "fastify";
import { campaigns, renderTemplate, lastProcedureFor, getPatientById } from "../lib/campaigns.js";
import { saveOutboundCommunication } from "../lib/communications.js";

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/api/campaigns", async () => campaigns);

  // POST /api/campaigns/:id/trigger { patient_ids:number[] } -> { queued:number }
  app.post("/api/campaigns/:id/trigger", async (req, reply) => {
    const params = req.params as { id: string };
    const campaign = campaigns.find((c) => c.id === Number(params.id) && c.is_active);
    if (!campaign) return reply.code(404).send({ error: "Campaign not found or inactive" });
    const body = (req.body || {}) as { patient_ids?: number[] };
    if (!Array.isArray(body.patient_ids) || body.patient_ids.length === 0) {
      return reply.code(400).send({ error: "Provide patient_ids:number[]" });
    }
    let queued = 0;
    for (const pid of body.patient_ids) {
      const patient = getPatientById(pid);
      if (!patient) continue;
      const text = renderTemplate(campaign.template_body, patient as any, {
        last_procedure: lastProcedureFor(pid),
      });
      await saveOutboundCommunication({ patient_id: pid, content: `[${campaign.name}] ${text}` });
      queued++;
    }
    return { queued };
  });
}
