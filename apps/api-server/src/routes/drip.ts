import type { FastifyInstance } from "fastify";
import { runLapsedDrip, runReviewDrip } from "../services/drip-worker.js";

/**
 * Manual drip runner for hackathon demo (cron fires on its own schedule too).
 * POST /api/drip/run { job?: 'lapsed'|'review'|'all', minAgeHours?, maxAgeHours? }
 */
export async function dripRoutes(app: FastifyInstance) {
  app.post("/api/drip/run", async (req) => {
    const body = (req.body || {}) as {
      job?: "lapsed" | "review" | "all";
      minAgeHours?: number;
      maxAgeHours?: number;
    };
    const job = body.job || "all";
    const out: Record<string, unknown> = {};
    if (job === "lapsed" || job === "all") out.lapsed = await runLapsedDrip();
    if (job === "review" || job === "all") {
      out.review = await runReviewDrip({
        minAgeHours: body.minAgeHours ?? 0,
        maxAgeHours: body.maxAgeHours ?? 24,
      });
    }
    return out;
  });
}
