"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/auth/audit";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/constants";
import {
  callerIp,
  callerUserAgent,
  publicAction,
  withUser,
} from "@/lib/auth/guards";
import { login as loginCore } from "@/lib/auth/login";
import { revokeSession } from "@/lib/auth/session";
import { changeOwnPassword } from "@/lib/auth/users";
import { db } from "@/lib/db";
import { HUB, hub } from "@/lib/hub-path";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  // Jen pod /hub — veřejný web session nepotřebuje a nemá ji dostávat.
  path: HUB,
  maxAge: SESSION_MAX_AGE,
} as const;

async function loginImpl(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("dal") ?? HUB);

  if (!email || !password) return { error: "Vyplň e-mail i heslo." };

  const res = await loginCore(
    db,
    email,
    password,
    await callerIp(),
    await callerUserAgent(),
  );
  if (!res.ok) return { error: res.error };

  (await cookies()).set(SESSION_COOKIE, res.sessionId, COOKIE_OPTIONS);

  // Dokud platí dočasné heslo, uživatel se nikam jinam nedostane — hlídá to
  // i brána, tohle je jen přímější cesta.
  if (res.mustChangePassword) redirect(hub("/zmena-hesla"));
  // Otevřené přesměrování ven z /hub nepovolíme.
  redirect(next.startsWith(HUB + "/") || next === HUB ? next : HUB);
}

async function logoutImpl() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    // Odhlášení je zápis do audit logu jako každá jiná akce, jen se k němu
    // musí dostat uživatel dřív, než mu session zmizí.
    const { resolveSession } = await import("@/lib/auth/session");
    const user = await resolveSession(db, sid);
    if (user) {
      await writeAudit(db, { userId: user.userId, actor: user.email }, "logout", user.userId);
    }
    await revokeSession(db, sid);
  }
  jar.delete({ name: SESSION_COOKIE, path: HUB });
  redirect(hub("/prihlaseni"));
}

async function changePasswordImpl(
  user: { userId: string; email: string; sessionId: string },
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const next = String(formData.get("nove") ?? "");
  const again = String(formData.get("znovu") ?? "");
  if (next !== again) return { error: "Hesla se neshodují." };

  const res = await changeOwnPassword(
    db,
    { userId: user.userId, actor: user.email },
    user.userId,
    next,
    user.sessionId,
  );
  if (!res.ok) return { error: res.error };
  redirect(HUB);
}

/* --- stráže -------------------------------------------------------- */

export const login = publicAction(loginImpl);
export const logout = publicAction(logoutImpl);
export const changePassword = withUser(changePasswordImpl);
