"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setActiveLocationCookie } from "@/lib/active-location-client";
import type { SessionUser } from "@/lib/auth/session";
import type { LocationWithClient } from "@/lib/types";
import { logout } from "@/app/actions/auth";
import { hub } from "@/lib/hub-path";

/** `admin: true` znamená, že položku member vůbec neuvidí. */
const NAV = [
  { href: hub("/"), label: "Kalkulace", icon: "calc" },
  { href: hub("/prehled"), label: "Přehled", icon: "grid" },
  { href: hub("/srovnani"), label: "Srovnání lokalit", icon: "rows" },
  { href: hub("/delka-kontraktu"), label: "Délka kontraktu", icon: "clock" },
  { sep: "FINANCE", admin: true },
  { href: hub("/finance"), label: "Přehled financí", icon: "coins", admin: true },
  { href: hub("/finance/transakce"), label: "Transakce", icon: "rows", admin: true },
  { href: hub("/finance/kategorie"), label: "Kategorie a pravidla", icon: "tag", admin: true },
  { href: hub("/finance/import"), label: "Nahrání výpisu", icon: "upload", admin: true },
  { sep: "SPRÁVA" },
  { href: hub("/klienti"), label: "Klienti a lokality", icon: "pin" },
  { href: hub("/katalog"), label: "Katalog nákladů", icon: "list" },
  { href: hub("/nastaveni"), label: "Nastavení", icon: "cog" },
  { href: hub("/admin"), label: "Admin centrum", icon: "shield", admin: true },
] as const;

function Icon({ name }: { name: string }) {
  const p: Record<string, string> = {
    calc: "M4 3h10v4H4zM4 10h3v3H4zm4.5 0h3v3h-3zM13 10h3v7h-3zM4 14h3v3H4zm4.5 0h3v3h-3z",
    grid: "M3 3h6v6H3zm8 0h6v6h-6zM3 11h6v6H3zm8 0h6v6h-6z",
    rows: "M3 4h14v3H3zm0 5h14v3H3zm0 5h14v3H3z",
    pin: "M10 2a5 5 0 0 0-5 5c0 3.6 5 11 5 11s5-7.4 5-11a5 5 0 0 0-5-5m0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4",
    list: "M3 4h2v2H3zm4 0h10v2H7zM3 9h2v2H3zm4 0h10v2H7zM3 14h2v2H3zm4 0h10v2H7z",
    clock: "M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m0 2.6a1 1 0 0 1 1 1V10h2.6a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1",
    coins: "M10 2c3.9 0 7 1.3 7 3s-3.1 3-7 3-7-1.3-7-3 3.1-3 7-3M3 8.4C4.3 9.4 6.9 10 10 10s5.7-.6 7-1.6V11c0 1.7-3.1 3-7 3s-7-1.3-7-3zm0 5C4.3 14.4 6.9 15 10 15s5.7-.6 7-1.6V16c0 1.7-3.1 3-7 3s-7-1.3-7-3z",
    tag: "M3 3h6.6c.5 0 1 .2 1.4.6l6 6a2 2 0 0 1 0 2.8l-4.6 4.6a2 2 0 0 1-2.8 0l-6-6A2 2 0 0 1 3 9.6zm3 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
    upload: "M10 2.5 14.5 7H11v5H9V7H5.5zM3 14h14v3.5H3z",
    shield: "M10 1.6 3.5 4.2v5.1c0 4 2.8 7.7 6.5 9.1 3.7-1.4 6.5-5.1 6.5-9.1V4.2zm0 4.2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4m0 5.6c1.7 0 3.2.8 3.9 2a6.9 6.9 0 0 1-7.8 0c.7-1.2 2.2-2 3.9-2",
    cog: "M10 6.5A3.5 3.5 0 1 0 10 13.5 3.5 3.5 0 0 0 10 6.5m8 3.5-1.9-.5a6 6 0 0 0-.6-1.5l1-1.7-1.8-1.8-1.7 1a6 6 0 0 0-1.5-.6L11 2.5H8.5L8 4.4a6 6 0 0 0-1.5.6l-1.7-1L3 5.8l1 1.7a6 6 0 0 0-.6 1.5L1.5 10v2.5l1.9.5c.15.53.35 1.03.6 1.5l-1 1.7 1.8 1.8 1.7-1c.47.25.97.45 1.5.6l.5 1.9H11l.5-1.9a6 6 0 0 0 1.5-.6l1.7 1 1.8-1.8-1-1.7c.25-.47.45-.97.6-1.5l1.9-.5z",
  };
  return (
    <span className="ico" aria-hidden>
      <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
        <path d={p[name]} />
      </svg>
    </span>
  );
}

export function Shell({
  locations,
  activeId,
  catalogCount,
  user,
  children,
}: {
  locations: LocationWithClient[];
  activeId: string | null;
  catalogCount: number;
  user: SessionUser;
  children: React.ReactNode;
}) {
  const isAdmin = user.role === "admin";
  const pathname = usePathname();
  const router = useRouter();

  const pick = (id: string) => {
    setActiveLocationCookie(id);
    router.refresh();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Image
            src="/logo-sky-guard.png"
            alt="Sky Guard"
            width={800}
            height={129}
            priority
          />
          <small>KALKULACE NÁKLADŮ A CEN</small>
        </div>
        <nav className="nav">
          {/* Skrytí v UI je pohodlí, ne ochrana — na oprávnění se ptá brána
              a znovu každá server action. */}
          {NAV.filter((n) => !("admin" in n && n.admin) || isAdmin).map((n, i) =>
            "sep" in n ? (
              <div className="sep" key={`s${i}`}>
                {n.sep}
              </div>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? "page" : undefined}
              >
                <Icon name={n.icon} />
                {n.label}
                {n.href === hub("/katalog") ? (
                  <span className="badge">{catalogCount}</span>
                ) : null}
                {n.href === hub("/klienti") ? (
                  <span className="badge">{locations.length}</span>
                ) : null}
              </Link>
            ),
          )}
        </nav>
        <div className="sb-foot">
          <div className="who">
            <div>
              <b>{user.name || user.email}</b>
              <i>{isAdmin ? "správce" : "člen"}</i>
            </div>
            <form action={logout}>
              <button type="submit" className="btn sm" title="Odhlásit se">
                Odhlásit
              </button>
            </form>
          </div>
          <label htmlFor="locSel">AKTIVNÍ LOKALITA</label>
          <select
            id="locSel"
            value={activeId ?? ""}
            disabled={!locations.length}
            onChange={(e) => pick(e.target.value)}
          >
            {locations.length ? (
              locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.clientName} — {l.name}
                </option>
              ))
            ) : (
              <option value="">Žádná lokalita</option>
            )}
          </select>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
