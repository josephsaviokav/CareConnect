import pg from "pg";

/**
 * Shared Postgres pool factory (local Postgres or Supabase cloud).
 * - No DATABASE_URL (or USE_MOCK_DB=true) → null → callers use in-memory seed.
 * - Supabase / managed hosts require TLS → enabled automatically
 *   (or force with PGSSL=true). Local Postgres keeps plaintext.
 */
export function isCloudPostgres(url: string): boolean {
  if (process.env.PGSSL === "true") return true;
  if (process.env.PGSSL === "false") return false;
  return /supabase\.co|neon\.tech|render\.com|amazonaws\.com/.test(url);
}

export function createPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.USE_MOCK_DB === "true") return null;
  return new pg.Pool({
    connectionString: url,
    ssl: isCloudPostgres(url) ? { rejectUnauthorized: false } : undefined,
  });
}
