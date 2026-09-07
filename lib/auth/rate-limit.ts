/**
 * Zamykání přihlášení po opakovaných neúspěších.
 *
 * Počítá se dvojice e-mail + IP. Samotná IP by zamkla celou kancelář za jedním
 * NAT kvůli jednomu překlepu; samotný e-mail by dovolil komukoli zvenčí zamknout
 * jednateli účet tím, že bude tipovat.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { loginAttempts } from "../db/schema";
import type { AnyPgDatabase } from "../db/seed-core";
import { uid } from "../id";
import { LOGIN_LOCK_MS, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "./constants";

export function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

export async function recordAttempt(
  db: AnyPgDatabase,
  email: string,
  ip: string,
  success: boolean,
): Promise<void> {
  await db.insert(loginAttempts).values({
    id: uid(),
    email: normalizeEmail(email).slice(0, 300),
    ip: String(ip ?? "").slice(0, 100),
    success,
  });
}

export interface LockState {
  locked: boolean;
  /** Kolik neúspěchů je v okně. */
  failures: number;
  /** Do kdy je zamčeno, když je zamčeno. */
  until: Date | null;
}

/**
 * Stav zámku pro dvojici e-mail + IP.
 *
 * Počítají se jen neúspěchy **po posledním úspěšném přihlášení** — tím se
 * čítač po úspěchu vynuluje, aniž by se cokoli maza­lo z historie pokusů.
 */
export async function lockState(
  db: AnyPgDatabase,
  email: string,
  ip: string,
  now = new Date(),
): Promise<LockState> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const rows = await db
    .select({ at: loginAttempts.at, success: loginAttempts.success })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, normalizeEmail(email)),
        eq(loginAttempts.ip, String(ip ?? "")),
        gte(loginAttempts.at, since),
      ),
    )
    .orderBy(sql`${loginAttempts.at} desc`);

  let failures = 0;
  let newestFailure: Date | null = null;
  for (const r of rows) {
    if (r.success) break;
    failures++;
    if (!newestFailure) newestFailure = r.at;
  }

  if (failures < LOGIN_MAX_FAILURES || !newestFailure) {
    return { locked: false, failures, until: null };
  }
  const until = new Date(newestFailure.getTime() + LOGIN_LOCK_MS);
  return until > now
    ? { locked: true, failures, until }
    : { locked: false, failures, until: null };
}
