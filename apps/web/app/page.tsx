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

const TAB_LABELS: Record<Tab, string> = {
  lapsed: "Lapsed",
  leads: "Leads",
  reviews: "Post-Appointment Reviews",
};

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
    <main className="min-h-screen bg-forest-950 font-sans text-cream">
      {/* Top bar — mirrors the CareStack nav: wordmark left, actions right */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-8">
          <span className="font-display text-lg font-bold tracking-wide">
            CARRSTACK
          </span>
          <span className="hidden rounded-full bg-white/5 px-3 py-1 text-xs text-sage ring-1 ring-white/10 sm:inline">
            Marketing Automation
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-sage sm:flex">
              <span className={`inline-block h-2 w-2 rounded-full ${error ? "bg-red-400" : "bg-brand"}`} />
              {API}
            </span>
            <button
              onClick={() => load(tab)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-cream ring-1 ring-white/20 hover:bg-white/5"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        {/* Hero header */}
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Award-winning style dental automation
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-5xl">
          Win back lapsed patients on autopilot.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-sage sm:text-base">
          Convert website leads, re-engage patients who never rebooked, and turn
          fresh visits into five-star reviews — all from one dashboard.
        </p>

        {/* Tabs */}
        <nav className="mt-8 flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 font-display text-sm font-medium ${
                tab === t
                  ? "bg-brand text-brand-ink"
                  : "text-cream ring-1 ring-white/20 hover:bg-white/5"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>

        {notice && (
          <p className="mb-3 mt-4 rounded-xl bg-brand/10 px-4 py-2.5 text-sm text-brand ring-1 ring-brand/30">
            {notice}
          </p>
        )}
        {error && (
          <p className="mb-3 mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300 ring-1 ring-red-400/30">
            {error}
          </p>
        )}
        {loading && <p className="mt-4 text-sm text-sage">Loading…</p>}

        {tab !== "reviews" ? (
          <div className="mt-4 overflow-x-auto rounded-2xl bg-forest-900 shadow-2xl ring-1 ring-white/10">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="font-display text-xs uppercase tracking-wider text-sage">
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Last visit</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-white/5 transition hover:bg-white/5">
                    <td className="px-5 py-3 font-display font-medium text-cream">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-5 py-3 text-sage">{p.email}</td>
                    <td className="px-5 py-3 text-sage">{p.last_visit_date || "—"}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-cream ring-1 ring-white/10">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => trigger(p)}
                        disabled={busyId === p.id}
                        className="rounded-lg bg-brand px-4 py-2 font-display text-xs font-semibold text-brand-ink transition hover:bg-brand-hover disabled:opacity-50"
                      >
                        {busyId === p.id ? "Queuing…" : "Trigger Reactivation Campaign"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sage">
                      No rows.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-forest-900 p-5 shadow-2xl ring-1 ring-white/10">
            <h2 className="font-display text-sm font-semibold text-cream">
              Communication loop{" "}
              <span className="font-sans font-normal text-sage">
                (inbound parser + outbound drip write here)
              </span>
            </h2>
            {comms.length === 0 && !loading && (
              <p className="mt-2 text-sm text-sage">
                No communications yet — send a POST /api/inbound-email or trigger a campaign.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {comms.map((c) => (
                <li key={c.id} className="rounded-xl bg-forest-800 p-4 text-sm ring-1 ring-white/5">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-display text-xs text-sage">
                    <span className="font-semibold text-brand">#{c.id}</span>
                    <span className="capitalize">{c.direction}</span>
                    <span>{c.type}</span>
                    {c.intent && (
                      <span>
                        intent=<span className="text-cream">{c.intent}</span>
                      </span>
                    )}
                    {c.urgency && (
                      <span
                        className={c.urgency === "high" ? "font-semibold text-red-300" : undefined}
                      >
                        urgency={c.urgency}
                      </span>
                    )}
                    <span className="ml-auto">{new Date(c.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-cream/90">{c.content}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
