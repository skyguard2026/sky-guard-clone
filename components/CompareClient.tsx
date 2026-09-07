"use client";

import { useRouter } from "next/navigation";
import { setActiveLocationCookie } from "@/lib/active-location-client";
import { calc } from "@/lib/calc";
import { marginColor, money, perc } from "@/lib/format";
import type { CatalogItem, LocationWithClient, Settings } from "@/lib/types";
import { HUB } from "@/lib/hub-path";

export function CompareClient({
  locations,
  catalog,
  settings,
}: {
  locations: LocationWithClient[];
  catalog: CatalogItem[];
  settings: Settings;
}) {
  const router = useRouter();

  const open = (id: string) => {
    setActiveLocationCookie(id);
    router.push(HUB);
  };

  const rows = locations.map((l) => {
    const r = calc(l, catalog, settings, locations.length);
    const cfg = [
      l.product !== "drone" && l.cameras ? `${l.cameras}× kamera` : "",
      l.product !== "drone" && l.camerasTlBig
        ? `${l.camerasTlBig}× časosběrná velká`
        : "",
      l.product !== "drone" && l.camerasTlSmall
        ? `${l.camerasTlSmall}× časosběrná malá`
        : "",
      l.product !== "drone" && l.poles ? `${l.poles}× sloup` : "",
      l.product !== "cam" && l.docks ? `${l.docks}× stanice` : "",
    ]
      .filter(Boolean)
      .join(", ");
    return { l, r, cfg };
  });

  const totals = rows.reduce(
    (t, { l, r }) => ({
      day0: t.day0 + r.day0,
      cash: t.cash + r.monthlyCash,
      full: t.full + r.fullMonthly,
      rev: t.rev + l.price,
    }),
    { day0: 0, cash: 0, full: 0, rev: 0 },
  );
  const margin = totals.rev > 0 ? (totals.rev - totals.full) / totals.rev : 0;

  return (
    <div className="card">
      <h2>
        <span className="tag" />
        Všechny lokality
        <small>
          Kumulativ je hotovost po {settings.horizon} měsících včetně vstupní
          investice. Klikni na řádek a přepneš se na jeho kalkulaci.
        </small>
      </h2>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Lokalita</th>
              <th>Klient</th>
              <th className="hide-narrow">Konfigurace</th>
              <th className="n">Jednorázově</th>
              <th className="n">Měsíčně hotovost</th>
              <th className="n">Plný náklad</th>
              <th className="n">Cena</th>
              <th className="n">Marže</th>
              <th className="n">Návratnost</th>
              <th className="n">
                Kumulativ za {settings.horizon} měs
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(({ l, r, cfg }) => (
                <tr
                  key={l.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => open(l.id)}
                >
                  <td>
                    <b>{l.name}</b>
                  </td>
                  <td className="muted">{l.clientName}</td>
                  <td className="muted hide-narrow">{cfg || "—"}</td>
                  <td className="n">{money(r.day0)}</td>
                  <td className="n">{money(r.monthlyCash)}</td>
                  <td className="n">{money(r.fullMonthly)}</td>
                  <td className="n">{money(l.price)}</td>
                  <td className="n" style={{ color: marginColor(r.margin) }}>
                    {l.price > 0 ? perc(r.margin) : "—"}
                  </td>
                  <td className="n">
                    {r.payback === null
                      ? r.flow[r.horizon] >= 0
                        ? "hned"
                        : "—"
                      : `${r.payback} m`}
                  </td>
                  <td
                    className="n"
                    style={{
                      color:
                        r.flow[r.horizon] > 0 ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {money(r.flow[r.horizon])}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="empty">
                  <b>Zatím žádná lokalita</b>
                  Založ ji v sekci Klienti a lokality.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr>
                <td colSpan={3}>Celkem {rows.length} lokalit</td>
                <td className="n">{money(totals.day0)}</td>
                <td className="n">{money(totals.cash)}</td>
                <td className="n">{money(totals.full)}</td>
                <td className="n">{money(totals.rev)}</td>
                <td className="n">{totals.rev > 0 ? perc(margin) : "—"}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
