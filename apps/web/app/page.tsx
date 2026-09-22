"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiBase, clearSession, loadSession, type Session } from "./lib/session";

const API = apiBase();

type View = "dashboard" | "patients" | "appointments" | "treatments" | "billing";

interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  last_visit_date: string | null;
  status: string;
  source?: string;
}

interface Appointment {
  id: number;
  patient_id: number;
  date: string;
  procedure_type: string;
  status: string;
}

interface Comm {
  id: number;
  patient_id: number;
  patient_email?: string;
  type: string;
  direction: string;
  content: string;
  intent?: string;
  urgency?: string;
  timestamp: string;
}

interface TriageResult {
  intent: string;
  urgency: string;
  summary: string;
  suggested_action: string;
}

/* Demo overlays — the backend models clinical data; doctors, fees and
   payment state are deterministic presentation mappings for the prototype. */
const DOCTORS = ["Dr. Lauren Park", "Dr. Marcus Webb", "Dr. Sophie Adler"];
const FEES: Record<string, number> = {
  cleaning: 180,
  checkup: 150,
  filling: 220,
  ortho: 450,
  implant: 1200,
};

const fullName = (p: Patient) => `${p.first_name} ${p.last_name}`;
const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const doctorFor = (patientId: number) => DOCTORS[patientId % DOCTORS.length];
const feeFor = (proc: string) => FEES[proc] ?? 150;
const isPaid = (apptId: number) => apptId % 3 !== 0;
const prettyProc = (proc: string) =>
  ({ cleaning: "Routine Cleaning & Exam", checkup: "Dental Checkup", filling: "Cavity Filling", ortho: "Orthodontic Consult", implant: "Implant Review" } as Record<string, string>)[proc] ?? proc;
const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const todayLabel = () =>
  new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <path d={d} />
    </svg>
  );
}
const ICONS: Record<View, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  patients: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  appointments: "M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  treatments: "M22 12h-4l-3 9L9 3l-3 9H2",
  billing: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20",
};
const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard",
  patients: "Patients",
  appointments: "Appointments",
  treatments: "Treatments",
  billing: "Billing",
};

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 font-display text-[11px] font-semibold text-brand">
      {initials(name)}
    </span>
  );
}

