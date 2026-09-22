-- CareConnect D1 schema (SQLite). Applied via:
--   wrangler d1 execute careconnect --local  --file=./migrations/0001_init.sql
--   wrangler d1 execute careconnect --remote --file=./migrations/0001_init.sql
-- Dates stored as ISO TEXT (YYYY-MM-DD or full ISO). No Postgres types.

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  last_visit_date TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('lead','active','lapsed','dormant')),
  source TEXT DEFAULT 'website',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  procedure_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email','sms','review_request')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  content TEXT NOT NULL,
  intent TEXT,
  urgency TEXT DEFAULT 'low' CHECK (urgency IN ('low','medium','high')),
  timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  template_body TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO campaigns (id, name, trigger_event, template_body) VALUES
(1, '6-month lapsed', '6-month lapsed', 'Hi {{first_name}}, it''s been {{months_since_visit}} months since your {{last_procedure}} on {{last_visit_date}}. Book your next checkup: [link]'),
(2, 'post-appointment 24h', 'post-appointment 24h', 'Thanks {{first_name}} for visiting us for {{last_procedure}}. Please leave a review: [link]'),
(3, 'new lead follow-up', 'new lead', 'Hi {{first_name}}, thanks for your enquiry via {{source}}. We would love to book you in. Reply to confirm.')
ON CONFLICT(id) DO NOTHING;
