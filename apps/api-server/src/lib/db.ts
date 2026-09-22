import { LAPSED_PATIENTS_SQL, getLapsedPatients } from "../services/segmentation.js";
import { seedAppointments, seedPatients } from "./seed-data.js";
import { createPool } from "./pg.js";

const pool = createPool();

export async function queryLapsedPatients() {
  if (pool) {
    const { rows } = await pool.query(LAPSED_PATIENTS_SQL);
    return { source: "postgres" as const, data: rows };
  }
  // Mock fallback for hackathon demo (no local Postgres)
  return { source: "mock" as const, data: getLapsedPatients() };
}

export async function queryPatientsByStatus(status?: string) {
  if (pool) {
    if (status) {
      const { rows } = await pool.query("SELECT * FROM patients WHERE status = $1 ORDER BY id", [status]);
      return rows;
    }
    const { rows } = await pool.query("SELECT * FROM patients ORDER BY id");
    return rows;
  }
  const filtered = status ? seedPatients.filter((p) => p.status === status) : seedPatients;
  return filtered;
}

export async function queryPatientById(id: number) {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM patients WHERE id = $1", [id]);
    return rows[0] || null;
  }
  return seedPatients.find((p) => p.id === id) || null;
}

export async function queryPatientByEmail(email: string) {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM patients WHERE LOWER(email) = LOWER($1)", [email]);
    return rows[0] || null;
  }
  return seedPatients.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function queryLastProcedure(patientId: number): Promise<string> {
  if (pool) {
    const { rows } = await pool.query(
      "SELECT procedure_type FROM appointments WHERE patient_id = $1 AND status = 'completed' ORDER BY date DESC LIMIT 1",
      [patientId]
    );
    return rows[0]?.procedure_type || "checkup";
  }
  const done = seedAppointments
    .filter((a) => a.patient_id === patientId && a.status === "completed")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return done[0]?.procedure_type || "checkup";
}

export async function queryAppointments() {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM appointments ORDER BY date DESC");
    return rows;
  }
  return seedAppointments;
}
