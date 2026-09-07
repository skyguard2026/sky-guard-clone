"use client";

import { useState } from "react";
import { patchCatalogItem } from "@/app/actions/catalog";
import { CellInput } from "@/components/ui";
import { calc } from "@/lib/calc";
import { money, moneyK, perc } from "@/lib/format";
import { BILL, CAT, DRIVER, GROUP } from "@/lib/labels";
import type {
  CatalogItem,
  Group,
  LocationWithClient,
  Settings,
} from "@/lib/types";
import { useWriteQueue } from "@/lib/use-write-queue";

export function OverviewClient({
  catalog,
  locations,
  settings,
  clientCount,
}: {
  catalog: CatalogItem[];
  locations: LocationWithClient[];
  settings: Settings;
  clientCount: number;
}) {
  const { push } = useWriteQueue();
  const [items, setItems] = useState(catalog);

  const totals = locations.reduce(
    (t, l) => {
      const r = calc(l, items, settings, locations.length);
      t.day0 += r.day0;
      t.cash += r.monthlyCash;
      t.full += r.fullMonthly;
      t.rev += l.price;
      return t;
    },
    { day0: 0, cash: 0, full: 0, rev: 0 },
  );
  const margin = totals.rev > 0 ? (totals.rev - totals.full) / totals.rev : 0;
  const marginCls =
    margin >= 0.4 ? "good" : margin >= 0.2 ? "warn" : "bad";

  const patchLocal = (id: string, patch: Partial<CatalogItem>) =>
    setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const setPrice = (id: string, price: number) => {
    patchLocal(id, { price });
    push(`cat:${id}:price`, () => patchCatalogItem(id, { price }));
  };
  const setLife = (id: string, life: number | null) => {
    patchLocal(id, { life });
    push(`cat:${id}:life`, () => patchCatalogItem(id, { life }));
  };

  return (
    <>
      <div className="card">
        <div className="kpis">
          <div className="kpi">
            <label>Lokalit v portfoliu</label>
            <div className="v">{locations.length}</div>
            <div className="sub">{clientCount} klientů</div>
          </div>
          <div className="kpi">
            <label>Investováno jednorázově</label>
            <div className="v">{moneyK(totals.day0)}</div>
            <div className="sub">hardware, instalace, předplatky</div>
          </div>
          <div className="kpi">
            <label>Tržba měsíčně</label>
            <div className="v blue">{money(totals.rev)}</div>
            <div className="sub">plný náklad {money(totals.full)}</div>
          </div>
          <div className="kpi">
            <label>Marže portfolia</label>
            <div className={`v ${marginCls}`}>
              {totals.rev > 0 ? perc(margin) : "—"}
            </div>
            <div className="sub">{money(totals.rev - totals.full)} měsíčně</div>
          </div>
        </div>
        <div className="note">
          {settings.share && locations.length > 1
            ? `Sdílené položky se dělí mezi ${locations.length} lokalit. Každá další lokalita zlevní režii těm ostatním.`
            : "Sdílené položky nesou plnou váhu na každé lokalitě. Přepni dělení v Nastavení, jakmile budeš mít víc lokalit."}
        </div>
      </div>

      {(["cam", "drone", "shared"] as Group[]).map((g) => {
        const rows = items.filter((i) => i.group === g);
        return (
          <div className="card" key={g}>
            <h2>
              <span
                className="tag"
                style={{
                  background:
                    g === "cam"
                      ? "var(--blue)"
                      : g === "drone"
                        ? "var(--violet)"
                        : "var(--green)",
                }}
              />
              {GROUP[g]}
              <small>{rows.length} položek</small>
            </h2>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Položka</th>
                    <th className="n">Cena</th>
                    <th className="n">Životnost</th>
                    <th>Účtování</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((it) => (
                      <tr key={it.id}>
                        <td className="name">
                          <div className="namewrap">
                            <em style={{ background: CAT[it.cat].c }} />
                            <div>
                              <div>
                                {it.label}
                                {!it.enabled ? (
                                  <span
                                    className="pill off"
                                    style={{ marginLeft: 6 }}
                                  >
                                    vypnuto
                                  </span>
                                ) : null}
                                {it.shared ? (
                                  <span
                                    className="pill"
                                    style={{ marginLeft: 6 }}
                                  >
                                    sdílené
                                  </span>
                                ) : null}
                              </div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {DRIVER[it.driver].n}
                                {it.note ? ` · ${it.note}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="n">
                          <CellInput
                            allowNegative
                            step={0.01}
                            label={`Cena ${it.label}`}
                            value={it.price}
                            onChange={(v) => setPrice(it.id, v ?? 0)}
                          />{" "}
                          <span className="muted">
                            {it.driver === "pctHw" ? "%" : "Kč"}
                          </span>
                        </td>
                        <td className="n">
                          <CellInput
                            width60
                            allowEmpty
                            placeholder="—"
                            label={`Životnost ${it.label}`}
                            value={it.life}
                            onChange={(v) => setLife(it.id, v)}
                          />
                        </td>
                        <td>
                          <span className="pill">{BILL[it.billing]}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty">
                        <b>V téhle skupině není žádná položka</b>
                        Přidat ji můžeš v Katalogu nákladů.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
