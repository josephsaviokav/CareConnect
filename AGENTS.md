# AGENTS.md — CarrStack Automation (Dental Practice Marketing Automation)

> **Agent Context File for OpenCode.**
> Always read this file first before any `/build` operation.
> Work in discrete phases. Verify each phase before proceeding. Use Git snapshots to allow `/undo` and `/redo` if a module breaks.

## 1. Project Overview

**Project Name:** CarrStack Automation
**Hackathon Problem 2: Dental Practice Marketing Automation**

Develop an automated marketing solution for dental practices that can manage and act on patient data collected from multiple sources.

Key workflows to implement:
1. **Lead Conversion:** Identify and convert potential leads received through website enquiries or emails.
2. **Lapsed Patient Reactivation:** Engage existing patients who have not scheduled their next appointment and follow up with them.
3. **Post-Appointment Automation:** Automate post-appointment communication and encourage patients to leave reviews.

Goal: Complete, functional prototype for hackathon presentation — monorepo with backend + dashboard + AI email parser + drip automation.

## 2. Tech Stack & Tooling Profile

| Layer | Choice | Notes |
|---|---|---|
| Frontend Web | Next.js (App Router), React, Tailwind CSS | Staff dashboard in `apps/web` |
| Mobile Companion | Expo (React Native) | Staff notifications in `apps/mobile` |
| Backend Engine | Node.js with Fastify (fallback: Express) | REST API in `apps/api-server` |
| Database | PostgreSQL (strictly normalized) | Complex SQL JOINs for patient segmentation. Schema in `packages/db` |
| ORM | Prisma or Drizzle | Use Prisma by default unless repo already uses Drizzle |
| AI Integration | Lightweight LLM wrapper (Phi-3 / LLaMA via API or Ollama local) | Email intent parsing + auto-response in `packages/email-parser` |
| Shared Types | TypeScript interfaces | In `packages/shared-types` |
| Scheduler | node-cron or BullMQ worker | Drip / reactivation logic in backend |
| Mock SMTP | Nodemailer Ethereal / console mock | Simulate dispatch, do NOT send real email in prototype |
| Workspace Manager | npm workspaces | Root `package.json` |
| Agent Permissions | `opencode.json` | `"bash": "allow", "edit": "allow"` |

Agent tool rules:
- Use `bash` for: `npm init`, `npx create-next-app`, `npx prisma`, `psql`, git snapshots.
- Use `write` / `edit` for file creation and modifications.
- Never commit secrets. Use `.env` for `DATABASE_URL`, `LLM_API_KEY`, `SMTP_*`.
- After each phase, run typecheck / build and report status.

## 3. Directory Structure (Monorepo — Agent Must Create)

```plaintext
carrstack-automation/
├── AGENTS.md                 # This file — agent instructions
├── opencode.json             # Agent tool permissions ("bash": "allow", "edit": "allow")
├── package.json              # Root workspace manager (npm workspaces)
├── .env.example
├── apps/
│   ├── web/                  # Next.js staff dashboard (App Router + Tailwind)
│   │   ├── app/
│   │   │   ├── page.tsx      # Main dashboard: lapsed patients table
│   │   │   └── api/
│   ├── mobile/               # Expo app for staff notifications
│   └── api-server/           # Node.js backend (Fastify/Express)
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── patients.ts
│       │   │   ├── campaigns.ts
│       │   │   └── communications.ts
│       │   ├── services/
│       │   │   ├── segmentation.ts
│       │   │   └── drip-worker.ts
│       │   └── lib/db.ts
├── packages/
│   ├── db/                   # PostgreSQL schema and ORM configs
│   │   ├── schema.prisma     # or drizzle schema
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── email-parser/         # AI agent integration (Phi-3/LLaMA wrapper)
│   │   ├── src/
│   │   │   ├── parse.ts
│   │   │   ├── llm-client.ts
│   │   │   └── types.ts
│   └── shared-types/         # Shared TypeScript interfaces
│       ├── src/index.ts
│       └── package.json
```

