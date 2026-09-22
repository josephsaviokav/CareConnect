"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiBase, loadSession, saveSession } from "../lib/session";

const DEMO: Record<"clinic" | "patient", { email: string; password: string; hint: string }> = {
  clinic: { email: "clinic@careconnect.demo", password: "clinic123", hint: "Staff → full practice dashboard" },
  patient: { email: "alice@example.com", password: "patient123", hint: "Patients → personal portal (Alice Smith)" },
};

export default function Login() {
  const router = useRouter();
  const [role, setRole] = useState<"clinic" | "patient">("clinic");
  const [email, setEmail] = useState(DEMO.clinic.email);
  const [password, setPassword] = useState(DEMO.clinic.password);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (typeof window !== "undefined") {
    const s = loadSession();
    if (s) router.replace(s.role === "clinic" ? "/" : "/portal");
  }

  function pickRole(r: "clinic" | "patient") {
    setRole(r);
    setEmail(DEMO[r].email);
    setPassword(DEMO[r].password);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${apiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error((data as any).error || `login ${r.status}`);
      }
      const s = await r.json();
      saveSession(s);
      router.replace(s.role === "clinic" ? "/" : "/portal");
    } catch (err: any) {
      setError(err.message || "Login failed — is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl bg-forest-800 px-4 py-2.5 text-sm text-cream ring-1 ring-white/10 outline-none placeholder:text-sage/60 focus:ring-brand/50";

  return (
    <main className="flex min-h-screen items-center justify-center bg-forest-950 px-4 font-sans text-cream">
      <div className="w-full max-w-md rounded-3xl bg-forest-900 p-8 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand font-display text-xl font-bold text-brand-ink">C</span>
          <span>
            <span className="block font-display text-lg font-bold leading-tight">CareConnect</span>
            <span className="block text-xs text-sage">Dental Practice</span>
          </span>
        </div>

        <p className="mt-6 font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">Welcome back</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Sign in to continue</h1>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-forest-800 p-1.5 ring-1 ring-white/10">
          {(["clinic", "patient"] as const).map((r) => (
            <button
              key={r}
              onClick={() => pickRole(r)}
              className={`rounded-xl px-4 py-2.5 font-display text-sm font-semibold capitalize transition ${
                role === r ? "bg-brand text-brand-ink" : "text-sage hover:text-cream"
              }`}
            >
              {r === "clinic" ? "Clinic" : "Patient"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-sage">{DEMO[role].hint}</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required className={input} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required className={input} />
          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand px-4 py-2.5 font-display text-sm font-semibold text-brand-ink transition hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Signing in…" : `Sign in as ${role === "clinic" ? "Clinic" : "Patient"}`}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-sage/70">Demo build — credentials are pre-filled. Prototype-grade auth.</p>
      </div>
    </main>
  );
}
