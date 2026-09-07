"use client";

import { useState } from "react";
import type { MonthPoint } from "@/lib/bank/analytics";
import { money, moneyK } from "@/lib/format";

/**
 * Měsíční výdaje a příjmy vedle sebe.
 *
 * Osa Y má tři hodnoty a mřížku, poměr stran je pevný — jinak se při úzké
 * kartě popisky měsíců slijí. Měsíce bez transakcí sem chodí jako nuly
 * (viz monthlySeries), takže mezera ve výpisu je v grafu vidět jako mezera,
 * ne jako rovnoměrné utrácení.
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

  const W = 560;
  const H = 170;
  const padL = 52;
  const padR = 8;
  const padT = 10;
  const padB = 26;

  const max = Math.max(...series.map((p) => Math.max(p.expense, p.income)), 1);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const step = innerW / series.length;
  const barW = Math.max(3, Math.min(18, step / 2 - 3));

  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];

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
              stroke="var(--line)"
              strokeWidth="1"
              opacity={i === 0 ? 0.9 : 0.45}
            />
            <text
              x={padL - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--tx-3)"
            >
              {t === 0 ? "0" : moneyK(t)}
            </text>
          </g>
        ))}

        {series.map((p, i) => {
          const cx = padL + i * step + step / 2;
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
                fill="transparent"
              />
              <rect
                x={cx - barW - 1}
                y={y(p.expense)}
                width={barW}
                height={Math.max(0, padT + innerH - y(p.expense))}
                fill="var(--amber)"
                opacity={hover === null || hover === i ? 0.92 : 0.4}
                rx="1.5"
              />
              <rect
                x={cx + 1}
                y={y(p.income)}
                width={barW}
                height={Math.max(0, padT + innerH - y(p.income))}
                fill="var(--green)"
                opacity={hover === null || hover === i ? 0.85 : 0.35}
                rx="1.5"
              />
              {i % labelEvery === 0 ? (
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--tx-3)"
                >
                  {p.key.slice(5)}/{p.key.slice(2, 4)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

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
          {active
            ? `${active.label}: výdaje ${money(active.expense)}, příjmy ${money(active.income)}`
            : `${series[0].label} – ${series[series.length - 1].label}`}
        </span>
      </div>
    </div>
  );
}
