/**
 * Operace nad uživateli a invarianty, které musí platit i tehdy, když se admin
 * splete.
 *
 * Dvě pravidla drží celý přístup pohromadě:
 *
 *  - **poslední aktivní admin** nejde deaktivovat, degradovat ani smazat
 *  - **nikdo nesmí na sebe sama** — deaktivace, změna role ani smazání
 *
 * Obojí je cesta, jak se nevratně zamknout z vlastní aplikace. Kontroluje se
 * to tady, ne v UI, protože UI se dá obejít.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { users } from "../db/schema";
import type { AnyPgDatabase } from "../db/seed-core";
import { uid } from "../id";
import { writeAudit, type AuditActor } from "./audit";
import type { Role } from "./constants";
import {
  checkPasswordStrength,
  generateTempPassword,
  hashPassword,
} from "./password";
import { normalizeEmail } from "./rate-limit";
import { revokeAllUserSessions } from "./session";

export type UserRow = typeof users.$inferSelect;

type Fail = { ok: false; error: string };
export type Result<T = Record<string, never>> =
  | ({ ok: true } & T)
  | Fail;

/** Akce, která nic nevrací — jen řekne, jestli prošla. */
export type Done = { ok: true } | Fail;

const fail = (error: string): Fail => ({ ok: false, error });

/** Jednoduchá kontrola tvaru. Doručitelnost stejně neověříme, e-maily neposíláme. */
function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function activeAdminCount(db: AnyPgDatabase, exceptId?: string) {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(
      exceptId
        ? and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, exceptId))
        : and(eq(users.role, "admin"), eq(users.active, true)),
    );
  return rows[0]?.n ?? 0;
}

