import { Hono } from "hono";
import { cors } from "hono/cors";
import { parseInboundEmail, renderTemplate } from "./logic.js";

export interface Env {
  DB: D1Database;
  OLLAMA_URL?: string;
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  OLLAMA_MODEL?: string;
}

const LAPSED_SQL = `
SELECT p.* FROM patients p
WHERE p.last_visit_date IS NOT NULL
  AND p.last_visit_date < date('now','-6 months')
  AND p.status IN ('active','lapsed')
  AND NOT EXISTS (
    SELECT 1 FROM appointments u
    WHERE u.patient_id = p.id
      AND u.status = 'scheduled'
      AND u.date > strftime('%Y-%m-%dT%H:%M:%fZ','now')
  )
ORDER BY p.id`;

const toDateOnly = (v: unknown): string | null =>
  v ? new Date(v as string).toISOString().split("T")[0] : null;

async function alreadySent(db: D1Database, patient_id: number, marker: string, since: Date): Promise<boolean> {
  const { results } = await db
    .prepare("SELECT timestamp FROM communications WHERE patient_id = ? AND direction = 'outbound' AND content LIKE ?")
    .bind(patient_id, `%${marker}%`)
    .all<{ timestamp: string }>();
  return results.some((r) => new Date(r.timestamp) >= since);
}

async function runLapsedDrip(env: Env, now: Date = new Date()) {
  const campaign = await env.DB.prepare("SELECT * FROM campaigns WHERE id = 1 AND is_active = 1").first<any>();
  if (!campaign) return { job: "lapsed", queued: 0, details: [] };
  const { results: lapsed } = await env.DB.prepare(LAPSED_SQL).all<any>();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const details: Array<{ patient_id: number; communication_id: number; preview: string }> = [];
  for (const p of lapsed) {
    if (await alreadySent(env.DB, p.id, "[6-month lapsed]", weekAgo)) continue;
    const last = await env.DB.prepare(
      "SELECT procedure_type FROM appointments WHERE patient_id = ? AND status = 'completed' ORDER BY date DESC LIMIT 1"
    ).bind(p.id).first<{ procedure_type: string }>();
    const text = renderTemplate(
      campaign.template_body,
      { first_name: p.first_name, last_visit_date: toDateOnly(p.last_visit_date), source: p.source },
      { last_procedure: last?.procedure_type || "checkup" }
    );
    const saved = await env.DB.prepare(
      "INSERT INTO communications (patient_id, type, direction, content, urgency) VALUES (?, 'email', 'outbound', ?, 'low') RETURNING id"
    ).bind(p.id, `[6-month lapsed] ${text}`).first<{ id: number }>();
    console.log(`[mock-smtp] to patient ${p.id}: ${text.slice(0, 160)}`);
    details.push({ patient_id: p.id, communication_id: saved!.id, preview: text.slice(0, 120) });
  }
  return { job: "lapsed", queued: details.length, details };
}

async function runReviewDrip(env: Env, minAgeHours = 0, maxAgeHours = 24, now: Date = new Date()) {
  const campaign = await env.DB.prepare("SELECT * FROM campaigns WHERE id = 2 AND is_active = 1").first<any>();
  if (!campaign) return { job: "review", queued: 0, details: [] };
  const { results: all } = await env.DB.prepare("SELECT * FROM appointments ORDER BY date DESC").all<any>();
  const due = all
    .filter((a) => a.status === "completed")
    .filter((a) => {
      const ageH = (now.getTime() - new Date(a.date).getTime()) / 3600000;
      return ageH >= minAgeHours && ageH <= maxAgeHours;
    });
  const details: Array<{ patient_id: number; communication_id: number; preview: string }> = [];
  for (const appt of due) {
    const patient = await env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(appt.patient_id).first<any>();
    if (!patient) continue;
    if (await alreadySent(env.DB, appt.patient_id, `[post-appointment 24h]#${appt.id}`, new Date(appt.date))) continue;
    const text = renderTemplate(
      campaign.template_body,
      { first_name: patient.first_name, last_visit_date: toDateOnly(patient.last_visit_date), source: patient.source },
      { last_procedure: appt.procedure_type }
    );
    const saved = await env.DB.prepare(
      "INSERT INTO communications (patient_id, type, direction, content, urgency) VALUES (?, 'review_request', 'outbound', ?, 'low') RETURNING id"
    ).bind(appt.patient_id, `[post-appointment 24h]#${appt.id} ${text}`).first<{ id: number }>();
    console.log(`[mock-smtp] to patient ${appt.patient_id}: ${text.slice(0, 160)}`);
    details.push({ patient_id: appt.patient_id, communication_id: saved!.id, preview: text.slice(0, 120) });
  }
  return { job: "review", queued: details.length, details };
}

