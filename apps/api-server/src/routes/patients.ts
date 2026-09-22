import type { FastifyInstance } from "fastify";
import { queryLapsedPatients, queryPatientsByStatus } from "../lib/db.js";

export async function patientRoutes(app: FastifyInstance) {
  // GET /api/patients/lapsed — uses JOIN query §4.2 (or mock fallback)
  app.get("/api/patients/lapsed", async () => {
    const result = await queryLapsedPatients();
    return result.data;
  });

  // GET /api/patients?status=lapsed
  app.get("/api/patients", async (req) => {
    const q = req.query as { status?: string };
    const data = await queryPatientsByStatus(q.status);
    return data;
  });

  app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));
}
