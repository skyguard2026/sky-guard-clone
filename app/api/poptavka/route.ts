/**
 * Veřejný příjem poptávky z kontaktního formuláře na webu.
 *
 * Jediná cesta, jak se do databáze dostane něco bez přihlášení — proto je
 * úzká: jen POST, pevná pole s ořezem délky, past na roboty a limit na IP.
 * Brána v proxy.ts hlídá jen /hub, sem se chodí bez session.
 */
import { NextResponse, type NextRequest } from "next/server";
import { callerIp, callerUserAgent } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { hasDatabase } from "@/lib/db/url";
import { uid } from "@/lib/id";
import { parseInquiry } from "@/lib/inquiries";
import { readLimitedText, PayloadTooLarge } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nejvýš pět poptávek z jedné adresy za deset minut. Paměť instance stačí —
 * jde o brzdu proti skriptu, ne o účetnictví. */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  // Expire inactive addresses and bound the per-instance cache.
  for (const [key, times] of hits) {
    if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
  }
  if (!hits.has(ip) && hits.size >= 10_000) return true;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? "";
  const text = await readLimitedText(req);
  if (ct.includes("application/json")) {
    const j = JSON.parse(text);
    return j && typeof j === "object" && !Array.isArray(j) ? j : {};
  }
  const form = await new Response(text, {
    headers: { "content-type": ct },
  }).formData();
  const out: Record<string, unknown> = Object.create(null);
  form.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

export async function POST(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { ok: false, error: "Formulář teď není k dispozici." },
      { status: 503 },
    );
  }

  let raw: Record<string, unknown>;
  try {
    raw = await readBody(req);
  } catch (error) {
    if (error instanceof PayloadTooLarge)
      return NextResponse.json(
        { ok: false, error: "Zpráva je příliš dlouhá." },
        { status: 413 },
      );
    return NextResponse.json(
      { ok: false, error: "Neplatná data." },
      { status: 400 },
    );
  }

  // Past na roboty: skutečný návštěvník skryté pole nevyplní. Tváříme se,
  // že vše proběhlo, aby skript nepoznal, že narazil.
  const honey = raw.company_url;
  if (typeof honey === "string" && honey.trim()) {
    return NextResponse.json({ ok: true });
  }

  const parsed = parseInquiry(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  const ip = await callerIp();
  if (limited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Příliš mnoho odeslání. Zkuste to prosím později." },
      { status: 429 },
    );
  }

  try {
    await db.insert(inquiries).values({
      id: uid(),
      ...parsed.value,
      ip: ip.slice(0, 80),
      userAgent: (await callerUserAgent()).slice(0, 300),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Poptávku se nepodařilo uložit." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
