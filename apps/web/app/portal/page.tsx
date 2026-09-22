"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiBase, clearSession, loadSession, type Session } from "../lib/session";

interface Appointment {
  id: number;
  patient_id: number;
  date: string;
  procedure_type: string;
  status: string;
}

interface Comm {
  id: number;
  type: string;
  direction: string;
  content: string;
  intent?: string;
  timestamp: string;
}

const FEES: Record<string, number> = { cleaning: 180, checkup: 150, filling: 220, ortho: 450, implant: 1200 };
const feeFor = (p: string) => FEES[p] ?? 150;
const isPaid = (id: number) => id % 3 !== 0;
const prettyProc: Record<string, string> = {
  cleaning: "Routine Cleaning & Exam",
  checkup: "Dental Checkup",
  filling: "Cavity Filling",
  ortho: "Orthodontic Consult",
  implant: "Implant Review",
};
const fmtDay = (d: string) => new Date(d).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function Portal() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [comms, setComms] = useState<Comm[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/login"); return; }
    if (s.role !== "patient") { router.replace("/"); return; }
    setSession(s);
    (async () => {
      try {
        const [a, c] = await Promise.all([
          fetch(`${apiBase()}/api/appointments?patient_id=${s.patient_id}`).then((r) => { if (!r.ok) throw new Error(`appts ${r.status}`); return r.json(); }),
          fetch(`${apiBase()}/api/communications?patient_id=${s.patient_id}`).then((r) => { if (!r.ok) throw new Error(`comms ${r.status}`); return r.json(); }),
        ]);
        setAppts(a);
        setComms(c);
      } catch (e: any) {
        setError(`Backend unreachable — start the API. (${e.message})`);
      } finally {
        setReady(true);
      }
    })();
  }, [router]);

  if (!ready || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-forest-950 font-sans text-sm text-sage">
        Loading your portal…
      </main>
    );
  }

  const upcoming = appts.filter((a) => a.status === "scheduled").sort((x, y) => +new Date(x.date) - +new Date(y.date));
  const history = appts.filter((a) => a.status === "completed").sort((x, y) => +new Date(y.date) - +new Date(x.date));
  const balance = history.filter((a) => !isPaid(a.id)).reduce((s, a) => s + feeFor(a.procedure_type), 0);

  function signOut() {
    if (session) {
      fetch(`${apiBase()}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
    }
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-forest-950 font-sans text-cream">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand font-display text-lg font-bold text-brand-ink">C</span>
          <div>
            <p className="font-display text-sm font-bold leading-tight">CareConnect</p>
            <p className="text-[11px] text-sage">Patient portal · {session.name}</p>
          </div>
          <button onClick={signOut} className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-cream ring-1 ring-white/20 hover:bg-white/5">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">Hello, {session.name.split(" ")[0]}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Your dental care, in one place.</h1>
        {error && <p className="mb-4 mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10 md:col-span-2">
            <h2 className="font-display text-[15px] font-semibold">Upcoming Visits</h2>
            {upcoming.length === 0 && <p className="mt-2 text-sm text-sage">Nothing booked — call the clinic to schedule your next visit.</p>}
            <ul className="divide-y divide-white/5">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{prettyProc[a.procedure_type] ?? a.procedure_type}</p>
                    <p className="text-xs text-sage">{fmtDay(a.date)} · {fmtTime(a.date)}</p>
                  </div>
                  <span className="ml-auto rounded-md bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand ring-1 ring-brand/30">Confirmed</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-brand p-5 text-brand-ink">
            <p className="font-display text-[11px] font-semibold uppercase tracking-wider opacity-70">My Balance</p>
            <p className="font-display text-4xl font-bold">${balance}</p>
            <p className="mt-1 text-xs font-medium opacity-70">{history.length} past visits on record</p>
          </section>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
            <h2 className="font-display text-[15px] font-semibold">Treatment History</h2>
            <ul className="divide-y divide-white/5">
              {history.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-semibold">{prettyProc[a.procedure_type] ?? a.procedure_type}</p>
                    <p className="text-xs text-sage">{fmtDay(a.date)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-semibold">${feeFor(a.procedure_type)}</p>
                    <p className={`text-[11px] font-semibold ${isPaid(a.id) ? "text-brand" : "text-orange-300"}`}>{isPaid(a.id) ? "Paid" : "Unpaid"}</p>
                  </div>
                </li>
              ))}
              {history.length === 0 && <li className="py-4 text-sm text-sage">No past visits yet.</li>}
            </ul>
          </section>
          <section className="rounded-2xl bg-forest-900 p-5 ring-1 ring-white/10">
            <h2 className="font-display text-[15px] font-semibold">Messages from the Clinic</h2>
            <ul className="mt-2 space-y-2">
              {comms.filter((c) => c.direction === "outbound").slice(0, 6).map((c) => (
                <li key={c.id} className="rounded-xl bg-forest-800 p-3 text-sm ring-1 ring-white/5">
                  <p className="text-[11px] text-sage">{new Date(c.timestamp).toLocaleString()} · {c.type}</p>
                  <p className="mt-0.5 text-cream/90">{c.content}</p>
                </li>
              ))}
              {comms.filter((c) => c.direction === "outbound").length === 0 && (
                <li className="text-sm text-sage">No messages yet.</li>
              )}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
