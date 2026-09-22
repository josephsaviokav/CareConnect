-- Generated seed. Re-run this script to refresh dates, then re-execute.

INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (1, 'Alice', 'Smith', 'alice@example.com', '555-0101', '2026-01-22', 'lapsed', 'website') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (2, 'Bob', 'Jones', 'bob@example.com', '555-0102', '2025-12-22', 'lapsed', 'email') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (3, 'Carol', 'White', 'carol@example.com', '555-0103', '2026-07-22', 'active', 'walkin') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (4, 'David', 'Brown', 'david@example.com', '555-0104', '2025-09-22', 'dormant', 'referral') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (5, 'Eva', 'Green', 'eva@example.com', '555-0105', '2026-02-22', 'lapsed', 'website') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (6, 'Frank', 'Black', 'frank@example.com', '555-0106', '2026-08-22', 'active', 'website') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (7, 'Grace', 'Lee', 'grace@example.com', '555-0107', NULL, 'lead', 'website') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (8, 'Henry', 'Kim', 'henry@example.com', '555-0108', '2025-11-22', 'lapsed', 'email') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (9, 'Ivy', 'Patel', 'ivy@example.com', '555-0109', '2026-06-22', 'active', 'referral') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (10, 'Jack', 'Wilson', 'jack@example.com', '555-0110', '2025-07-22', 'lapsed', 'walkin') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (11, 'Karen', 'Moore', 'karen@example.com', '555-0111', '2026-02-22', 'active', 'website') ON CONFLICT(id) DO NOTHING;
INSERT INTO patients (id, first_name, last_name, email, phone, last_visit_date, status, source) VALUES (12, 'Leo', 'Taylor', 'leo@example.com', '555-0112', NULL, 'lead', 'email') ON CONFLICT(id) DO NOTHING;

INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (1, 1, '2026-01-25T16:47:52.678Z', 'cleaning', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (2, 2, '2025-12-26T16:47:52.678Z', 'filling', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (3, 3, '2026-07-24T16:47:52.678Z', 'checkup', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (4, 3, '2026-10-02T16:47:52.678Z', 'cleaning', 'scheduled') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (5, 5, '2026-02-24T16:47:52.678Z', 'ortho', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (6, 6, '2026-08-23T16:47:52.678Z', 'cleaning', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (7, 8, '2025-11-26T16:47:52.678Z', 'implant', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (8, 9, '2026-06-24T16:47:52.678Z', 'checkup', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (9, 10, '2025-07-29T16:47:52.678Z', 'cleaning', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (10, 11, '2026-02-24T16:47:52.678Z', 'cleaning', 'completed') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (11, 11, '2026-09-27T16:47:52.678Z', 'checkup', 'scheduled') ON CONFLICT(id) DO NOTHING;
INSERT INTO appointments (id, patient_id, date, procedure_type, status) VALUES (12, 4, '2025-09-22T16:47:52.678Z', 'filling', 'completed') ON CONFLICT(id) DO NOTHING;
