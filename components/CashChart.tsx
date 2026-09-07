"use client";

import { useState } from "react";
import type { CalcResult } from "@/lib/calc";
import { money, moneyK } from "@/lib/format";

/**
 * Kumulativní hotovost za horizont.
 *
 * Svislé čáry jsou obnovy. Měsíce, kde se sejdou dvě a víc naráz, jsou
 * odlišené silněji — u dronu to jsou 25., 43. a 61. měsíc a jsou to
 * nejtenčí místa celého průběhu.
 */
export function CashChart({ r }: { r: CalcResult }) {
  const [hover, setHover] = useState<number | null>(null);

  const H = r.horizon;
  const f = r.flow;
  const min = Math.min(...f);
  const max = Math.max(...f, 0);
  const W = 560;
  const Ht = 150;
  const pad = 6;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / H;
  const y = (v: number) => {
    const span = max - min || 1;
    return Ht - ((v - min) / span) * (Ht - 16) - 8;
  };
  const pts = f.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0);

  const events = Object.entries(r.eventDetails)
    .map(([m, list]) => ({
      month: Number(m),
      list,
      amount: list.reduce((s, e) => s + e.amount, 0),
      multi: list.length > 1,
    }))
    .filter((e) => e.month <= H);

  const aktivni = hover === null ? null : events.find((e) => e.month === hover);

  const shrnuti =
    `Kumulativní hotovost za ${H} měsíců. Start ${money(f[0])}, ` +
    `konec ${money(f[H])}. ` +
    (r.payback === null
      ? f[H] >= 0
        ? "Hotovost nebyla nikdy záporná."
        : "Investice se v horizontu nevrátí."
      : `Návratnost ${r.payback}. měsíc.`) +
    (events.length
      ? ` Obnovy v měsících ${events.map((e) => e.month).join(", ")}.`
      : " Bez obnov.");

  return (
    <div className="chart" style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${Ht}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={shrnuti}
      >
        <title>{shrnuti}</title>
        <defs>
          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity=".28" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {events.map((e) => (
          <line
            key={e.month}
            x1={x(e.month)}
            y1={6}
            x2={x(e.month)}
            y2={Ht - 2}
            stroke="var(--amber)"
            strokeWidth={e.multi ? 2 : 1}
            strokeDasharray={e.multi ? undefined : "2 3"}
            opacity={hover === e.month ? 1 : e.multi ? 0.75 : 0.5}
          />
        ))}

        <line
          x1={0}
          y1={zeroY}
          x2={W}
          y2={zeroY}
          stroke="var(--line-2)"
          strokeWidth={1}
        />
        <polygon
          points={`${pts} ${x(H)},${zeroY} ${x(0)},${zeroY}`}
          fill="url(#cashGrad)"
        />
        <polyline
          points={pts}
          fill="none"
          stroke="var(--blue)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {r.payback !== null ? (
          <circle
            cx={x(r.payback)}
            cy={y(f[r.payback])}
            r={4}
            fill="var(--green)"
          />
        ) : null}

        {/* široké neviditelné pruhy, ať se dá čára trefit myší i prstem */}
        {events.map((e) => (
          <rect
            key={`hit-${e.month}`}
            x={x(e.month) - 7}
            y={0}
            width={14}
            height={Ht}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(e.month)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(hover === e.month ? null : e.month)}
          />
        ))}
      </svg>

      {aktivni ? (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: 4,
            left: `${(x(aktivni.month) / W) * 100}%`,
            transform:
              aktivni.month > H * 0.6
                ? "translateX(-100%) translateX(-10px)"
                : "translateX(10px)",
            background: "var(--raise)",
            border: "1px solid var(--line-2)",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 12.5,
            lineHeight: 1.5,
            zIndex: 5,
            pointerEvents: "none",
            minWidth: 170,
            boxShadow: "0 8px 24px rgba(3,7,13,.5)",
          }}
        >
          <div style={{ color: "var(--tx-3)", fontSize: 11.5 }}>
            {aktivni.month}. měsíc
            {aktivni.multi ? " · souběh obnov" : ""}
          </div>
          <div
            style={{
              fontWeight: 700,
              color: "var(--amber)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {money(aktivni.amount)}
          </div>
          <div style={{ marginTop: 4, color: "var(--tx-2)" }}>
            {aktivni.list.map((e) => (
              <div
                key={e.label}
                style={{ display: "flex", gap: 10, justifyContent: "space-between" }}
              >
                <span>{e.label}</span>
                <span
                  className="muted"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {money(e.amount)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 5, color: "var(--tx-3)", fontSize: 11.5 }}>
            hotovost po obnově {money(f[aktivni.month])}
          </div>
        </div>
      ) : null}

      <div className="cap">
        <span>Kumulativní hotovost — start {moneyK(f[0])}</span>
        <span>
          {events.some((e) => e.multi)
            ? "silná čára = souběh obnov"
            : "čárkovaně = obnova"}
          {" · "}
          {H}. měsíc {moneyK(f[H])}
        </span>
      </div>
    </div>
  );
}
