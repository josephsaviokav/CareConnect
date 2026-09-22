// Seed runner: inserts seed-data into Postgres if DATABASE_URL set,
// otherwise prints mock summary. Run via: npm run seed --workspace=@careconnect/db
import pg from "pg";
import { seedPatients, seedAppointments } from "./seed-data.js";

const url = process.env.DATABASE_URL;
if (!url || process.env.USE_MOCK_DB === "true") {
  console.log(`Mock seed: ${seedPatients.length} patients, ${seedAppointments.length} appointments`);
  console.log("Lapsed would be: " + seedPatients.filter(p => p.status === "lapsed").map(p => p.email).join(", "));
  process.exit(0);
}

const needsSSL = process.env.PGSSL === "true" || /supabase\.co/.test(url || "");
const pool = new pg.Pool({
  connectionString: url,
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
});
for (const p of seedPatients) {
  await pool.query(
    `INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, email=EXCLUDED.email, phone=EXCLUDED.phone, last_visit_date=EXCLUDED.last_visit_date, status=EXCLUDED.status, source=EXCLUDED.source`,
    [p.id, p.first_name, p.last_name, p.email, (p as any).phone ?? null, (p as any).last_visit_date ?? null, p.status, (p as any).source ?? "website"]
  );
}
for (const a of seedAppointments) {
  await pool.query(
    `INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO NOTHING`,
    [a.id, a.patient_id, a.date, a.procedure_type, a.status]
  );
}
console.log("Seeded Postgres OK");
await pool.end();
