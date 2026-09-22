"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Campaign ids mirror backend seed (AGENTS.md §4.1): 1 = lapsed, 3 = new lead
const CAMPAIGN_FOR_TAB: Record<string, number> = { lapsed: 1, leads: 3 };

type Tab = "lapsed" | "leads" | "reviews";

interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  last_visit_date: string | null;
  status: string;
  source?: string;
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

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("lapsed");
  const [rows, setRows] = useState<Patient[]>([]);
  const [comms, setComms] = useState<Comm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (t === "lapsed") {
        const r = await fetch(`${API}/api/patients/lapsed`);
        if (!r.ok) throw new Error(`lapsed ${r.status}`);
        setRows(await r.json());
      } else if (t === "leads") {
        const r = await fetch(`${API}/api/patients?status=lead`);
        if (!r.ok) throw new Error(`leads ${r.status}`);
        setRows(await r.json());
      } else {
        const r = await fetch(`${API}/api/communications`);
        if (!r.ok) throw new Error(`comms ${r.status}`);
        setComms(await r.json());
      }
    } catch (e: any) {
      setError(`Backend unreachable at ${API} — start api-server (:4000). (${e.message})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function trigger(patient: Patient) {
    const campaignId = CAMPAIGN_FOR_TAB[tab] ?? 1;
    setBusyId(patient.id);
    setNotice(null);
    try {
      const r = await fetch(`${API}/api/campaigns/${campaignId}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_ids: [patient.id] }),
      });
      if (!r.ok) throw new Error(`trigger ${r.status}`);
      const data = await r.json();
      setNotice(`Queued ${data.queued} reactivation email for ${patient.email} (campaign ${campaignId}).`);
      if (tab === "reviews") load(tab);
    } catch (e: any) {
      setNotice(`Trigger failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">CarrStack — Dental Marketing Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Leads · Lapsed reactivation · Post-appointment reviews — API: <code>{API}</code>
        </p>
      </header>

      <nav className="mb-4 flex gap-2">
        {(["lapsed", "leads", "reviews"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {t === "lapsed" ? "Lapsed" : t === "leads" ? "Leads" : "Post-Appointment Reviews"}
          </button>
        ))}
        <button onClick={() => load(tab)} className="ml-auto rounded-lg bg-white px-4 py-2 text-sm ring-1 ring-slate-200 hover:bg-slate-100">
          Refresh
        </button>
      </nav>

      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{notice}</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {tab !== "reviews" ? (
        <div className="overflow-x-auto rounded-xl bg-white shadow ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Last visit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">{p.first_name} {p.last_name}</td>
                  <td className="px-4 py-2">{p.email}</td>
                  <td className="px-4 py-2">{p.last_visit_date || "—"}</td>
                  <td className="px-4 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{p.status}</span></td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => trigger(p)}
                      disabled={busyId === p.id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {busyId === p.id ? "Queuing…" : "Trigger Reactivation Campaign"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No rows.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-4 shadow ring-1 ring-slate-200">
          <h2 className="mb-2 text-sm font-semibold">Communication loop (inbound parser + outbound drip writes here)</h2>
          {comms.length === 0 && !loading && <p className="text-sm text-slate-500">No communications yet — send a POST /api/inbound-email or trigger a campaign.</p>}
          <ul className="space-y-2">
            {comms.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="font-semibold">#{c.id}</span>
                  <span>{c.direction}</span>
                  <span>{c.type}</span>
                  {c.intent && <span>intent={c.intent}</span>}
                  {c.urgency && <span>urgency={c.urgency}</span>}
                  <span className="ml-auto">{new Date(c.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{c.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
