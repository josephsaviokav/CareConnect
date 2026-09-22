import { LAPSED_PATIENTS_SQL, getLapsedPatients } from "../services/segmentation.js";
import { seedPatients } from "./seed-data.js";
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
