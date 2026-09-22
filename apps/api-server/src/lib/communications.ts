import pg from "pg";
import { seedPatients } from "./seed-data.js";

export interface StoredCommunication {
  id: number;
  patient_id: number;
  patient_email?: string;
  type: string;
  direction: "inbound" | "outbound";
  content: string;
  intent?: string;
  urgency?: string;
  timestamp: string;
}

const useMock = !process.env.DATABASE_URL || process.env.USE_MOCK_DB === "true";
let pool: pg.Pool | null = null;
if (!useMock && process.env.DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

// In-memory fallback for hackathon demo (no local Postgres)
const memory: StoredCommunication[] = [];
let nextId = 1;

export function resolvePatientIdByEmail(email: string): number | null {
  const found = seedPatients.find((p) => p.email.toLowerCase() === email.toLowerCase());
  return found ? found.id : null;
}

export async function saveInboundCommunication(args: {
  patient_id: number | null;
  patient_email: string;
  content: string;
  intent: string;
  urgency: string;
}): Promise<StoredCommunication> {
  if (pool) {
    // Postgres requires a valid patient_id FK — caller must resolve or create a lead first.
    const { rows } = await pool.query(
      `INSERT INTO communications (patient_id, type, direction, content, intent, urgency)
       VALUES ($1, 'email', 'inbound', $2, $3, $4) RETURNING *`,
      [args.patient_id, args.content, args.intent, args.urgency]
    );
    const r = rows[0];
    return {
      id: r.id, patient_id: r.patient_id, type: r.type, direction: r.direction,
      content: r.content, intent: r.intent, urgency: r.urgency,
      timestamp: new Date(r.timestamp).toISOString(),
    };
  }
  const rec: StoredCommunication = {
    id: nextId++,
    patient_id: args.patient_id ?? 0,
    patient_email: args.patient_email,
    type: "email",
    direction: "inbound",
    content: args.content,
    intent: args.intent,
    urgency: args.urgency,
    timestamp: new Date().toISOString(),
  };
  memory.push(rec);
  return rec;
}

export async function listCommunications(patient_id?: number): Promise<StoredCommunication[]> {
  if (pool) {
    if (patient_id !== undefined) {
      const { rows } = await pool.query("SELECT * FROM communications WHERE patient_id = $1 ORDER BY timestamp DESC", [patient_id]);
      return rows;
    }
    const { rows } = await pool.query("SELECT * FROM communications ORDER BY timestamp DESC LIMIT 100");
    return rows;
  }
  const sorted = [...memory].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  if (patient_id !== undefined) return sorted.filter((c) => c.patient_id === patient_id);
  return sorted;
}
