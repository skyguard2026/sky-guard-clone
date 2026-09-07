/**
 * Odhlášení z Hubu.
 *
 * Obyčejný POST formulář místo server action: po odhlášení se jde na veřejný
 * web (PUBLIC_SITE), což je statická stránka mimo aplikaci, a klientský
 * router Nextu na ni po server action nepřejde. Tady odpovíme 303 a
 * prohlížeč přejde sám. Session se zruší v databázi, cookie se smaže.
 */
import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/auth/audit";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { resolveSession, revokeSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { HUB } from "@/lib/hub-path";
import { PUBLIC_SITE } from "@/lib/public-site";

export const dynamic = "force-dynamic";

function originOf(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (sid) {
    // Odhlášení je zápis do audit logu jako každá jiná akce, jen se k němu
    // musí dostat uživatel dřív, než mu session zmizí.
    const user = await resolveSession(db, sid);
    if (user) {
      await writeAudit(db, { userId: user.userId, actor: user.email }, "logout", user.userId);
    }
    await revokeSession(db, sid);
  }
  const res = NextResponse.redirect(new URL(PUBLIC_SITE, originOf(req)), 303);
  res.cookies.delete({ name: SESSION_COOKIE, path: HUB });
  return res;
}
