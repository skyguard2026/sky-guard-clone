/**
 * Přihlášení. Odděleně od server action, aby šlo otestovat proti databázi
 * bez cookies a hlaviček.
 */
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { AnyPgDatabase } from "../db/seed-core";
import { writeAudit } from "./audit";
import { ensureBootstrapAdmin, markBootstrapUsed } from "./bootstrap";
import { hashPassword, verifyPassword } from "./password";
import { lockState, normalizeEmail, recordAttempt } from "./rate-limit";
import { createSession, purgeExpiredSessions } from "./session";
import { findByEmail } from "./users";

/**
 * Hash, proti kterému se ověřuje neexistující e-mail.
 *
 * Bez něj by přihlášení na neznámý účet skončilo znatelně dřív než na známý
 * a šlo by z časů vyčíst, které e-maily v aplikaci existují.
 */
let dummyHash: string | null = null;
async function burnTime(password: string) {
  dummyHash ??= await hashPassword("dummy-heslo-pro-vyrovnani-casu");
  await verifyPassword(dummyHash, password);
}

export type LoginResult =
  | { ok: true; sessionId: string; mustChangePassword: boolean }
  | { ok: false; error: string; locked?: boolean };

/** Jedna hláška na všechno, co selhalo. Rozlišovat by znamenalo napovídat. */
const BAD = "Nesprávný e-mail nebo heslo.";

export async function login(
  db: AnyPgDatabase,
  rawEmail: string,
  password: string,
  ip: string,
  userAgent = "",
): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail);

  const lock = await lockState(db, email, ip);
  if (lock.locked) {
    await writeAudit(db, { userId: null, actor: email }, "login.locked", email, { ip });
    return {
      ok: false,
      locked: true,
      error: "Příliš mnoho pokusů. Zkus to znovu za 15 minut.",
    };
  }

  // Bootstrap se zkouší až tady, takže první admin vznikne při prvním pokusu
  // o přihlášení a ne dřív.
  await ensureBootstrapAdmin(db);

  const user = await findByEmail(db, email);
  if (!user) {
    await burnTime(password);
    await recordAttempt(db, email, ip, false);
    await writeAudit(db, { userId: null, actor: email }, "login.failed", email, { ip });
    return { ok: false, error: BAD };
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);
  // Deaktivovaný účet se navenek chová jako špatné heslo — komu byl přístup
  // odebrán, nemá se z hlášky dozvědět, že účet pořád existuje.
  if (!passwordOk || !user.active) {
    await recordAttempt(db, email, ip, false);
    await writeAudit(db, { userId: user.id, actor: user.email }, "login.failed", email, {
      ip,
      inactive: !user.active,
    });
    return { ok: false, error: BAD };
  }

  await recordAttempt(db, email, ip, true);
  await purgeExpiredSessions(db);
  const sessionId = await createSession(db, user.id, userAgent);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await markBootstrapUsed(db);
  await writeAudit(db, { userId: user.id, actor: user.email }, "login", user.id, { ip });

  return { ok: true, sessionId, mustChangePassword: user.mustChangePassword };
}
