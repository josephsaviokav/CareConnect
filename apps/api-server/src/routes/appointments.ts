import type { FastifyInstance } from "fastify";
import { queryAppointments } from "../lib/db.js";
import { sendReviewForAppointment } from "../services/drip-worker.js";

export async function appointmentRoutes(app: FastifyInstance) {
  // GET /api/appointments?status=completed
  app.get("/api/appointments", async (req) => {
    const q = req.query as { status?: string; patient_id?: string };
    let rows = (await queryAppointments()) as any[];
    if (q.status) rows = rows.filter((a) => a.status === q.status);
    if (q.patient_id) rows = rows.filter((a) => a.patient_id === Number(q.patient_id));
    return rows;
  });

  // POST /api/appointments/:id/review-request → triggers review template (AGENTS.md §5)
  app.post("/api/appointments/:id/review-request", async (req, reply) => {
    const params = req.params as { id: string };
    const sent = await sendReviewForAppointment(Number(params.id));
    if (!sent) return reply.code(404).send({ error: "Appointment not found or not completed" });
    return { queued: 1, ...sent };
  });
}
