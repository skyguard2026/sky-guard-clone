"use client";

import { useMemo } from "react";
import {
  analyzeContractLength,
  MAX_MONTHS,
  type ContractRow,
} from "@/lib/contract-length";
import { money, num, plural } from "@/lib/format";
import type { CatalogItem, LocationWithClient, Settings } from "@/lib/types";

export function ContractLengthClient({
  location,
  catalog,
  settings,
  locationCount,
}: {
  location: LocationWithClient;
  catalog: CatalogItem[];
  settings: Settings;
  locationCount: number;
}) {
  const a = useMemo(
    () => analyzeContractLength(location, catalog, settings, locationCount),
    [location, catalog, settings, locationCount],
  );

  const doporucena = a.rows.find((r) => r.months === a.recommended)!;
  const nejdelsi = a.rows.find((r) => r.months === a.globalWith)!;
  const zavazek = location.commitmentMonths;
  const soucasna = a.rows.find((r) => r.months === zavazek);

  return (
    <>
      <div className="card">
        <div className="kpis">
          <div className="kpi">
            <label>Doporučená délka pro jednání</label>
            <div className="v blue">{a.recommended} měs</div>
            <div className="sub">
              {money(doporucena.perMonthWith)} na měsíc
            </div>
          </div>
          <div className="kpi">
            <label>Nastavený závazek</label>
            <div
              className={`v ${zavazek === a.recommended ? "good" : "warn"}`}
            >
              {zavazek} měs
            </div>
            <div className="sub">
              {soucasna
                ? `${money(soucasna.perMonthWith)} na měsíc`
                : "mimo rozsah analýzy"}
            </div>
          </div>
          <div className="kpi">
            <label>Optimum bez zůstatku</label>
            <div className="v">{a.bestWithout} měs</div>
            <div className="sub">když hardware nepřeneseš nikam</div>
          </div>
          <div className="kpi">
            <label>Optimum se zůstatkem</label>
            <div className="v">{a.bestWith} měs</div>
            <div className="sub">
              při realizovatelnosti {num(settings.residualRate, 0)} %
            </div>
          </div>
        </div>
        <div className="note">
          <b style={{ color: "var(--tx-2)" }}>
            {a.globalWith >= MAX_MONTHS
              ? "Delší kontrakt je tady vždycky lepší."
              : `Nejlepší v celém rozsahu vychází ${a.globalWith} měsíců.`}
          </b>{" "}
          {a.globalWith} {plural(a.globalWith, "měsíc", "měsíce", "měsíců")}{" "}
          vychází na {money(nejdelsi.perMonthWith)} na měsíc, tedy o{" "}
          {num(a.globalGainPct, 1)} % líp než doporučených {a.recommended}.
          {a.globalGainPct < 2
            ? " Rozdíl je ale malý, takže na délce nad doporučením tolik nezáleží."
            : " Vstupní investice se rozpouští do počtu měsíců a to přebije jakoukoli strukturu obnov."}{" "}
          Doporučení je strop toho, co se s klientem reálně vyjedná, ne
          matematické optimum.
        </div>
      </div>

      <div className="card">
        <h2>
          <span className="tag" />
          Hodnota na měsíc podle délky
          <small>
            zeleně vyznačená jsou lokální optima — vždy měsíc před velkou obnovou
          </small>
        </h2>
        <Graf a={a} />
      </div>

      <div className="cols c2">
        <div className="card">
          <h2>
            <span className="tag" style={{ background: "var(--violet)" }} />
            Rozpad podle délky
            <small>
              Kolik ti kontrakt vynese na jeden měsíc trvání, když skončí
              po dané době.
            </small>
          </h2>
          <div className="scroll-x" style={{ maxHeight: 520, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th className="n">Délka</th>
                  <th className="n">Hotovost na konci</th>
                  <th className="n hide-narrow">Zbytkový HW</th>
                  <th className="n">Na měsíc se zůstatkem</th>
                  <th className="n">Bez zůstatku</th>
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r) => {
                  const optWith = a.localOptimaWith.includes(r.months);
                  const optWithout = a.localOptimaWithout.includes(r.months);
                  const dop = r.months === a.recommended;
                  return (
                    <tr
                      key={r.months}
                      style={
                        dop
                          ? { background: "rgba(59,143,255,.10)" }
                          : optWith || optWithout
                            ? { background: "rgba(61,220,151,.06)" }
                            : undefined
                      }
                    >
                      <td className="n nw">
                        <b>{r.months}</b>
                        {dop ? (
                          <span className="pill" style={{ marginLeft: 6 }}>
                            doporučeno
                          </span>
                        ) : null}
                      </td>
                      <td className="n">{money(r.cash)}</td>
                      <td className="n muted hide-narrow">{money(r.residual)}</td>
                      <td
                        className="n"
                        style={optWith ? { color: "var(--green)" } : undefined}
                      >
                        {money(r.perMonthWith)}
                      </td>
                      <td
                        className="n"
                        style={
                          optWithout ? { color: "var(--green)" } : undefined
                        }
                      >
                        {money(r.perMonthWithout)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>
            <span className="tag" style={{ background: "var(--amber)" }} />
            Kalendář obnov
            <small>proč optima leží tam, kde leží</small>
          </h2>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th className="n">Měsíc</th>
                  <th className="n">Částka</th>
                  <th>Co se obnovuje</th>
                </tr>
              </thead>
              <tbody>
                {a.renewals.map((r) => {
                  const nejdrazsi =
                    r.amount >=
                    Math.max(...a.renewals.map((x) => x.amount)) * 0.9;
                  return (
                    <tr key={r.month}>
                      <td className="n nw">
                        <b>{r.month}.</b>
                        {r.labels.length > 1 ? (
                          <span className="pill" style={{ marginLeft: 6 }}>
                            souběh
                          </span>
                        ) : null}
                      </td>
                      <td
                        className="n"
                        style={
                          nejdrazsi
                            ? { color: "var(--amber)", fontWeight: 700 }
                            : undefined
                        }
                      >
                        {money(r.amount)}
                      </td>
                      <td className="muted">{r.labels.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="note">
            Optimum leží vždycky měsíc před velkou obnovou — tam jsi ji ještě
            nezaplatil a nemůže se stát, že za ni utratíš a klient odejde dřív,
            než se z ní něco vytěží. Nejdražší jsou měsíce, kde se sejde víc
            výměn najednou.
          </div>
        </div>
      </div>
    </>
  );
}

function Graf({ a }: { a: ReturnType<typeof analyzeContractLength> }) {
  const rows: ContractRow[] = a.rows;
  const W = 700;
  const H = 210;
  // vlevo místo na osu Y, dole na popisky měsíců
  const pad = { l: 54, r: 10, t: 12, b: 30 };

  const vals = rows.flatMap((r) => [r.perMonthWith, r.perMonthWithout]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const rezerva = (hi - lo || 1) * 0.1;
  const min = lo - rezerva;
  const max = hi + rezerva;

  const x = (m: number) =>
    pad.l +
    ((m - rows[0].months) / (rows[rows.length - 1].months - rows[0].months)) *
      (W - pad.l - pad.r);
  const y = (v: number) =>
    H - pad.b - ((v - min) / (max - min || 1)) * (H - pad.t - pad.b);

  const linka = (get: (r: ContractRow) => number) =>
    rows.map((r) => `${x(r.months).toFixed(1)},${y(get(r)).toFixed(1)}`).join(" ");

  // tři hodnoty na ose Y: dolní, střední, horní
  const tikyY = [lo, (lo + hi) / 2, hi];
  const mesiceX = [24, 36, 48, 60, 72];

  const shrnuti =
    `Hodnota na měsíc podle délky závazku od 24 do 72 měsíců. ` +
    `Pohybuje se od ${money(lo)} do ${money(hi)}. ` +
    `Lokální optima jsou ${a.localOptimaWith.join(", ")} měsíců, ` +
    `doporučená délka ${a.recommended} měsíců, ` +
    `nejlepší v celém rozsahu ${a.globalWith} měsíců.`;

  return (
    <>
      <div className="chart">
        {/* poměr stran drží graf přes celou šířku na obrazovce i na papíře */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={shrnuti}
          style={{ width: "100%", height: "auto", aspectRatio: `${W} / ${H}` }}
        >
          <title>{shrnuti}</title>

          {/* mřížka a osa Y */}
          {tikyY.map((v) => (
            <g key={v}>
              <line
                x1={pad.l}
                y1={y(v)}
                x2={W - pad.r}
                y2={y(v)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={pad.l - 8}
                y={y(v) + 3.5}
                fontSize={10}
                fill="var(--tx-3)"
                textAnchor="end"
              >
                {/* desetina tisíce, jinak by se blízké hodnoty slily */}
                {(v / 1000).toFixed(1)} tis.
              </text>
            </g>
          ))}

          {a.renewals
            .filter(
              (e) =>
                e.month >= rows[0].months &&
                e.month <= rows[rows.length - 1].months,
            )
            .map((e) => (
              <line
                key={e.month}
                x1={x(e.month)}
                y1={pad.t}
                x2={x(e.month)}
                y2={H - pad.b}
                stroke="var(--amber)"
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.3}
              />
            ))}

          <polyline
            points={linka((r) => r.perMonthWithout)}
            fill="none"
            stroke="var(--tx-3)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <polyline
            points={linka((r) => r.perMonthWith)}
            fill="none"
            stroke="var(--blue)"
            strokeWidth={2}
          />
          {a.localOptimaWith.map((m) => (
            <circle
              key={`w${m}`}
              cx={x(m)}
              cy={y(rows.find((r) => r.months === m)!.perMonthWith)}
              r={3.5}
              fill="var(--green)"
            />
          ))}
          <circle
            cx={x(a.recommended)}
            cy={y(rows.find((r) => r.months === a.recommended)!.perMonthWith)}
            r={6.5}
            fill="none"
            stroke="var(--blue)"
            strokeWidth={2}
          />

          {mesiceX.map((m) => (
            <text
              key={m}
              x={x(m)}
              y={H - 10}
              fontSize={10}
              fill="var(--tx-3)"
              textAnchor="middle"
            >
              {m}
            </text>
          ))}
        </svg>
        <div className="cap">
          <span>Měsíců závazku</span>
          <span>
            rozpětí {money(lo)} až {money(hi)} na měsíc
          </span>
        </div>
      </div>
      <div
        className="legend"
        style={{ padding: "6px 20px 16px", fontSize: 12 }}
      >
        <div style={{ whiteSpace: "nowrap" }}>
          <svg
            width="22"
            height="8"
            aria-hidden
            style={{ flex: "none", width: 22, height: 8, display: "block" }}
          >
            <line x1="0" y1="4" x2="22" y2="4" stroke="var(--blue)" strokeWidth="2" />
          </svg>
          se zbytkovou hodnotou
        </div>
        <div style={{ whiteSpace: "nowrap" }}>
          <svg
            width="22"
            height="8"
            aria-hidden
            style={{ flex: "none", width: 22, height: 8, display: "block" }}
          >
            <line
              x1="0"
              y1="4"
              x2="22"
              y2="4"
              stroke="var(--tx-3)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </svg>
          bez ní
        </div>
        <div style={{ whiteSpace: "nowrap" }}>
          <em style={{ background: "var(--green)", borderRadius: "50%" }} />
          lokální optimum
        </div>
        <div style={{ whiteSpace: "nowrap" }}>
          <svg
            width="22"
            height="8"
            aria-hidden
            style={{ flex: "none", width: 22, height: 8, display: "block" }}
          >
            <line
              x1="11"
              y1="0"
              x2="11"
              y2="8"
              stroke="var(--amber)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          </svg>
          obnova
        </div>
      </div>
    </>
  );
}
