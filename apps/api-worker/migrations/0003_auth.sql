-- CareConnect auth (D1). Demo-grade password storage: PBKDF2-SHA256,
-- 100k iterations, 16-byte hex salt. Good for prototype; use a real
-- identity provider before production.
-- Demo logins: clinic@careconnect.demo / clinic123  (clinic)
--              alice@example.com / patient123       (patient, linked to id 1)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('clinic','patient')),
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

INSERT INTO users (id, email, name, role, patient_id, salt, password_hash) VALUES
(1, 'clinic@careconnect.demo', 'Dr. Lauren Park', 'clinic', NULL, 'a7041bcf2007538b839e5405af31a89e', '28812f62ea2ec3c00c0e0701d431656e00f7ba9d9aadda67b94dfad47e505c64'),
(2, 'alice@example.com', 'Alice Smith', 'patient', 1, '7c5dc97289cc433e75764726a1235dd8', '60dd8201340336b028be67f9bbaa2b458b64c7a7973c825a34a7f3cb95ee9fdd')
ON CONFLICT(id) DO NOTHING;