function StatusBadge({ text, tone }: { text: string; tone: "lime" | "orange" }) {
  return (
    <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ${
      tone === "lime"
        ? "bg-brand/10 text-brand ring-brand/30"
        : "bg-orange-400/10 text-orange-300 ring-orange-400/30"
    }`}>
      {text}
    </span>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [lapsed, setLapsed] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [comms, setComms] = useState<Comm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [apptFilter, setApptFilter] = useState<"all" | "scheduled" | "completed">("all");
  const [triage, setTriage] = useState({ from: "", subject: "", body: "" });
  const [triageOut, setTriageOut] = useState<TriageResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, l, a, c] = await Promise.all([
        fetch(`${API}/api/patients`).then((r) => { if (!r.ok) throw new Error(`patients ${r.status}`); return r.json(); }),
        fetch(`${API}/api/patients/lapsed`).then((r) => { if (!r.ok) throw new Error(`lapsed ${r.status}`); return r.json(); }),
        fetch(`${API}/api/appointments`).then((r) => { if (!r.ok) throw new Error(`appointments ${r.status}`); return r.json(); }),
        fetch(`${API}/api/communications`).then((r) => { if (!r.ok) throw new Error(`comms ${r.status}`); return r.json(); }),
      ]);
      setPatients(p);
      setLapsed(l);
      setAppointments(a);
      setComms(c);
    } catch (e: any) {
      setError(`Backend unreachable at ${API} — start api-server (:4000). (${e.message})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/login"); return; }
    if (s.role !== "clinic") { router.replace("/portal"); return; }
    setSession(s);
    setAuthReady(true);
  }, [router]);

  useEffect(() => { if (authReady) load(); }, [load, authReady]);

  function signOut() {
    if (session) {
      fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
    }
    clearSession();
    router.replace("/login");
  }

  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const nameOf = useCallback((id: number) => {
    const p = patientById.get(id);
    return p ? fullName(p) : `Patient #${id}`;
  }, [patientById]);

  const scheduled = useMemo(
    () => appointments.filter((a) => a.status === "scheduled").sort((x, y) => +new Date(x.date) - +new Date(y.date)),
    [appointments]
  );
  const completed = useMemo(
    () => appointments.filter((a) => a.status === "completed").sort((x, y) => +new Date(y.date) - +new Date(x.date)),
    [appointments]
  );
  const leads = useMemo(() => patients.filter((p) => p.status === "lead"), [patients]);
  const outstanding = useMemo(
    () => completed.filter((a) => !isPaid(a.id)).reduce((s, a) => s + feeFor(a.procedure_type), 0),
    [completed]
  );
  const q = search.trim().toLowerCase();
  const matchPatient = useCallback((p: Patient) =>
    !q || fullName(p).toLowerCase().includes(q) || p.email.toLowerCase().includes(q), [q]);

  async function triggerCampaign(campaignId: number, patient: Patient) {
    setBusyId(`c${patient.id}`);
    setNotice(null);
    try {
      const r = await fetch(`${API}/api/campaigns/${campaignId}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_ids: [patient.id] }),
      });
      if (!r.ok) throw new Error(`trigger ${r.status}`);
      const data = await r.json();
      setNotice(`Queued ${data.queued} email for ${patient.email} (campaign ${campaignId}).`);
      const c = await fetch(`${API}/api/communications`).then((x) => x.json());
      setComms(c);
    } catch (e: any) {
      setNotice(`Trigger failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function requestReview(apptId: number) {
    setBusyId(`r${apptId}`);
    setNotice(null);
    try {
      const r = await fetch(`${API}/api/appointments/${apptId}/review-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error(`review ${r.status}`);
      setNotice(`Review request queued for appointment #${apptId}.`);
      const c = await fetch(`${API}/api/communications`).then((x) => x.json());
      setComms(c);
    } catch (e: any) {
      setNotice(`Review request failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function runTriage() {
    if (!triage.from || !triage.body) {
      setNotice("Triage needs at least a sender email and message body.");
      return;
    }
    setBusyId("triage");
    setNotice(null);
    try {
      const r = await fetch(`${API}/api/inbound-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(triage),
      });
      if (!r.ok) throw new Error(`triage ${r.status}`);
      setTriageOut(await r.json());
      const c = await fetch(`${API}/api/communications`).then((x) => x.json());
      setComms(c);
    } catch (e: any) {
      setNotice(`Triage failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  const stats = [
    { label: "Total Patients", value: String(patients.length), sub: "Across the practice", accent: "lime" as const, num: "text-brand" },
    { label: "Upcoming Appts", value: String(scheduled.length), sub: "Next 30 days", accent: "blue" as const, num: "text-sky-300" },
    { label: "New Patients", value: String(leads.length), sub: "Awaiting first visit", accent: "orange" as const, num: "text-orange-300" },
    { label: "Outstanding Balance", value: `$${outstanding}`, sub: "Across all patients", accent: "orange" as const, num: "text-orange-300" },
  ];
  const accentBar = { lime: "border-brand", blue: "border-sky-400", orange: "border-orange-400" };

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-forest-950 font-sans text-sm text-sage">
        Checking session…
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-forest-950 font-sans text-cream">
      {/* Sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-white/10 bg-[#081F14] lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-display text-lg font-bold text-brand-ink">C</span>
          <span>
            <span className="block font-display text-sm font-bold leading-tight">CareConnect</span>
            <span className="block text-[11px] text-sage">Dental Practice</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-display text-sm font-medium transition ${
                view === v ? "bg-brand text-brand-ink" : "text-sage hover:bg-white/5 hover:text-cream"
              }`}
            >
              <Icon d={ICONS[v]} />
              {VIEW_LABELS[v]}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 font-display text-[11px] font-semibold text-brand">
              {session ? initials(session.name) : "••"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight">{session?.name || "Staff"}</span>
              <span className="block text-[11px] text-sage">Clinic staff</span>
            </span>
          </div>
          <button onClick={signOut} className="mt-2.5 w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-sage ring-1 ring-white/10 hover:bg-white/5 hover:text-cream">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-4 sm:px-8">
          <div className="lg:hidden">
            <span className="font-display text-sm font-bold">CareConnect</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="font-display text-xl font-semibold">{VIEW_LABELS[view]}</h1>
            <p className="text-xs text-sage">{todayLabel()}</p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <label className="hidden items-center gap-2 rounded-xl bg-forest-900 px-3.5 py-2 text-sm text-sage ring-1 ring-white/10 focus-within:ring-brand/40 sm:flex">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-36 bg-transparent text-cream outline-none placeholder:text-sage/70"
              />
            </label>
          </div>
        </header>
        {/* Mobile nav */}
        <nav className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-2.5 lg:hidden">
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 font-display text-[13px] font-medium ${
                view === v ? "bg-brand text-brand-ink" : "text-sage ring-1 ring-white/15"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </nav>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
          {notice && (
            <p className="mb-4 rounded-xl bg-brand/10 px-4 py-2.5 text-sm text-brand ring-1 ring-brand/30">{notice}</p>
          )}
          {error && (
            <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>
          )}
          {loading && <p className="text-sm text-sage">Loading practice data…</p>}

          {!loading && !error && view === "dashboard" && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className={`rounded-2xl border-l-4 ${accentBar[s.accent]} bg-forest-900 p-4 ring-1 ring-white/10`}>
                    <p className="font-display text-[11px] font-medium uppercase tracking-wider text-sage">{s.label}</p>
                    <p className={`mt-1 font-display text-3xl font-semibold ${s.num}`}>{s.value}</p>
                    <p className="mt-0.5 text-xs text-sage">{s.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                {/* Upcoming appointments */}
                <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10 xl:col-span-2">
                  <div className="mb-3 flex items-center">
                    <h2 className="font-display text-[15px] font-semibold">Upcoming Appointments</h2>
                    <button onClick={() => setView("appointments")} className="ml-auto text-xs font-semibold text-brand hover:text-brand-hover">
                      View all →
                    </button>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {scheduled.slice(0, 5).map((a) => {
                      const name = nameOf(a.patient_id);
                      return (
                        <li key={a.id} className="flex items-center gap-3 py-3">
                          <Avatar name={name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{name}</p>
                            <p className="truncate text-xs text-sage">{prettyProc(a.procedure_type)} · {doctorFor(a.patient_id)}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-sm font-semibold">{fmtDay(a.date)}</p>
                            <p className="text-xs text-sage">{fmtTime(a.date)}</p>
                          </div>
                          <StatusBadge text="Confirmed" tone="lime" />
                        </li>
                      );
                    })}
                    {scheduled.length === 0 && <li className="py-6 text-center text-sm text-sage">No upcoming appointments.</li>}
                  </ul>
                </section>

                {/* Recent treatments */}
                <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
                  <h2 className="mb-1 font-display text-[15px] font-semibold">Recent Treatments</h2>
                  <ul className="divide-y divide-white/5">
                    {completed.slice(0, 5).map((a) => (
                      <li key={a.id} className="flex items-start justify-between gap-2 py-3">
                        <div>
                          <p className="text-sm font-semibold">{nameOf(a.patient_id)}</p>
                          <p className="text-xs text-sage">{prettyProc(a.procedure_type)}</p>
                          <p className="text-xs text-sage">${feeFor(a.procedure_type)}</p>
                        </div>
                        <span className={`mt-1 text-[11px] font-semibold ${isPaid(a.id) ? "text-brand" : "text-orange-300"}`}>
                          {isPaid(a.id) ? "Paid" : "Unpaid"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* Bottom row */}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-brand p-5 text-brand-ink">
                  <p className="font-display text-[11px] font-semibold uppercase tracking-wider opacity-70">Monthly Revenue</p>
                  <p className="font-display text-4xl font-bold">$18,420</p>
                  <p className="mt-1 text-xs font-medium opacity-70">↑ 12% from August</p>
                </div>
                <div className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
                  <p className="font-display text-[11px] font-medium uppercase tracking-wider text-sage">Appointments This Month</p>
                  <p className="mt-1 font-display text-3xl font-semibold">47</p>
                  <p className="mt-0.5 text-xs text-sage">3 cancellations</p>
                </div>
                <div className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
                  <p className="font-display text-[11px] font-medium uppercase tracking-wider text-sage">Insurance Claims</p>
                  <p className="mt-1 font-display text-3xl font-semibold">12</p>
                  <p className="mt-0.5 text-xs text-sage">4 pending · 8 approved</p>
                </div>
              </div>
            </>
          )}

          {!loading && !error && view === "patients" && (
            <>
              <PatientTable
                title="Lapsed Patients"
                sub="No visit in 6+ months · no upcoming booking"
                rows={lapsed.filter(matchPatient)}
                busyId={busyId}
                onTrigger={(p) => triggerCampaign(1, p)}
              />
              <div className="mt-4">
                <PatientTable
                  title="New Leads"
                  sub="Website & email enquiries awaiting conversion"
                  rows={leads.filter(matchPatient)}
                  busyId={busyId}
                  onTrigger={(p) => triggerCampaign(3, p)}
                />
              </div>
            </>
          )}

          {!loading && !error && view === "appointments" && (
            <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[15px] font-semibold">Appointments</h2>
                <div className="ml-auto flex gap-1.5">
                  {(["all", "scheduled", "completed"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setApptFilter(f)}
                      className={`rounded-lg px-3 py-1.5 font-display text-xs font-medium capitalize ${
                        apptFilter === f ? "bg-brand text-brand-ink" : "text-sage ring-1 ring-white/15 hover:text-cream"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-white/5">
                {appointments
                  .filter((a) => apptFilter === "all" || a.status === apptFilter)
                  .filter((a) => !q || nameOf(a.patient_id).toLowerCase().includes(q))
                  .sort((x, y) => +new Date(y.date) - +new Date(x.date))
                  .map((a) => {
                    const name = nameOf(a.patient_id);
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                        <Avatar name={name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{name}</p>
                          <p className="truncate text-xs text-sage">{prettyProc(a.procedure_type)} · {doctorFor(a.patient_id)}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-sm font-semibold">{fmtDay(a.date)}</p>
                          <p className="text-xs text-sage">{fmtTime(a.date)}</p>
                        </div>
                        <StatusBadge
                          text={a.status === "scheduled" ? "Confirmed" : "Completed"}
                          tone={a.status === "scheduled" ? "lime" : "orange"}
                        />
                        {a.status === "completed" && (
                          <button
                            onClick={() => requestReview(a.id)}
                            disabled={busyId === `r${a.id}`}
                            className="rounded-lg bg-brand px-3.5 py-1.5 font-display text-xs font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50"
                          >
                            {busyId === `r${a.id}` ? "Sending…" : "Request review"}
                          </button>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}

          {!loading && !error && view === "treatments" && (
            <>
              <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
                <h2 className="mb-1 font-display text-[15px] font-semibold">Completed Treatments</h2>
                <ul className="divide-y divide-white/5">
                  {completed
                    .filter((a) => !q || nameOf(a.patient_id).toLowerCase().includes(q))
                    .map((a) => (
                      <li key={a.id} className="flex items-center gap-3 py-3">
                        <Avatar name={nameOf(a.patient_id)} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{nameOf(a.patient_id)}</p>
                          <p className="truncate text-xs text-sage">{prettyProc(a.procedure_type)} · {doctorFor(a.patient_id)} · {fmtDay(a.date)}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-sm font-semibold">${feeFor(a.procedure_type)}</p>
                          <p className={`text-[11px] font-semibold ${isPaid(a.id) ? "text-brand" : "text-orange-300"}`}>
                            {isPaid(a.id) ? "Paid" : "Unpaid"}
                          </p>
                        </div>
                      </li>
                    ))}
                </ul>
              </section>

              {/* AI inbox triage tester */}
              <section className="mt-4 rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
                <h2 className="font-display text-[15px] font-semibold">AI Inbox Triage</h2>
                <p className="text-xs text-sage">Paste a patient reply — the email parser returns intent, urgency and the next action.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    value={triage.from}
                    onChange={(e) => setTriage({ ...triage, from: e.target.value })}
                    placeholder="From (patient email)"
                    className="rounded-xl bg-forest-800 px-3.5 py-2.5 text-sm text-cream ring-1 ring-white/10 outline-none placeholder:text-sage/60 focus:ring-brand/50"
                  />
                  <input
                    value={triage.subject}
                    onChange={(e) => setTriage({ ...triage, subject: e.target.value })}
                    placeholder="Subject"
                    className="rounded-xl bg-forest-800 px-3.5 py-2.5 text-sm text-cream ring-1 ring-white/10 outline-none placeholder:text-sage/60 focus:ring-brand/50"
                  />
                </div>
                <textarea
                  value={triage.body}
                  onChange={(e) => setTriage({ ...triage, body: e.target.value })}
                  placeholder='e.g. "My tooth hurts badly after extraction yesterday, bleeding won&apos;t stop"'
                  rows={3}
                  className="mt-2 w-full rounded-xl bg-forest-800 px-3.5 py-2.5 text-sm text-cream ring-1 ring-white/10 outline-none placeholder:text-sage/60 focus:ring-brand/50"
                />
                <button
                  onClick={runTriage}
                  disabled={busyId === "triage"}
                  className="mt-2 rounded-lg bg-brand px-5 py-2 font-display text-sm font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50"
                >
                  {busyId === "triage" ? "Parsing…" : "Parse intent"}
                </button>
                {triageOut && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-md bg-brand/10 px-2.5 py-1 font-semibold text-brand ring-1 ring-brand/30">intent={triageOut.intent}</span>
                    <span className={`rounded-md px-2.5 py-1 font-semibold ring-1 ${triageOut.urgency === "high" ? "bg-red-500/10 text-red-300 ring-red-400/30" : "bg-white/5 text-cream ring-white/15"}`}>
                      urgency={triageOut.urgency}
                    </span>
                    <span className="w-full text-sm text-sage">{triageOut.summary} → {triageOut.suggested_action}</span>
                  </div>
                )}
              </section>

              {/* Comms loop */}
              <section className="mt-4 rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
                <h2 className="font-display text-[15px] font-semibold">Communication Loop</h2>
                <ul className="mt-2 space-y-2">
                  {comms.slice(0, 8).map((c) => (
                    <li key={c.id} className="rounded-xl bg-forest-800 p-3.5 text-sm ring-1 ring-white/5">
                      <div className="flex flex-wrap gap-x-3 text-xs text-sage">
                        <span className="font-semibold text-brand">#{c.id}</span>
                        <span className="capitalize">{c.direction}</span>
                        <span>{c.type}</span>
                        {c.intent && <span>intent=<span className="text-cream">{c.intent}</span></span>}
                        {c.urgency && <span>urgency={c.urgency}</span>}
                        <span className="ml-auto">{new Date(c.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-cream/90">{c.content}</p>
                    </li>
                  ))}
                  {comms.length === 0 && <li className="text-sm text-sage">No communications yet.</li>}
                </ul>
              </section>
            </>
          )}

          {!loading && !error && view === "billing" && (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-2xl bg-brand p-5 text-brand-ink">
                <p className="font-display text-[11px] font-semibold uppercase tracking-wider opacity-70">Outstanding Balance</p>
                <p className="font-display text-4xl font-bold">${outstanding}</p>
                <p className="mt-1 text-xs font-medium opacity-70">Across all patients · from unpaid treatments</p>
              </section>
              <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
                <p className="font-display text-[11px] font-medium uppercase tracking-wider text-sage">Insurance Claims</p>
                <p className="mt-1 font-display text-3xl font-semibold">12</p>
                <p className="mt-0.5 text-xs text-sage">4 pending · 8 approved</p>
              </section>
              <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10 md:col-span-2">
                <h2 className="font-display text-[15px] font-semibold">Unpaid Treatments</h2>
                <ul className="mt-1 divide-y divide-white/5">
                  {completed.filter((a) => !isPaid(a.id)).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <Avatar name={nameOf(a.patient_id)} />
                      <p className="text-sm font-semibold">{nameOf(a.patient_id)}</p>
                      <p className="text-xs text-sage">{prettyProc(a.procedure_type)} · {fmtDay(a.date)}</p>
                      <p className="ml-auto text-sm font-semibold text-orange-300">${feeFor(a.procedure_type)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PatientTable({
  title, sub, rows, busyId, onTrigger,
}: {
  title: string;
  sub: string;
  rows: Patient[];
  busyId: string | null;
  onTrigger: (p: Patient) => void;
}) {
  return (
    <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
      <h2 className="font-display text-[15px] font-semibold">{title}</h2>
      <p className="text-xs text-sage">{sub}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="font-display text-[11px] uppercase tracking-wider text-sage">
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Last visit</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2.5 font-medium">
                    <Avatar name={fullName(p)} />
                    {fullName(p)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-sage">{p.email}</td>
                <td className="px-3 py-2.5 text-sage">{p.last_visit_date || "—"}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-cream ring-1 ring-white/10">{p.status}</span>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => onTrigger(p)}
                    disabled={busyId === `c${p.id}`}
                    className="rounded-lg bg-brand px-3.5 py-1.5 font-display text-xs font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50"
                  >
                    {busyId === `c${p.id}` ? "Queuing…" : "Trigger Reactivation Campaign"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sage">No rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