Root `package.json` workspaces:
```json
{
  "name": "carrstack-automation",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

`opencode.json`:
```json
{
  "permissions": { "bash": "allow", "edit": "allow" }
}
```

## 4. Relational Database Schema

PostgreSQL, strictly normalized. Agent must create these 4 core tables + 1 extension for leads.

### 4.1 DDL (Prisma-style reference)

```sql
CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  last_visit_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('lead','active','lapsed','dormant')),
  source TEXT DEFAULT 'website', -- website, email, referral, walkin
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  procedure_type TEXT NOT NULL, -- cleaning, filling, ortho, implant, checkup
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE communications (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email','sms','review_request')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  content TEXT NOT NULL,
  intent TEXT, -- booking_request, post_op_complication, review_response, general, spam
  urgency TEXT DEFAULT 'low' CHECK (urgency IN ('low','medium','high')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL, -- "6-month lapsed", "post-appointment 24h", "new lead"
  template_body TEXT NOT NULL, -- with {{first_name}}, {{last_procedure}}, {{last_visit_date}} tokens
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Seed `campaigns` with:
1. `6-month lapsed` — `Hi {{first_name}}, it's been {{months_since_visit}} months since your {{last_procedure}}...`
2. `post-appointment 24h` — `Thanks {{first_name}} for visiting... Please leave a review: [link]`
3. `new lead follow-up` — `Hi {{first_name}}, thanks for your enquiry...`

### 4.2 Key Segmentation Query (Lapsed Patients)

Lapsed = `last_visit_date < NOW() - INTERVAL '6 months'` AND no `appointments` with `status='scheduled'` and `date > NOW()`:

```sql
SELECT p.*, MAX(a.date) AS last_appointment
FROM patients p
LEFT JOIN appointments a ON a.patient_id = p.id AND a.status = 'completed'
LEFT JOIN appointments upcoming ON upcoming.patient_id = p.id
  AND upcoming.status = 'scheduled' AND upcoming.date > NOW()
WHERE p.last_visit_date < NOW() - INTERVAL '6 months'
  AND upcoming.id IS NULL
  AND p.status IN ('active','lapsed')
GROUP BY p.id;
```

### 4.3 Shared TypeScript Interfaces (`packages/shared-types/src/index.ts`)

```ts
export type PatientStatus = 'lead'|'active'|'lapsed'|'dormant';
export type AppointmentStatus = 'scheduled'|'completed'|'cancelled'|'no_show';
export interface Patient { id:number; first_name:string; last_name:string; email:string; last_visit_date:string|null; status:PatientStatus; }
export interface Appointment { id:number; patient_id:number; date:string; procedure_type:string; status:AppointmentStatus; }
export interface Communication { id:number; patient_id:number; type:'email'|'sms'|'review_request'; direction:'inbound'|'outbound'; content:string; intent?:string; urgency?:'low'|'medium'|'high'; timestamp:string; }
export interface Campaign { id:number; name:string; trigger_event:string; template_body:string; }
export interface ParsedIntent { intent:'booking_request'|'post_op_complication'|'review_response'|'general'|'spam'; urgency:'low'|'medium'|'high'; patient_email?:string; summary:string; suggested_action:string; }
```

## 5. API Contracts (Backend Must Expose)

Base: `http://localhost:4000`

- `GET /api/patients/lapsed` → `Patient[]` (uses JOIN query §4.2)
- `GET /api/patients?status=lapsed` → filtered list
- `POST /api/campaigns/:id/trigger` body `{ patient_ids:number[] }` → `{ queued:number }`
- `POST /api/inbound-email` body `{ from:string; subject:string; body:string }` → `ParsedIntent`
- `GET /api/communications?patient_id=` → `Communication[]`
- `POST /api/appointments/:id/review-request` → triggers review template

## 6. Sequential Build Instructions for OpenCode

Execute strictly in order. Do NOT start next phase until current builds + typechecks. Git-snapshot after each phase for `/undo` / `/redo`.

### Phase 1: Foundation & Backend
> Prompt to agent:
> "Read AGENTS.md. Use the bash tool to initialize a Node.js backend in apps/api-server and configure a PostgreSQL connection in packages/db. Create the Patients and Appointments schemas. Expose a REST API endpoint that queries lapsed patients (last visit > 6 months ago with no upcoming appointments)."

Acceptance:
- [ ] `apps/api-server` Fastify/Express + TypeScript runs on :4000
- [ ] `packages/db` Prisma/Drizzle + migrations for `patients`, `appointments`
- [ ] `GET /api/patients/lapsed` returns correct filtered JSON
- [ ] Seed script with 10+ patients (mix active/lapsed/dormant/leads)

### Phase 2: Email AI Parsing Layer
> Prompt to agent:
> "In packages/email-parser, create a service that takes a mock inbound email string. Use an LLM API wrapper to parse the intent (e.g., 'booking request' or 'post-op complication') and return a structured JSON object containing the patient's intent and urgency."

Acceptance:
- [ ] `packages/email-parser/src/llm-client.ts` supports `OLLAMA_URL` or `LLM_API_KEY`, falls back to regex mock if no key
- [ ] `parse(email:string): ParsedIntent` returns `{intent, urgency, summary, suggested_action}`
- [ ] `POST /api/inbound-email` wired in backend, stores row in `communications`
- [ ] Unit test with 3 mock emails (booking, complication→high urgency, spam)

Example I/O:
Input: `"Hi, my tooth hurts badly after extraction yesterday, bleeding won't stop"`
Output: `{"intent":"post_op_complication","urgency":"high","summary":"...","suggested_action":"alert staff immediately"}`

### Phase 3: Frontend Dashboard Integration
> Prompt to agent:
> "Navigate to apps/web. Initialize a Next.js App Router project with Tailwind CSS. Create a main dashboard page that fetches data from the backend's lapsed patient endpoint. Display the data in a responsive table, and add a 'Trigger Reactivation Campaign' button next to each row."

Acceptance:
- [ ] `apps/web` Next.js App Router + Tailwind builds
- [ ] `app/page.tsx` fetches `GET /api/patients/lapsed`, responsive table (name, email, last visit, status)
- [ ] `Trigger Reactivation Campaign` button per row → `POST /api/campaigns/:id/trigger`
- [ ] Tabs/sections for 3 workflows: Leads / Lapsed / Post-Appointment Reviews

### Phase 4: Automated Drip Logic
> Prompt to agent:
> "In the Node.js backend, create a scheduled cron job or worker service. Write the logic that automatically pulls lapsed patients from the DB and generates a personalized email payload using the parsed treatment history, simulating the dispatch via a mock SMTP service."

Acceptance:
- [ ] `apps/api-server/src/services/drip-worker.ts` cron (e.g. daily 9am) queries lapsed + renders `campaigns.template_body` tokens
- [ ] Mock SMTP (console/Ethereal) logs payload, writes `communications` outbound row
- [ ] Post-appointment 24h job: `completed` appointments → review request email
- [ ] `GET /api/communications?patient_id=` shows full loop for demo

## 7. Demo Script (Hackathon Presentation)

1. Show dashboard lapsed table → click Trigger → show mock email in console + `communications` row.
2. Paste inbound email → show `ParsedIntent` JSON → auto booking created.
3. Show post-appointment review automation.
4. Emphasize normalized SQL JOINs + LLM parsing + drip worker.

## 8. Agent Operating Rules

1. Always re-read `AGENTS.md` at start of each phase.
2. Keep changes scoped to current phase to preserve `/undo`.
3. Prefer editing existing files over creating new ones.
4. Run `npx tsc --noEmit` and framework build before marking phase done.
5. If blocked (no DB, no LLM key), use mocks/fallbacks and note in output — do not halt.
6. Never output secrets. Use `.env.example`.
