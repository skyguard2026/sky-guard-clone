"use client";

import { useMemo, useState } from "react";
import { compareProducts } from "@/lib/compare-products";
import { money, perc } from "@/lib/format";
import type { CalcLocation, CatalogItem, Settings } from "@/lib/types";

/**
 * Ekonomika téže lokality jako Sky Cam, Sky Guard a kombinace vedle sebe.
 * Jen náhled pro rozhodnutí, co nabídnout — nic se neukládá.
 */
export function ProductCompareCard({
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
  const [open, setOpen] = useState(false);

  const varianty = useMemo(
    () => compareProducts(location, catalog, settings, locationCount),
    [location, catalog, settings, locationCount],
  );

  return (
    <div className="card">
      <h2>
        <span className="tag" style={{ background: "var(--green)" }} />
        Srovnání produktů
        <div className="right">
          <button
            type="button"
            className="btn sm"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Skrýt" : "Zobrazit"}
          </button>
        </div>
      </h2>

      {open ? (
        <>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Varianta</th>
                  <th className="n">Jednorázově</th>
                  <th className="n">Měsíčně hotovost</th>
                  <th className="n">Plný náklad</th>
                  <th className="n">Marže</th>
                  <th className="n">Návratnost</th>
                  <th className="n">Kumulativ</th>
                </tr>
              </thead>
              <tbody>
                {varianty.map((v) => {
                  const r = v.result;
                  return (
                    <tr
                      key={v.product}
                      style={
                        v.current
                          ? { background: "rgba(59,143,255,.07)" }
                          : undefined
                      }
                    >
                      <td className="nw">
                        <b>{v.label}</b>
                        {v.current ? (
                          <span className="pill" style={{ marginLeft: 6 }}>
                            nastaveno
                          </span>
                        ) : null}
                        {v.warning ? (
                          <div
                            className="muted"
                            style={{ fontSize: 12, color: "var(--amber)" }}
                          >
                            {v.warning}
                          </div>
                        ) : null}
                      </td>
                      <td className="n">{money(r.day0)}</td>
                      <td className="n">{money(r.monthlyCash)}</td>
                      <td className="n">{money(r.fullMonthly)}</td>
                      <td
                        className="n"
                        style={{
                          color:
                            r.margin >= 0.4
                              ? "var(--green)"
                              : r.margin >= 0.2
                                ? "var(--amber)"
                                : "var(--red)",
                        }}
                      >
                        {location.price > 0 ? perc(r.margin) : "—"}
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
                            r.flow[r.horizon] > 0
                              ? "var(--green)"
                              : "var(--red)",
                        }}
                      >
                        {money(r.flow[r.horizon])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="note">
            Počítá se ze současných vstupů lokality a ze stejné ceny
            {location.price > 0 ? ` ${money(location.price)}` : ""}. Nic se
            neukládá — přepnout produkt musíš v Konfiguraci.
          </div>
        </>
      ) : (
        <div className="note" style={{ borderTop: 0 }}>
          Ukáže vedle sebe, jak by tatáž lokalita vyšla jako Sky Cam, jako Sky
          Guard a jako kombinace.
        </div>
      )}
    </div>
  );
}
