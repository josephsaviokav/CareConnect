import pg from "pg";
import { LAPSED_PATIENTS_SQL, getLapsedPatients } from "../services/segmentation.js";
import { seedPatients } from "./seed-data.js";

const { Pool } = pg;
const useMock = !process.env.DATABASE_URL || process.env.USE_MOCK_DB === "true";

let pool: pg.Pool | null = null;
if (!useMock) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

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
