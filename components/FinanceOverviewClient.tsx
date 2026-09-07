"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  byCategory,
  filterRange,
  monthKey,
  monthLabel,
  monthlySeries,
  recurringPayments,
  summarize,
  topCounterparties,
  type Range,
} from "@/lib/bank/analytics";
import type { ExpenseCategory } from "@/lib/bank/types";
import type { TxListRow } from "@/lib/data";
import { money, moneyK, perc, plural } from "@/lib/format";
import { MonthsChart } from "./MonthsChart";
import { Segmented } from "./ui";
import { hub } from "@/lib/hub-path";

type Span = "3" | "12" | "all";

/** Posun data o N měsíců zpátky. Na den v měsíci se nekouká — období se
 * počítá od prvního dne, aby „posledních 12 měsíců" nezačínalo v půlce. */
function monthsBack(iso: string, months: number): string {
  const [y, m] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) - (months - 1);
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

export function FinanceOverviewClient({
  transactions,
  categories,
}: {
  transactions: TxListRow[];
  categories: ExpenseCategory[];
}) {
  const [span, setSpan] = useState<Span>("12");

  /** Období se počítá od poslední transakce, ne od dneška. Kdyby se výpis
   * měsíc nenahrál, „poslední tři měsíce" by ukázaly prázdno a vypadalo by
   * to, že se neutrácí — místo aby bylo vidět, že chybí data. */
  const anchor = useMemo(
    () => transactions.reduce((m, t) => (t.bookedAt > m ? t.bookedAt : m), ""),
    [transactions],
  );

  const range: Range = useMemo(() => {
    if (span === "all" || !anchor) return {};
    return { from: monthsBack(anchor, Number(span)), to: anchor };
  }, [span, anchor]);

  const shown = useMemo(
    () => filterRange(transactions, range),
    [transactions, range],
  );

  const sum = useMemo(() => summarize(shown, categories), [shown, categories]);
  const rawSeries = useMemo(
    () => monthlySeries(shown, categories),
    [shown, categories],
  );
  /** Graf ukazuje celé zvolené okno, i měsíce bez jediné transakce —
   * jinak by „12 měsíců" s daty za jeden měsíc vypadalo jako jeden sloupec
   * uprostřed prázdna a nebylo by poznat, že jedenáct měsíců chybí. */
  const series = useMemo(() => {
    if (span === "all" || !anchor) return rawSeries;
    const by = new Map(rawSeries.map((p) => [p.key, p]));
    const keys: string[] = [];
    let [y, m] = monthKey(anchor).split("-").map(Number);
    for (let i = 0; i < Number(span); i++) {
      keys.unshift(`${y}-${String(m).padStart(2, "0")}`);
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
    }
    return keys.map(
      (k) =>
        by.get(k) ?? { key: k, label: monthLabel(k), expense: 0, income: 0, net: 0 },
    );
  }, [rawSeries, span, anchor]);
  const cats = useMemo(() => byCategory(shown, categories), [shown, categories]);
  const top = useMemo(
    () => topCounterparties(shown, categories, 8),
    [shown, categories],
  );
  const recurring = useMemo(
    () => recurringPayments(shown, categories),
    [shown, categories],
  );

  if (!transactions.length) {
    return (
      <div className="card">
        <div className="empty">
          <b>Zatím tu nejsou žádné transakce</b>
          Nahraj bankovní výpis v CSV a analytika se spočítá sama.
          <div style={{ marginTop: 14 }}>
            <Link className="btn primary" href={hub("/finance/import")}>
              Nahrát výpis
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const maxCat = cats.length ? cats[0].expense : 0;

  return (
    <>
      <div
        className="row"
        style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}
      >
        <Segmented
          value={span}
          onChange={setSpan}
          options={[
            { v: "3", label: "3 měsíce" },
            { v: "12", label: "12 měsíců" },
            { v: "all", label: "Vše" },
          ]}
        />
      </div>

      <div className="card">
        <div className="kpis">
          <div className="kpi">
            <label>Výdaje</label>
            <div className="v tnum">{moneyK(sum.expense)}</div>
            <div className="sub">
              {sum.txCount} {plural(sum.txCount, "transakce", "transakce", "transakcí")}
            </div>
          </div>
          <div className="kpi">
            <label>Příjmy</label>
            <div className="v tnum" style={{ color: "var(--green)" }}>
              {moneyK(sum.income)}
            </div>
            <div className="sub">z bankovního výpisu</div>
          </div>
          <div className="kpi">
            <label>Saldo</label>
            <div
              className="v tnum"
              style={{ color: sum.net >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {moneyK(sum.net)}
            </div>
            <div className="sub">příjmy minus výdaje</div>
          </div>
          <div className="kpi">
            <label>Nezařazeno</label>
            <div
              className="v tnum"
              style={{
                color:
                  sum.uncategorizedShare > 0.2
                    ? "var(--amber)"
                    : "var(--tx)",
              }}
            >
              {perc(sum.uncategorizedShare)}
            </div>
            <div className="sub">
              {sum.uncategorizedCount}{" "}
              {plural(sum.uncategorizedCount, "transakce", "transakce", "transakcí")}{" "}
              bez kategorie
            </div>
          </div>
        </div>
      </div>

      {sum.uncategorizedShare > 0.2 ? (
        <div className="note" style={{ marginTop: 14 }}>
          Bez kategorie je {perc(sum.uncategorizedShare)} objemu výdajů. Dokud je
          to takhle vysoko, rozpad níž ukazuje spíš to, co je zařazené, než to,
          za co se utrácí.{" "}
          <Link href={hub("/finance/transakce?jen=nezarazene")}>Zařadit zbytek</Link>.
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          Měsíční vývoj
          <small>výdaje a příjmy podle měsíce zaúčtování</small>
        </h2>
        <div className="body">
          <MonthsChart series={series} />
        </div>
      </div>

      <div className="cols c2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>
            Za co se utrácí
            <small>rozpad výdajů podle kategorií</small>
          </h2>
          <div className="body">
            {cats.length ? (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Kategorie</th>
                      <th className="n">Výdaje</th>
                      <th className="n">Podíl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr key={c.categoryId ?? "none"}>
                        <td>
                          <span style={{ display: "flex", alignItems: "center" }}>
                            <span
                              className="cat-dot"
                              style={{ background: c.color }}
                            />
                            {c.name}
                          </span>
                        </td>
                        <td className="n tnum">{money(c.expense)}</td>
                        <td className="n" style={{ width: 130 }}>
                          <span className="bar-cell">
                            <span className="bar-track">
                              <span
                                className="bar-fill"
                                style={{
                                  width: `${maxCat ? (c.expense / maxCat) * 100 : 0}%`,
                                  background: c.color,
                                }}
                              />
                            </span>
                            <span className="tnum" style={{ minWidth: 42 }}>
                              {perc(c.share)}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <b>V období nejsou žádné výdaje</b>
                Zkus delší období nebo nahraj další výpis.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2>
            Komu se platí
            <small>největší protistrany v období</small>
          </h2>
          <div className="body">
            {top.length ? (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Protistrana</th>
                      <th className="n">Výdaje</th>
                      <th className="n">Plateb</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((c) => (
                      <tr key={c.key}>
                        <td>{c.name}</td>
                        <td className="n tnum">{money(c.expense)}</td>
                        <td className="n tnum">{c.txCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <b>V období nejsou žádné výdaje</b>
                Zkus delší období.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>
          Pravidelné platby
          <small>protistrany, kterým se platilo aspoň ve třech měsících</small>
        </h2>
        <div className="body">
          {recurring.length ? (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Protistrana</th>
                    <th className="n">Měsíčně</th>
                    <th className="n">Obvykle</th>
                    <th className="n">Měsíců</th>
                    <th className="n">Celkem</th>
                    <th>Od–do</th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((r) => (
                    <tr key={r.key}>
                      <td>
                        {r.name}
                        {r.stable ? null : (
                          <span className="pill off" style={{ marginLeft: 8 }}>
                            kolísá
                          </span>
                        )}
                      </td>
                      <td className="n tnum">{money(r.monthlyAvg)}</td>
                      <td className="n tnum">{money(r.median)}</td>
                      <td className="n tnum">{r.months}</td>
                      <td className="n tnum">{money(r.total)}</td>
                      <td className="tnum" style={{ color: "var(--tx-3)" }}>
                        {r.firstAt} – {r.lastAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <b>Zatím se neopakuje nic</b>
              Pravidelná platba se pozná až ze tří různých měsíců. Nahraj delší
              období.
            </div>
          )}
        </div>
      </div>

      {sum.fees > 0 ? (
        <p className="note" style={{ marginTop: 14 }}>
          Ve sloupci s poplatky je za období {money(sum.fees)}. Do výdajů se
          nepřičítá — banka poplatek většinou strhává samostatnou transakcí,
          která je ve výpisu vedle, a přičtením by se započítal dvakrát.
        </p>
      ) : null}
    </>
  );
}
