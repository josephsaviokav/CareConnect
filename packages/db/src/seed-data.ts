import type { Patient, Appointment } from "@careconnect/shared-types";

// Helper to build dates relative to now for realistic seed
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
};
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const seedPatients: Patient[] = [
  { id: 1, first_name: "Alice", last_name: "Smith", email: "alice@example.com", phone: "555-0101", last_visit_date: monthsAgo(8), status: "lapsed", source: "website" },
  { id: 2, first_name: "Bob", last_name: "Jones", email: "bob@example.com", phone: "555-0102", last_visit_date: monthsAgo(9), status: "lapsed", source: "email" },
  { id: 3, first_name: "Carol", last_name: "White", email: "carol@example.com", phone: "555-0103", last_visit_date: monthsAgo(2), status: "active", source: "walkin" },
  { id: 4, first_name: "David", last_name: "Brown", email: "david@example.com", phone: "555-0104", last_visit_date: monthsAgo(12), status: "dormant", source: "referral" },
  { id: 5, first_name: "Eva", last_name: "Green", email: "eva@example.com", phone: "555-0105", last_visit_date: monthsAgo(7), status: "lapsed", source: "website" },
  { id: 6, first_name: "Frank", last_name: "Black", email: "frank@example.com", phone: "555-0106", last_visit_date: monthsAgo(1), status: "active", source: "website" },
  { id: 7, first_name: "Grace", last_name: "Lee", email: "grace@example.com", phone: "555-0107", last_visit_date: null, status: "lead", source: "website" },
  { id: 8, first_name: "Henry", last_name: "Kim", email: "henry@example.com", phone: "555-0108", last_visit_date: monthsAgo(10), status: "lapsed", source: "email" },
  { id: 9, first_name: "Ivy", last_name: "Patel", email: "ivy@example.com", phone: "555-0109", last_visit_date: monthsAgo(3), status: "active", source: "referral" },
  { id: 10, first_name: "Jack", last_name: "Wilson", email: "jack@example.com", phone: "555-0110", last_visit_date: monthsAgo(14), status: "lapsed", source: "walkin" },
  { id: 11, first_name: "Karen", last_name: "Moore", email: "karen@example.com", phone: "555-0111", last_visit_date: monthsAgo(7), status: "active", source: "website" },
  { id: 12, first_name: "Leo", last_name: "Taylor", email: "leo@example.com", phone: "555-0112", last_visit_date: null, status: "lead", source: "email" },
];

export const seedAppointments: Appointment[] = [
  { id: 1, patient_id: 1, date: daysAgo(240), procedure_type: "cleaning", status: "completed" },
  { id: 2, patient_id: 2, date: daysAgo(270), procedure_type: "filling", status: "completed" },
  { id: 3, patient_id: 3, date: daysAgo(60), procedure_type: "checkup", status: "completed" },
  { id: 4, patient_id: 3, date: daysFromNow(10), procedure_type: "cleaning", status: "scheduled" },
  { id: 5, patient_id: 5, date: daysAgo(210), procedure_type: "ortho", status: "completed" },
  { id: 6, patient_id: 6, date: daysAgo(30), procedure_type: "cleaning", status: "completed" },
  { id: 7, patient_id: 8, date: daysAgo(300), procedure_type: "implant", status: "completed" },
  { id: 8, patient_id: 9, date: daysAgo(90), procedure_type: "checkup", status: "completed" },
  { id: 9, patient_id: 10, date: daysAgo(420), procedure_type: "cleaning", status: "completed" },
  // Karen (id 11) is >6 months lapsed BUT has upcoming scheduled -> must be EXCLUDED from lapsed query
  { id: 10, patient_id: 11, date: daysAgo(210), procedure_type: "cleaning", status: "completed" },
  { id: 11, patient_id: 11, date: daysFromNow(5), procedure_type: "checkup", status: "scheduled" },
  { id: 12, patient_id: 4, date: daysAgo(365), procedure_type: "filling", status: "completed" },
];
