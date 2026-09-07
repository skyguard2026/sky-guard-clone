/**
 * Audit log. Zapisuje se, nemaže se.
 *
 * V aplikaci neexistuje akce, která by z tabulky mazala — je to vědomé.
 * Log, který jde uklidit, neodpoví na otázku, kvůli které se vede.
 */
import { desc, eq, and, type SQL } from "drizzle-orm";
import { auditLog } from "../db/schema";
import type { AnyPgDatabase } from "../db/seed-core";
import { uid } from "../id";

/** Akce, které se zapisují. Volný řetězec by se během půl roku rozešel. */
export type AuditAction =
  | "login"
  | "login.failed"
  | "login.locked"
  | "logout"
  | "password.changed"
  | "user.created"
  | "user.updated"
  | "user.role_changed"
  | "user.deactivated"
  | "user.activated"
  | "user.password_reset"
  | "session.revoked"
  | "client.deleted"
  | "location.deleted"
  | "catalog.item_deleted"
  | "catalog.reset"
  | "backup.imported"
  | "data.wiped"
  | "finance.imported"
  | "finance.import_reverted"
  | "finance.wiped"
  | "inquiry.deleted";

export interface AuditActor {
  userId: string | null;
  /** Jméno a e-mail v době činu — přežije i smazání uživatele. */
  actor: string;
}

/** Nouzový skript nemá přihlášeného uživatele, ale zapsat se musí taky. */
export const SYSTEM_ACTOR: AuditActor = { userId: null, actor: "system" };

export async function writeAudit(
  db: AnyPgDatabase,
  actor: AuditActor,
  action: AuditAction,
  target = "",
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(auditLog).values({
    id: uid(),
    userId: actor.userId,
    actor: actor.actor,
    action,
    target: target.slice(0, 300),
    detail,
  });
}

export interface AuditFilter {
  userId?: string | null;
  action?: string | null;
  limit?: number;
}

export async function readAudit(db: AnyPgDatabase, filter: AuditFilter = {}) {
  const where: SQL[] = [];
  if (filter.userId) where.push(eq(auditLog.userId, filter.userId));
  if (filter.action) where.push(eq(auditLog.action, filter.action));

  return db
    .select()
    .from(auditLog)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(Math.min(500, Math.max(1, filter.limit ?? 200)));
}
