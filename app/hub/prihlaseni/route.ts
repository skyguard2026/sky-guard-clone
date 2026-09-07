/**
 * Přihlášení do Sky Guard Hubu.
 *
 * Vzhled je původní stránka „Sky Guard Hub — Přihlášení" z veřejného webu
 * (Framer export, uložený v lib/login-page/login.html) — beze změny až na
 * formulář, který místo kulisy posílá na tento handler. Logika přihlášení
 * je táž jako v aplikaci: lib/auth/login (argon2id, zámek po pěti
 * neúspěších, audit), cookie se session pod /hub.
 *
 * Stránka i handler stojí před bránou (proxy.ts pouští /hub/prihlaseni bez
 * session). Do databáze se sahá až při POSTu.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/constants";
import { callerIp, callerUserAgent } from "@/lib/auth/guards";
import { login } from "@/lib/auth/login";
import { db } from "@/lib/db";
import { HUB, hub } from "@/lib/hub-path";

export const dynamic = "force-dynamic";

const TEMPLATE = path.join(process.cwd(), "lib", "login-page", "login.html");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Návrat po přihlášení jen dovnitř Hubu — otevřené přesměrování ven nepovolíme. */
function safeNext(raw: string | null): string {
  const v = raw ?? "";
  return v === HUB || v.startsWith(HUB + "/") ? v : HUB;
}

/** Absolutní adresa pro redirect podle skutečného hosta (za proxy Vercelu z X-Forwarded-*). */
function originOf(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

function render(dal: string, error?: string): NextResponse {
  const html = readFileSync(TEMPLATE, "utf8")
    .replace("{{DAL}}", escapeHtml(dal))
    .replace(
      "{{ERROR}}",
      error ? `<div class="sg-login-error" role="alert">${escapeHtml(error)}</div>` : "",
    );
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return render(safeNext(q.get("dal")), q.get("chyba") ?? undefined);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const dal = safeNext(String(form.get("dal") ?? ""));

  const back = (error: string) => {
    const url = new URL(hub("/prihlaseni"), originOf(req));
    url.searchParams.set("chyba", error);
    if (dal !== HUB) url.searchParams.set("dal", dal);
    return NextResponse.redirect(url, 303);
  };

  if (!email || !password) return back("Vyplň e-mail i heslo.");

  const res = await login(db, email, password, await callerIp(), await callerUserAgent());
  if (!res.ok) return back(res.error);

  const target = res.mustChangePassword ? hub("/zmena-hesla") : dal;
  const out = NextResponse.redirect(new URL(target, originOf(req)), 303);
  out.cookies.set(SESSION_COOKIE, res.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: HUB,
    maxAge: SESSION_MAX_AGE,
  });
  return out;
}
