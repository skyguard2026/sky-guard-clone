"use client";

import { useState } from "react";
import type { MonthPoint } from "@/lib/bank/analytics";
import { niceTicks, roundedTopRect, shortMonth } from "@/lib/chart-scale";
import { money, moneyK } from "@/lib/format";

/**
 * Měsíční výdaje a příjmy vedle sebe.
 *
 * Osa Y má „hezké" hodnoty a mřížku, poměr stran je pevný — jinak se při
 * úzké kartě popisky měsíců slijí. Měsíce bez transakcí sem chodí jako nuly,
 * takže mezera ve výpisu je v grafu vidět jako mezera, ne jako rovnoměrné
 * utrácení. Najetím na měsíc se ukáže bublina s přesnými částkami.
 */
export function MonthsChart({ series }: { series: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (!series.length) {
    return (
      <div className="empty">
        <b>Zatím není co kreslit</b>
        Nahraj bankovní výpis a graf se objeví sám.
      </div>
    );
  }

  const W = 720;
  const H = 230;
  const padL = 56;
  const padR = 12;
  const padT = 14;
  const padB = 30;

  const rawMax = Math.max(...series.map((p) => Math.max(p.expense, p.income)), 1);
  const { ticks, hi } = niceTicks(0, rawMax, 4);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const step = innerW / series.length;
  const barW = Math.max(4, Math.min(26, step * 0.3));
  const gap = 3;

  const y = (v: number) => padT + innerH - (v / hi) * innerH;
  const base = padT + innerH;

  // Popisek měsíce jen tam, kde se vejde — u dvou let by se jinak slily.
  const labelEvery = Math.ceil(series.length / 12);

  const totalExpense = series.reduce((s, p) => s + p.expense, 0);
  const totalIncome = series.reduce((s, p) => s + p.income, 0);
  const souhrn =
    `Měsíční výdaje a příjmy za ${series.length} ` +
    `${series.length === 1 ? "měsíc" : series.length < 5 ? "měsíce" : "měsíců"}, ` +
    `od ${series[0].label} do ${series[series.length - 1].label}. ` +
    `Celkem výdaje ${money(totalExpense)}, příjmy ${money(totalIncome)}. ` +
    `Nejvyšší měsíční výdaj ${money(Math.max(...series.map((p) => p.expense)))}.`;

  const active = hover === null ? null : series[hover];
  const activeX = hover === null ? 0 : padL + hover * step + step / 2;

  return (
    <div className="chart" style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={souhrn}>
        <title>{souhrn}</title>

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={y(t)}
              x2={W - padR}
              y2={y(t)}
              stroke={t === 0 ? "var(--line-2)" : "var(--line)"}
              strokeWidth="1"
            />
            <text
              x={padL - 10}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="10.5"
              fill="var(--tx-3)"
            >
              {t === 0 ? "0" : moneyK(t)}
            </text>
          </g>
        ))}

        {series.map((p, i) => {
          const cx = padL + i * step + step / 2;
          const dim = hover !== null && hover !== i;
          return (
            <g
              key={p.key}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={padL + i * step}
                y={padT}
                width={step}
                height={innerH}
                fill={hover === i ? "var(--blue-soft)" : "transparent"}
                rx="4"
              />
              <path
                d={roundedTopRect(cx - barW - gap / 2, y(p.expense), barW, base - y(p.expense), 4)}
                fill="var(--amber)"
                opacity={dim ? 0.35 : 0.95}
              />
              <path
                d={roundedTopRect(cx + gap / 2, y(p.income), barW, base - y(p.income), 4)}
                fill="var(--green)"
                opacity={dim ? 0.35 : 0.9}
              />
              {i % labelEvery === 0 ? (
                <text
                  x={cx}
                  y={H - 9}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={hover === i ? "var(--tx)" : "var(--tx-3)"}
                >
                  {shortMonth(p.key)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {active ? (
        <div
          className="chart-tip"
          role="tooltip"
          style={{
            top: 0,
            left: `${(activeX / W) * 100}%`,
            transform:
              activeX > W * 0.6
                ? "translateX(-100%) translateX(-12px)"
                : "translateX(12px)",
          }}
        >
          <div className="t">{active.label}</div>
          <div className="l">
            <span>
              <span className="legend-dot" style={{ background: "var(--amber)" }} />
              Výdaje
            </span>
            <span className="v">{money(active.expense)}</span>
          </div>
          <div className="l">
            <span>
              <span className="legend-dot" style={{ background: "var(--green)" }} />
              Příjmy
            </span>
            <span className="v">{money(active.income)}</span>
          </div>
          <div className="l" style={{ marginTop: 4 }}>
            <span className="t">Saldo</span>
            <span
              className="v"
              style={{ color: active.net >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {money(active.net)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="cap">
        <span>
          <span className="legend-dot" style={{ background: "var(--amber)" }} />
          Výdaje
          <span
            className="legend-dot"
            style={{ background: "var(--green)", marginLeft: 14 }}
          />
          Příjmy
        </span>
        <span className="tnum">
          {series[0].label} – {series[series.length - 1].label}
        </span>
      </div>
    </div>
  );
}
