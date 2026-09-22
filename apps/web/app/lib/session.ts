export interface Session {
  token: string;
  role: "clinic" | "patient";
  name: string;
  email: string;
  patient_id: number | null;
  expires_at: string;
}

const KEY = "cc_session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || new Date(s.expires_at).getTime() < Date.now()) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}

export function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}
