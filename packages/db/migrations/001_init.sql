-- careconnect initial migration: strictly normalized schema
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  last_visit_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('lead','active','lapsed','dormant')),
  source TEXT DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  procedure_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communications (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email','sms','review_request')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  content TEXT NOT NULL,
  intent TEXT,
  urgency TEXT DEFAULT 'low' CHECK (urgency IN ('low','medium','high')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  template_body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed campaigns
INSERT INTO campaigns (name, trigger_event, template_body) VALUES
('6-month lapsed', '6-month lapsed', 'Hi {{first_name}}, it''s been {{months_since_visit}} months since your {{last_procedure}} on {{last_visit_date}}. Book your next checkup: [link]'),
('post-appointment 24h', 'post-appointment 24h', 'Thanks {{first_name}} for visiting us for {{last_procedure}}. Please leave a review: [link]'),
('new lead follow-up', 'new lead', 'Hi {{first_name}}, thanks for your enquiry via {{source}}. We would love to book you in for {{interest}}. Reply to confirm.')
ON CONFLICT DO NOTHING;