async function getUser(db: AnyPgDatabase, id: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Cíl akce, která nesmí zlikvidovat posledního admina ani sáhnout na sebe.
 * Vrací uživatele, nebo důvod, proč to nejde.
 */
async function targetForRestrictedChange(
  db: AnyPgDatabase,
  actor: AuditActor,
  userId: string,
  what: string,
): Promise<{ ok: true; user: UserRow } | Fail> {
  if (actor.userId && actor.userId === userId) {
    return fail(`Sám sebe ${what} nemůžeš.`);
  }
  const user = await getUser(db, userId);
  if (!user) return fail("Uživatel neexistuje.");
  if (user.role === "admin" && user.active && (await activeAdminCount(db, userId)) === 0) {
    return fail("Tohle je poslední aktivní admin. Nejdřív jmenuj jiného.");
  }
  return { ok: true, user };
}

export interface NewUser {
  email: string;
  name: string;
  role: Role;
}

/**
 * Založí uživatele s dočasným heslem. Heslo se vrací **jednou** — v databázi
 * je jen argon2id hash a nikdo ho už nepřečte, ani admin.
 */
export async function createUser(
  db: AnyPgDatabase,
  actor: AuditActor,
  input: NewUser,
): Promise<Result<{ user: UserRow; tempPassword: string }>> {
  const email = normalizeEmail(input.email);
  if (!email) return fail("E-mail je povinný.");
  if (!looksLikeEmail(email)) return fail("E-mail nemá platný tvar.");

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return fail("Uživatel s tímhle e-mailem už existuje.");

  const tempPassword = generateTempPassword();
  const [user] = await db
    .insert(users)
    .values({
      id: uid(),
      email,
      name: String(input.name ?? "").trim().slice(0, 200),
      passwordHash: await hashPassword(tempPassword),
      role: input.role === "admin" ? "admin" : "member",
      active: true,
      mustChangePassword: true,
    })
    .returning();

  await writeAudit(db, actor, "user.created", user.id, {
    email: user.email,
    role: user.role,
  });
  return { ok: true, user, tempPassword };
}

export async function setUserRole(
  db: AnyPgDatabase,
  actor: AuditActor,
  userId: string,
  role: Role,
): Promise<Result<{ user: UserRow }>> {
  if (role !== "admin" && role !== "member") return fail("Neznámá role.");
  // Povýšení na admina žádný invariant neporušuje, hlídá se jen degradace.
  if (role === "member") {
    const guard = await targetForRestrictedChange(db, actor, userId, "degradovat");
    if (!guard.ok) return guard;
  } else if (actor.userId && actor.userId === userId) {
    return fail("Sám sobě roli měnit nemůžeš.");
  }

  const [user] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();
  if (!user) return fail("Uživatel neexistuje.");
  await writeAudit(db, actor, "user.role_changed", userId, { role });
  return { ok: true, user };
}

/** Deaktivace zároveň ukončí všechny session — účet se vypíná teď, ne až vyprší cookie. */
export async function deactivateUser(
  db: AnyPgDatabase,
  actor: AuditActor,
  userId: string,
): Promise<Result<{ user: UserRow }>> {
  const guard = await targetForRestrictedChange(db, actor, userId, "deaktivovat");
  if (!guard.ok) return guard;

  const [user] = await db.update(users).set({ active: false }).where(eq(users.id, userId)).returning();
  await revokeAllUserSessions(db, userId);
  await writeAudit(db, actor, "user.deactivated", userId, { email: user.email });
  return { ok: true, user };
}

export async function activateUser(
  db: AnyPgDatabase,
  actor: AuditActor,
  userId: string,
): Promise<Result<{ user: UserRow }>> {
  const [user] = await db.update(users).set({ active: true }).where(eq(users.id, userId)).returning();
  if (!user) return fail("Uživatel neexistuje.");
  await writeAudit(db, actor, "user.activated", userId, { email: user.email });
  return { ok: true, user };
}

export async function deleteUser(
  db: AnyPgDatabase,
  actor: AuditActor,
  userId: string,
): Promise<Done> {
  const guard = await targetForRestrictedChange(db, actor, userId, "smazat");
  if (!guard.ok) return guard;

  // Audit se zapisuje před smazáním, ať v něm zůstane e-mail. Vazba userId
  // se u smazaného uživatele vynuluje, jméno v poli actor ale zůstává.
  await writeAudit(db, actor, "user.deactivated", userId, {
    email: guard.user.email,
    deleted: true,
  });
  await db.delete(users).where(eq(users.id, userId));
  return { ok: true };
}

/** Nové dočasné heslo od admina. Ukončí session a vynutí změnu při přihlášení. */
export async function resetUserPassword(
  db: AnyPgDatabase,
  actor: AuditActor,
  userId: string,
): Promise<Result<{ tempPassword: string }>> {
  const user = await getUser(db, userId);
  if (!user) return fail("Uživatel neexistuje.");

  const tempPassword = generateTempPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true })
    .where(eq(users.id, userId));
  await revokeAllUserSessions(db, userId);
  await writeAudit(db, actor, "user.password_reset", userId, { email: user.email });
  return { ok: true, tempPassword };
}

/**
 * Změna vlastního hesla.
 *
 * Ostatní session se ukončí, ta právě používaná zůstane — jinak by se uživatel
 * změnou hesla sám odhlásil a nepochopil proč.
 */
export async function changeOwnPassword(
  db: AnyPgDatabase,
  actor: AuditActor,
  userId: string,
  newPassword: string,
  keepSessionId: string,
): Promise<Done> {
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) return fail(strength.error);

  const user = await getUser(db, userId);
  if (!user) return fail("Uživatel neexistuje.");

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false })
    .where(eq(users.id, userId));

  const { sessions } = await import("../db/schema");
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));

  await writeAudit(db, actor, "password.changed", userId, {});
  return { ok: true };
}

export async function listUsers(db: AnyPgDatabase): Promise<UserRow[]> {
  return db.select().from(users).orderBy(users.createdAt);
}

export async function findByEmail(db: AnyPgDatabase, email: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return rows[0] ?? null;
}
