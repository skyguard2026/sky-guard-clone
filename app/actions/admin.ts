"use server";

import { revalidatePath } from "next/cache";
import { readAudit } from "@/lib/auth/audit";
import type { Role } from "@/lib/auth/constants";
import { withAdmin } from "@/lib/auth/guards";
import {
  listUserSessions,
  revokeAllUserSessions,
  revokeSession,
} from "@/lib/auth/session";
import {
  activateUser,
  createUser,
  deactivateUser,
  deleteUser,
  resetUserPassword,
  setUserRole,
} from "@/lib/auth/users";
import { writeAudit } from "@/lib/auth/audit";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { hub } from "@/lib/hub-path";

function refresh() {
  revalidatePath(hub("/admin"), "layout");
}

const actorOf = (u: SessionUser) => ({ userId: u.userId, actor: u.email });

/**
 * Založí uživatele a vrátí dočasné heslo.
 *
 * Heslo se vrací **jednou a jinam se neuloží** — v databázi je jen argon2id
 * hash. Když ho admin zapomene předat, není cesta zpět, jen nový reset.
 */
async function createUserImpl(
  user: SessionUser,
  input: { email: string; name: string; role: Role },
) {
  const res = await createUser(db, actorOf(user), input);
  refresh();
  return res.ok
    ? { ok: true as const, tempPassword: res.tempPassword, id: res.user.id }
    : { ok: false as const, error: res.error };
}

async function setRoleImpl(user: SessionUser, userId: string, role: Role) {
  const res = await setUserRole(db, actorOf(user), userId, role);
  refresh();
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

async function deactivateImpl(user: SessionUser, userId: string) {
  const res = await deactivateUser(db, actorOf(user), userId);
  refresh();
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

async function activateImpl(user: SessionUser, userId: string) {
  const res = await activateUser(db, actorOf(user), userId);
  refresh();
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

async function deleteImpl(user: SessionUser, userId: string) {
  const res = await deleteUser(db, actorOf(user), userId);
  refresh();
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
}

async function resetPasswordImpl(user: SessionUser, userId: string) {
  const res = await resetUserPassword(db, actorOf(user), userId);
  refresh();
  return res.ok
    ? { ok: true as const, tempPassword: res.tempPassword }
    : { ok: false as const, error: res.error };
}

async function sessionsImpl(_user: SessionUser, userId: string) {
  const rows = await listUserSessions(db, userId);
  return rows.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    userAgent: s.userAgent,
  }));
}

async function revokeSessionImpl(user: SessionUser, sessionId: string) {
  await revokeSession(db, sessionId);
  await writeAudit(db, actorOf(user), "session.revoked", sessionId);
  refresh();
  return { ok: true as const };
}

async function revokeAllImpl(user: SessionUser, userId: string) {
  const n = await revokeAllUserSessions(db, userId);
  await writeAudit(db, actorOf(user), "session.revoked", userId, { count: n });
  refresh();
  return { ok: true as const, count: n };
}

async function auditImpl(
  _user: SessionUser,
  filter: { userId?: string | null; action?: string | null },
) {
  const rows = await readAudit(db, filter);
  return rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    userId: r.userId,
    actor: r.actor,
    action: r.action,
    target: r.target,
    detail: r.detail,
  }));
}

/* --- stráže -------------------------------------------------------- */
/* Celé admin centrum je jen pro admina. Vynucuje to tests/auth-guards.test.ts. */

export const adminCreateUser = withAdmin(createUserImpl);
export const adminSetRole = withAdmin(setRoleImpl);
export const adminDeactivate = withAdmin(deactivateImpl);
export const adminActivate = withAdmin(activateImpl);
export const adminDelete = withAdmin(deleteImpl);
export const adminResetPassword = withAdmin(resetPasswordImpl);
export const adminSessions = withAdmin(sessionsImpl);
export const adminRevokeSession = withAdmin(revokeSessionImpl);
export const adminRevokeAllSessions = withAdmin(revokeAllImpl);
export const adminAudit = withAdmin(auditImpl);
