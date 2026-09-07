"use client";

import { useMemo, useState } from "react";
import { NumberField } from "@/components/ui";
import { money, perc, plural } from "@/lib/format";
import { sensitivity, type SensitivityRow } from "@/lib/sensitivity";
import type { CalcLocation, CatalogItem, Settings } from "@/lib/types";

/**
 * Jak se hne ekonomika, když se změní jedna veličina.
 *
 * Klíčový sloupec je „cena pro cílovou marži". Marže při pevné ceně je
 * pohled dozadu; při jednání potřebuješ vědět, co si máš říct.
 */
export function SensitivityCard({
  location,
  catalog,
  settings,
  locationCount,
}: {
  location: CalcLocation;
  catalog: CatalogItem[];
  settings: Settings;
  locationCount: number;
}) {
  const [target, setTarget] = useState(40);

  const rows = useMemo(
    () => sensitivity(location, catalog, settings, locationCount, target / 100),
    [location, catalog, settings, locationCount, target],
  );

  return (
    <div className="card">
      <h2>
        <span className="tag" style={{ background: "var(--pink)" }} />
        Citlivost
        <div className="right">
          <span className="muted" style={{ fontSize: 12.5 }}>
            cílová marže
          </span>
          <NumberField
            label="Cílová marže"
            value={target}
            unit="%"
            width={52}
            onChange={(v) => setTarget(Math.min(95, Math.max(0, v)))}
          />
        </div>
      </h2>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Veličina</th>
              <th className="n">Hodnota</th>
              <th className="n">Plný náklad</th>
              <th className="n">Marže</th>
              <th className="n">Návratnost</th>
              <th className="n">Kumulativ</th>
              <th className="n">Cena pro {target} % marži</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: SensitivityRow) => (
              <Skupina key={r.variable} r={r} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="note">
        Poslední sloupec je číslo do jednání: jakou měsíční cenu si musíš říct,
        abys při dané konfiguraci udržel {target} % marži. U ceny klientovi je
        na všech řádcích stejný, protože plný náklad na prodejní ceně nezávisí.
      </div>
    </div>
  );
}

function Skupina({ r }: { r: SensitivityRow }) {
  const fmt = (v: number) => (r.variable === "price" ? money(v) : String(v));

  return (
    <>
      <tr className="group">
        <td colSpan={7}>
          {r.label}
          <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
            {r.hint}
          </span>
        </td>
      </tr>
      {r.points.map((p) => (
        <tr
          key={`${r.variable}-${p.value}`}
          style={
            p.current
              ? { background: "rgba(59,143,255,.07)", fontWeight: 500 }
              : undefined
          }
        >
          <td className="muted nw">
            {p.current ? "současný stav" : ""}
          </td>
          <td className="n nw">
            {fmt(p.value)}
            {r.variable === "locationCount"
              ? ` ${plural(p.value, "lokalita", "lokality", "lokalit")}`
              : r.variable !== "price"
                ? ` ${r.unit}`
                : ""}
          </td>
          <td className="n">{money(p.fullMonthly)}</td>
          <td
            className="n"
            style={{
              color:
                p.margin >= 0.4
                  ? "var(--green)"
                  : p.margin >= 0.2
                    ? "var(--amber)"
                    : "var(--red)",
            }}
          >
            {perc(p.margin)}
          </td>
          <td className="n">
            {p.payback === null
              ? p.cumulative >= 0
                ? "hned"
                : "—"
              : `${p.payback} m`}
          </td>
          <td
            className="n"
            style={{ color: p.cumulative > 0 ? "var(--green)" : "var(--red)" }}
          >
            {money(p.cumulative)}
          </td>
          <td className="n" style={{ fontWeight: 700, color: "var(--blue)" }}>
            {money(p.priceForTarget)}
          </td>
        </tr>
      ))}
    </>
  );
}