const app = new Hono<{ Bindings: Env }>();
app.use("/*", cors());

app.get("/api/health", (c) => c.json({ ok: true, runtime: "cloudflare", time: new Date().toISOString() }));

app.get("/api/patients/lapsed", async (c) => {
  const { results } = await c.env.DB.prepare(LAPSED_SQL).all();
  return c.json(results);
});

app.get("/api/patients", async (c) => {
  const status = c.req.query("status");
  const { results } = status
    ? await c.env.DB.prepare("SELECT * FROM patients WHERE status = ? ORDER BY id").bind(status).all()
    : await c.env.DB.prepare("SELECT * FROM patients ORDER BY id").all();
  return c.json(results);
});

app.get("/api/campaigns", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM campaigns ORDER BY id").all();
  return c.json(results);
});

app.post("/api/campaigns/:id/trigger", async (c) => {
  const campaign = await c.env.DB.prepare("SELECT * FROM campaigns WHERE id = ? AND is_active = 1")
    .bind(Number(c.req.param("id"))).first<any>();
  if (!campaign) return c.json({ error: "Campaign not found or inactive" }, 404);
  const body: { patient_ids?: number[] } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(body.patient_ids) || body.patient_ids.length === 0) {
    return c.json({ error: "Provide patient_ids:number[]" }, 400);
  }
  let queued = 0;
  for (const pid of body.patient_ids) {
    const patient = await c.env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(pid).first<any>();
    if (!patient) continue;
    const last = await c.env.DB.prepare(
      "SELECT procedure_type FROM appointments WHERE patient_id = ? AND status = 'completed' ORDER BY date DESC LIMIT 1"
    ).bind(pid).first<{ procedure_type: string }>();
    const text = renderTemplate(
      campaign.template_body,
      { first_name: patient.first_name, last_visit_date: toDateOnly(patient.last_visit_date), source: patient.source },
      { last_procedure: last?.procedure_type || "checkup" }
    );
    await c.env.DB.prepare(
      "INSERT INTO communications (patient_id, type, direction, content, urgency) VALUES (?, 'email', 'outbound', ?, 'low')"
    ).bind(pid, `[${campaign.name}] ${text}`).run();
    console.log(`[mock-smtp] to patient ${pid}: ${text.slice(0, 160)}`);
    queued++;
  }
  return c.json({ queued });
});

app.post("/api/inbound-email", async (c) => {
  const body: { from?: string; subject?: string; body?: string } = await c.req.json().catch(() => ({}));
  if (!body.from || !body.body) return c.json({ error: "Missing required fields: from, body" }, 400);
  const parsed = await parseInboundEmail({ from: body.from, subject: body.subject || "", body: body.body }, c.env);
  let patient = await c.env.DB.prepare("SELECT * FROM patients WHERE LOWER(email) = LOWER(?)").bind(body.from).first<any>();
  if (!patient) {
    const handle = body.from.split("@")[0].replace(/[^a-z0-9._-]+/gi, "") || "unknown";
    patient = await c.env.DB.prepare(
      "INSERT INTO patients (first_name, last_name, email, status, source) VALUES (?, '', ?, 'lead', 'email') ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING *"
    ).bind(handle, body.from).first<any>();
  }
  const saved = await c.env.DB.prepare(
    "INSERT INTO communications (patient_id, type, direction, content, intent, urgency) VALUES (?, 'email', 'inbound', ?, ?, ?) RETURNING id"
  ).bind(patient.id, `Subject: ${body.subject || ""}\n${body.body}`, parsed.intent, parsed.urgency).first<{ id: number }>();
  return c.json({ ...parsed, patient_email: body.from, patient_id: patient.id, communication_id: saved!.id });
});

app.get("/api/communications", async (c) => {
  const pid = c.req.query("patient_id");
  const { results } = pid
    ? await c.env.DB.prepare("SELECT * FROM communications WHERE patient_id = ? ORDER BY timestamp DESC").bind(Number(pid)).all()
    : await c.env.DB.prepare("SELECT * FROM communications ORDER BY timestamp DESC LIMIT 100").all();
  return c.json(results);
});

