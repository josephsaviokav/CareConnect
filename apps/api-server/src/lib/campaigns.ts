import { queryLastProcedure, queryPatientById } from "./db.js";

export interface Campaign {
  id: number;
  name: string;
  trigger_event: string;
  template_body: string;
  is_active: boolean;
}

// Seed mirrors AGENTS.md §4.1 + packages/db/migrations/001_init.sql
export const campaigns: Campaign[] = [
  {
    id: 1,
    name: "6-month lapsed",
    trigger_event: "6-month lapsed",
    template_body: "Hi {{first_name}}, it's been {{months_since_visit}} months since your {{last_procedure}} on {{last_visit_date}}. Book your next checkup: [link]",
    is_active: true,
  },
  {
    id: 2,
    name: "post-appointment 24h",
    trigger_event: "post-appointment 24h",
    template_body: "Thanks {{first_name}} for visiting us for {{last_procedure}}. Please leave a review: [link]",
    is_active: true,
  },
  {
    id: 3,
    name: "new lead follow-up",
    trigger_event: "new lead",
    template_body: "Hi {{first_name}}, thanks for your enquiry via {{source}}. We would love to book you in. Reply to confirm.",
    is_active: true,
  },
];

export function renderTemplate(
  body: string,
  patient: { first_name: string; last_visit_date?: string | null; source?: string },
  extra: { last_procedure?: string } = {}
): string {
  const lastVisit = patient.last_visit_date || "recently";
  let months = "6+";
  if (patient.last_visit_date) {
    const diff = Date.now() - new Date(patient.last_visit_date).getTime();
    months = String(Math.max(0, Math.round(diff / (30 * 24 * 3600 * 1000))));
  }
  return body
    .replaceAll("{{first_name}}", patient.first_name)
    .replaceAll("{{last_procedure}}", extra.last_procedure || "checkup")
    .replaceAll("{{last_visit_date}}", lastVisit)
    .replaceAll("{{months_since_visit}}", months)
    .replaceAll("{{source}}", patient.source || "website")
    .replaceAll("{{interest}}", extra.last_procedure || "a checkup");
}

export function lastProcedureFor(patientId: number): Promise<string> {
  return queryLastProcedure(patientId);
}

export function getPatientById(id: number) {
  return queryPatientById(id);
}
