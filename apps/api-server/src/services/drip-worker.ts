import cron from "node-cron";
import type { Appointment } from "@careconnect/shared-types";
import { getLapsedPatients } from "./segmentation.js";
import { campaigns, renderTemplate, lastProcedureFor, getPatientById } from "../lib/campaigns.js";
import { saveOutboundCommunication, listCommunications } from "../lib/communications.js";
import { seedAppointments } from "../lib/seed-data.js";

export interface DripDetail {
  patient_id: number;
  communication_id: number;
  preview: string;
}

export interface DripResult {
  job: "lapsed" | "review";
  queued: number;
  details: DripDetail[];
}

const LAPSED_MARKER = "[6-month lapsed]";
const REVIEW_MARKER = "[post-appointment 24h]";

async function alreadySent(patient_id: number, marker: string, since: Date): Promise<boolean> {
  const comms = await listCommunications(patient_id);
  return comms.some(
    (c) => c.direction === "outbound" && c.content.includes(marker) && new Date(c.timestamp) >= since
  );
}

/**
 * Daily reactivation drip: all lapsed patients get campaign #1 with
 * personalized tokens (treatment history via last completed procedure).
 * Skips patients contacted in the last 7 days so daily cron stays idempotent.
 */
export async function runLapsedDrip(now: Date = new Date()): Promise<DripResult> {
  const campaign = campaigns.find((c) => c.id === 1 && c.is_active);
  if (!campaign) return { job: "lapsed", queued: 0, details: [] };
  const lapsed = getLapsedPatients(undefined, undefined, now);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const details: DripDetail[] = [];
  for (const p of lapsed) {
    if (await alreadySent(p.id, LAPSED_MARKER, weekAgo)) continue;
    const text = renderTemplate(campaign.template_body, p as any, {
      last_procedure: lastProcedureFor(p.id),
    });
    const saved = await saveOutboundCommunication({
      patient_id: p.id,
      content: `${LAPSED_MARKER} ${text}`,
    });
    details.push({ patient_id: p.id, communication_id: saved.id, preview: text.slice(0, 120) });
  }
  return { job: "lapsed", queued: details.length, details };
}

export interface ReviewDripOpts {
  minAgeHours?: number;
  maxAgeHours?: number;
  now?: Date;
  appointments?: Appointment[];
}

/**
 * Post-appointment drip: completed appointments whose age falls in
 * [minAgeHours, maxAgeHours] get campaign #2 (review request).
 * Cron uses 23â€“25h so each appointment triggers exactly once, one hour after
 * its 24h anniversary. Demo/manual runs use 0â€“24h ("completed in last day").
 */
export async function runReviewDrip(opts: ReviewDripOpts = {}): Promise<DripResult> {
  const { minAgeHours = 0, maxAgeHours = 24, now = new Date(), appointments = seedAppointments } = opts;
  const campaign = campaigns.find((c) => c.id === 2 && c.is_active);
  if (!campaign) return { job: "review", queued: 0, details: [] };
  const details: DripDetail[] = [];
  const due = appointments
    .filter((a) => a.status === "completed")
    .filter((a) => {
      const ageH = (now.getTime() - new Date(a.date).getTime()) / 3600000;
      return ageH >= minAgeHours && ageH <= maxAgeHours;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const appt of due) {
    const patient = getPatientById(appt.patient_id);
    if (!patient) continue;
    // One review request per appointment â€” skip if already sent after the visit.
    if (await alreadySent(appt.patient_id, `${REVIEW_MARKER}#${appt.id}`, new Date(appt.date))) continue;
    const text = renderTemplate(campaign.template_body, patient as any, {
      last_procedure: appt.procedure_type,
    });
    const saved = await saveOutboundCommunication({
      patient_id: appt.patient_id,
      type: "review_request",
      content: `${REVIEW_MARKER}#${appt.id} ${text}`,
    });
    details.push({ patient_id: appt.patient_id, communication_id: saved.id, preview: text.slice(0, 120) });
  }
  return { job: "review", queued: details.length, details };
}

/** Single-appointment review trigger backing POST /api/appointments/:id/review-request. */
export async function sendReviewForAppointment(appointmentId: number): Promise<DripDetail | null> {
  const appt = seedAppointments.find((a) => a.id === appointmentId);
  if (!appt || appt.status !== "completed") return null;
  const patient = getPatientById(appt.patient_id);
  if (!patient) return null;
  const campaign = campaigns.find((c) => c.id === 2)!;
  const text = renderTemplate(campaign.template_body, patient as any, {
    last_procedure: appt.procedure_type,
  });
  const saved = await saveOutboundCommunication({
    patient_id: appt.patient_id,
    type: "review_request",
    content: `${REVIEW_MARKER}#${appt.id} ${text}`,
  });
  return { patient_id: appt.patient_id, communication_id: saved.id, preview: text.slice(0, 120) };
}

/**
 * Scheduler â€” daily 9am lapsed drip + hourly 24h-anniversary review check.
 * Disabled with ENABLE_CRON=false (tests, hackathon manual demo).
 */
export function startDripCron(): void {
  if (process.env.ENABLE_CRON === "false") {
    console.log("[drip-worker] cron disabled (ENABLE_CRON=false)");
    return;
  }
  cron.schedule("0 9 * * *", async () => {
    console.log("[drip-worker] running daily lapsed drip (9am)");
    const r = await runLapsedDrip();
    console.log(`[drip-worker] lapsed drip queued=${r.queued}`);
  });
  cron.schedule("0 * * * *", async () => {
    const r = await runReviewDrip({ minAgeHours: 23, maxAgeHours: 25 });
    if (r.queued > 0) console.log(`[drip-worker] review drip queued=${r.queued}`);
  });
  console.log("[drip-worker] cron scheduled: lapsed daily 9am, review hourly (24h anniversary)");
}