// ---- Auth (demo-grade: PBKDF2-SHA256, 100k iters; use a real IdP in production) ----
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

async function verifyPassword(password: string, saltHex: string, hashHex: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const got = [...new Uint8Array(bits)].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (got.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

app.post("/api/auth/login", async (c) => {
  const body: { email?: string; password?: string } = await c.req.json().catch(() => ({}));
  if (!body.email || !body.password) return c.json({ error: "Email and password required" }, 400);
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").bind(body.email).first<any>();
  if (!user || !(await verifyPassword(body.password, user.salt, user.password_hash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  const token = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
  const expires_at = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  await c.env.DB.prepare("INSERT INTO sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, user.id, user.role, expires_at).run();
  return c.json({ token, role: user.role, name: user.name, email: user.email, patient_id: user.patient_id, expires_at });
});

app.get("/api/auth/me", async (c) => {
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return c.json({ error: "Missing token" }, 401);
  const s = await c.env.DB.prepare(
    "SELECT s.role, s.expires_at, u.name, u.email, u.patient_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?"
  ).bind(token).first<any>();
  if (!s || new Date(s.expires_at).getTime() < Date.now()) {
    return c.json({ error: "Invalid or expired session" }, 401);
  }
  return c.json({ role: s.role, name: s.name, email: s.email, patient_id: s.patient_id, expires_at: s.expires_at });
});

app.post("/api/auth/logout", async (c) => {
  const auth = c.req.header("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return c.json({ ok: true });
});

app.get("/api/appointments", async (c) => {
  const status = c.req.query("status");
  const patient_id = c.req.query("patient_id");
  let sql = "SELECT * FROM appointments";
  const conds: string[] = [];
  const args: unknown[] = [];
  if (status) { conds.push("status = ?"); args.push(status); }
  if (patient_id) { conds.push("patient_id = ?"); args.push(Number(patient_id)); }
  if (conds.length) sql += " WHERE " + conds.join(" AND ");
  sql += " ORDER BY date DESC";
  const { results } = await c.env.DB.prepare(sql).bind(...args).all();
  return c.json(results);
});

app.post("/api/appointments/:id/review-request", async (c) => {
  const appt = await c.env.DB.prepare("SELECT * FROM appointments WHERE id = ?").bind(Number(c.req.param("id"))).first<any>();
  if (!appt || appt.status !== "completed") return c.json({ error: "Appointment not found or not completed" }, 404);
  const patient = await c.env.DB.prepare("SELECT * FROM patients WHERE id = ?").bind(appt.patient_id).first<any>();
  if (!patient) return c.json({ error: "Patient not found" }, 404);
  const campaign = await c.env.DB.prepare("SELECT * FROM campaigns WHERE id = 2").first<any>();
  const text = renderTemplate(
    campaign.template_body,
    { first_name: patient.first_name, last_visit_date: toDateOnly(patient.last_visit_date), source: patient.source },
    { last_procedure: appt.procedure_type }
  );
  const saved = await c.env.DB.prepare(
    "INSERT INTO communications (patient_id, type, direction, content, urgency) VALUES (?, 'review_request', 'outbound', ?, 'low') RETURNING id"
  ).bind(appt.patient_id, `[post-appointment 24h]#${appt.id} ${text}`).first<{ id: number }>();
  return c.json({ queued: 1, patient_id: appt.patient_id, communication_id: saved!.id, preview: text.slice(0, 120) });
});

app.post("/api/drip/run", async (c) => {
  const body: { job?: string; minAgeHours?: number; maxAgeHours?: number } = await c.req.json().catch(() => ({}));
  const job = body.job || "all";
  const out: Record<string, unknown> = {};
  if (job === "lapsed" || job === "all") out.lapsed = await runLapsedDrip(c.env);
  if (job === "review" || job === "all") {
    out.review = await runReviewDrip(c.env, body.minAgeHours ?? 0, body.maxAgeHours ?? 24);
  }
  return c.json(out);
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // "0 9 * * *" → lapsed drip; "0 * * * *" → 24h-anniversary review check
    if (event.cron === "0 9 * * *") {
      ctx.waitUntil(runLapsedDrip(env).then((r) => console.log(`[drip] lapsed queued=${r.queued}`)));
    } else {
      ctx.waitUntil(
        runReviewDrip(env, 23, 25).then((r) => { if (r.queued > 0) console.log(`[drip] review queued=${r.queued}`); })
      );
    }
  },
};
