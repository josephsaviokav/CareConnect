import { createPool } from "./pg.js";
import { queryPatientByEmail } from "./db.js";

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

const pool = createPool();

// In-memory fallback for hackathon demo (no local Postgres)
const memory: StoredCommunication[] = [];
let nextId = 1;

export async function resolvePatientIdByEmail(email: string): Promise<number | null> {
  const found = await queryPatientByEmail(email);
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
    // Unknown senders become leads so the FK always resolves (cloud mode).
    let pid = args.patient_id;
    if (!pid) {
      const handle = args.patient_email.split("@")[0].replace(/[^a-z0-9._-]+/gi, "") || "unknown";
      const { rows } = await pool.query(
        `INSERT INTO patients (first_name, last_name, email, status, source)
         VALUES ($1, '', $2, 'lead', 'email')
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [handle, args.patient_email]
      );
      pid = rows[0].id;
    }
    const { rows } = await pool.query(
      `INSERT INTO communications (patient_id, type, direction, content, intent, urgency)
       VALUES ($1, 'email', 'inbound', $2, $3, $4) RETURNING *`,
      [pid, args.content, args.intent, args.urgency]
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

export async function saveOutboundCommunication(args: {
  patient_id: number;
  content: string;
  type?: string;
}): Promise<StoredCommunication> {
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO communications (patient_id, type, direction, content, urgency)
       VALUES ($1, $2, 'outbound', $3, 'low') RETURNING *`,
      [args.patient_id, args.type || "email", args.content]
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
    patient_id: args.patient_id,
    type: args.type || "email",
    direction: "outbound",
    content: args.content,
    urgency: "low",
    timestamp: new Date().toISOString(),
  };
  memory.push(rec);
  // Mock SMTP dispatch — visible in api-server console for hackathon demo
  console.log(`[mock-smtp] to patient ${args.patient_id}: ${args.content.slice(0, 160)}`);
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
