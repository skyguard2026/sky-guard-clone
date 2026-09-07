/**
 * Životní cyklus session.
 *
 * Session je řádek v databázi a cookie nese jen její neprůhledné id. Ověřuje
 * se v bráně při **každé** navigaci, včetně RSC požadavků při klientském
 * přechodu mezi stránkami — kdyby se ověřovalo až v layoutu, neprojevilo by se
 * ukončení session dřív než při tvrdém načtení stránky, protože layout se při
 * klientské navigaci mezi stránkami pod ním znovu nevykresluje. Tlačítko
 * „ukončit session" by pak bylo kosmetika.
 *
 * Nic se necachuje mezi požadavky. Zneplatnění platí okamžitě.
 */
import { and, eq, gt, lt } from "drizzle-orm";
import { sessions, users } from "../db/schema";
import type { AnyPgDatabase } from "../db/seed-core";
import { SESSION_MAX_AGE, SESSION_TOUCH_AFTER_MS, type Role } from "./constants";

/** Id session je zároveň obsah cookie, takže musí být nehádatelné. */
export function newSessionId(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

export async function createSession(
  db: AnyPgDatabase,
  userId: string,
  userAgent = "",
): Promise<string> {
  const id = newSessionId();
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    userAgent: userAgent.slice(0, 400),
  });
  return id;
}

/**
 * Ověří session a vrátí uživatele. Jeden indexovaný dotaz.
 *
 * Deaktivovaný uživatel neprojde, i když má session platnou — účet se vypíná
 * teď, ne až vyprší poslední cookie.
 */
export async function resolveSession(
  db: AnyPgDatabase,
  sessionId: string | undefined,
): Promise<SessionUser | null> {
  if (!sessionId) return null;

  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const r = rows[0];
  if (!r || !r.active) return null;

  // Prodloužení se zapisuje zředěně — čte se pokaždé, zapisuje jednou za
  // minutu. Jinak by každé kliknutí znamenalo zápis navíc.
  if (Date.now() - r.lastSeenAt.getTime() > SESSION_TOUCH_AFTER_MS) {
    const now = new Date();
    await db
      .update(sessions)
      .set({
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + SESSION_MAX_AGE * 1000),
      })
      .where(eq(sessions.id, sessionId));
  }

  return {
    sessionId: r.sessionId,
    userId: r.userId,
    email: r.email,
    name: r.name,
    role: r.role,
    mustChangePassword: r.mustChangePassword,
  };
}

export async function revokeSession(
  db: AnyPgDatabase,
  sessionId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Všechny session uživatele — po změně hesla i při deaktivaci účtu. */
export async function revokeAllUserSessions(
  db: AnyPgDatabase,
  userId: string,
): Promise<number> {
  const gone = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id });
  return gone.length;
}

export async function listUserSessions(db: AnyPgDatabase, userId: string) {
  return db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())));
}

/** Úklid prošlých session. Volá se při přihlášení, nepotřebuje vlastní cron. */
export async function purgeExpiredSessions(db: AnyPgDatabase): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
