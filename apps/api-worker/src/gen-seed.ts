// One-shot: emits apps/api-worker/migrations/0002_seed.sql from canonical seed data.
import { writeFileSync } from "node:fs";
import { seedPatients, seedAppointments } from "../../api-server/src/lib/seed-data.js";

const esc = (v: unknown) =>
  v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

const lines: string[] = ["-- Generated seed. Re-run this script to refresh dates, then re-execute.", ""];
for (const p of seedPatients as any[]) {
  lines.push(
    `INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (${p.id}, ${esc(p.first_name)}, ${esc(p.last_name)}, ${esc(p.email)}, ${esc(p.phone)}, ${esc(p.last_visit_date)}, ${esc(p.status)}, ${esc(p.source)}) ON CONFLICT(id) DO NOTHING;`
  );
}
lines.push("");
for (const a of seedAppointments as any[]) {
  lines.push(
    `INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (${a.id}, ${a.patient_id}, ${esc(a.date)}, ${esc(a.procedure_type)}, ${esc(a.status)}) ON CONFLICT(id) DO NOTHING;`
  );
}
lines.push("");
writeFileSync(new URL("../migrations/0002_seed.sql", import.meta.url), lines.join("\n"));
console.log(`wrote ${seedPatients.length} patients, ${seedAppointments.length} appointments`);
