/**
 * Brána nad aplikací pod /hub.
 *
 * Session se ověřuje **tady, při každé navigaci** — ne až v layoutu. Layout se
 * při klientském přechodu mezi stránkami pod ním znovu nevykresluje, takže
 * kontrola v něm by proběhla jen při prvním načtení a při tvrdém reloadu.
 * Uživatel se zneplatněnou session by mohl klikat dál a tlačítko „ukončit
 * session" v admin centru by neplatilo v okamžiku, kdy se použije.
 *
 * RSC požadavky při klientské navigaci jdou přes bránu taky, takže je pokrytá
 * i ta cesta. Dotaz do databáze je jeden indexovaný a nic se mezi požadavky
 * necachuje — zneplatnění platí okamžitě.
 *
 * Veřejný web (statické soubory v public/) matcher nezahrnuje: brána chrání
 * jen /hub a všechno pod ním.
 *
 * V Next 16 běží proxy na Node.js runtime, takže se sem Drizzle importuje
 * beze změny.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/auth/constants";
import { resolveSession } from "./lib/auth/session";
import { db } from "./lib/db";
import { hasDatabase } from "./lib/db/url";
import { HUB, hub } from "./lib/hub-path";
import { PUBLIC_SITE } from "./lib/public-site";

export const config = {
  matcher: ["/hub", "/hub/:path*"],
};

const LOGIN = hub("/prihlaseni");
const CHANGE_PASSWORD = hub("/zmena-hesla");
const UNAVAILABLE = hub("/nedostupny");

/** Cesty jen pro admina. Kontroluje se prefixem, ať sem spadnou i podstránky. */
const ADMIN_ONLY = [hub("/admin"), hub("/finance")];

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  /**
   * Preview deploymenty schválně nemají připojení k datům. Místo chyby
   * spojení ukážeme, že Hub v náhledu není — veřejný web vedle běží dál.
   */
  if (!hasDatabase()) {
    if (pathname === UNAVAILABLE) return NextResponse.next();
    return NextResponse.rewrite(new URL(UNAVAILABLE, req.url));
  }
  // S databází stránka pro náhled nemá smysl — zpět na veřejný web.
  if (pathname === UNAVAILABLE) return NextResponse.redirect(new URL(PUBLIC_SITE, req.url));

  const user = await resolveSession(db, req.cookies.get(SESSION_COOKIE)?.value);

  if (!user) {
    if (pathname === LOGIN) return NextResponse.next();
    const url = new URL(LOGIN, req.url);
    if (pathname !== HUB) url.searchParams.set("dal", pathname + search);
    const res = NextResponse.redirect(url);
    // Neplatnou cookie rovnou zahodíme, ať se s ní nechodí dál.
    res.cookies.delete({ name: SESSION_COOKIE, path: HUB });
    return res;
  }

  if (pathname === LOGIN) return NextResponse.redirect(new URL(HUB, req.url));

  /**
   * Dokud platí dočasné heslo, uživatel se nedostane nikam jinam než na jeho
   * změnu. Kdyby to hlídala jen přihlašovací akce, stačilo by po přihlášení
   * přejít jinam a dočasné heslo by zůstalo v platnosti napořád.
   */
  if (user.mustChangePassword) {
    if (pathname === CHANGE_PASSWORD) return NextResponse.next();
    return NextResponse.redirect(new URL(CHANGE_PASSWORD, req.url));
  }
  if (pathname === CHANGE_PASSWORD) return NextResponse.next();

  if (user.role !== "admin" && ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL(HUB, req.url));
  }

  return NextResponse.next();
}
