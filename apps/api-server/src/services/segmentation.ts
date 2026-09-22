import type { Patient, Appointment } from "@carrstack/shared-types";
import { seedPatients, seedAppointments } from "../lib/seed-data.js";

// Re-export seed for API use (mock fallback when no DATABASE_URL)
export { seedPatients, seedAppointments };

/**
 * Core segmentation logic — mirrors the SQL JOIN in AGENTS.md §4.2:
 * Lapsed = last_visit_date < NOW() - 6 months AND no upcoming scheduled appointment
 * AND status IN ('active','lapsed')
 */
export function getLapsedPatients(
  patients: Patient[] = seedPatients,
  appointments: Appointment[] = seedAppointments,
  now: Date = new Date()
): Patient[] {
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const upcomingByPatient = new Set<number>();
  for (const a of appointments) {
    if (a.status === "scheduled" && new Date(a.date) > now) {
      upcomingByPatient.add(a.patient_id);
    }
  }

  return patients.filter((p) => {
    if (!["active", "lapsed"].includes(p.status)) return false;
    if (!p.last_visit_date) return false;
    if (!(new Date(p.last_visit_date) < sixMonthsAgo)) return false;
    if (upcomingByPatient.has(p.id)) return false;
    return true;
  });
}

// Exact SQL used when Postgres is available (AGENTS.md §4.2)
export const LAPSED_PATIENTS_SQL = `
SELECT p.*, MAX(a.date) AS last_appointment
FROM patients p
LEFT JOIN appointments a ON a.patient_id = p.id AND a.status = 'completed'
LEFT JOIN appointments upcoming ON upcoming.patient_id = p.id
  AND upcoming.status = 'scheduled' AND upcoming.date > NOW()
WHERE p.last_visit_date < NOW() - INTERVAL '6 months'
  AND upcoming.id IS NULL
  AND p.status IN ('active','lapsed')
GROUP BY p.id;
`;
