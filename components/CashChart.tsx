"use client";

import { useState } from "react";
import type { CalcResult } from "@/lib/calc";
import { niceTicks } from "@/lib/chart-scale";
import { money, moneyK } from "@/lib/format";

/**
 * Kumulativní hotovost za horizont.
 *
 * Osa Y má hezké hodnoty a mřížku, osa X měsíce po půlrocích. Svislé čáry
 * jsou obnovy; měsíce, kde se sejdou dvě a víc naráz, jsou odlišené silněji
 * — u dronu to jsou 25., 43. a 61. měsíc a jsou to nejtenčí místa celého
 * průběhu. Najetím na kterýkoli měsíc se ukáže hotovost v něm.
 */
export function CashChart({ r }: { r: CalcResult }) {
  const [hover, setHover] = useState<number | null>(null);

  const H = r.horizon;
  const f = r.flow;
  // užší plátno než u celostránkových grafů — v polovičním sloupci se text nesmí zmenšit pod čitelnost
  const W = 600;
  const Ht = 250;
  const pad = { l: 70, r: 14, t: 16, b: 30 };

  const { ticks, lo, hi } = niceTicks(Math.min(...f, 0), Math.max(...f, 0), 4);
  const innerW = W - pad.l - pad.r;
  const innerH = Ht - pad.t - pad.b;
  const x = (i: number) => pad.l + (i * innerW) / H;
  const y = (v: number) => pad.t + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  const pts = f.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0);
  const xStep = H > 48 ? 12 : 6;
  const xTicks: number[] = [];
  for (let m = 0; m <= H; m += xStep) xTicks.push(m);

  const events = Object.entries(r.eventDetails)
    .map(([m, list]) => ({
      month: Number(m),
      list,
      amount: list.reduce((s, e) => s + e.amount, 0),
      multi: list.length > 1,
    }))
    .filter((e) => e.month <= H);
  const eventAt = (m: number) => events.find((e) => e.month === m) ?? null;

  const aktivni = hover === null ? null : { month: hover, event: eventAt(hover) };

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
      <svg viewBox={`0 0 ${W} ${Ht}`} role="img" aria-label={shrnuti}>
        <title>{shrnuti}</title>
        <defs>
          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity=".16" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity=".04" />
          </linearGradient>
          <clipPath id="cashClip">
            <rect x={pad.l} y={pad.t} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* mřížka a osa Y */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              y1={y(t)}
              x2={W - pad.r}
              y2={y(t)}
              stroke={t === 0 ? "var(--line-2)" : "var(--line)"}
              strokeWidth={1}
            />
            <text
              x={pad.l - 10}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="11"
              fill="var(--tx-3)"
            >
              {t === 0 ? "0" : moneyK(t)}
            </text>
          </g>
        ))}
        {/* osa X */}
        {xTicks.map((m) => (
          <text
            key={m}
            x={x(m)}
            y={Ht - 9}
            textAnchor="middle"
            fontSize="10.5"
            fill="var(--tx-3)"
          >
            {m}
          </text>
        ))}

        {/* obnovy */}
        {events.map((e) => (
          <line
            key={e.month}
            x1={x(e.month)}
            y1={pad.t}
            x2={x(e.month)}
            y2={pad.t + innerH}
            stroke="var(--amber)"
            strokeWidth={e.multi ? 2 : 1}
            strokeDasharray={e.multi ? undefined : "3 3"}
            opacity={hover === e.month ? 1 : e.multi ? 0.7 : 0.45}
          />
        ))}

        <g clipPath="url(#cashClip)">
          <polygon
            points={`${pts} ${x(H)},${zeroY} ${x(0)},${zeroY}`}
            fill="url(#cashGrad)"
          />
        </g>
        <polyline
          points={pts}
          fill="none"
          stroke="var(--blue)"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* vodítko pod myší */}
        {hover !== null ? (
          <g>
            <line
              x1={x(hover)}
              y1={pad.t}
              x2={x(hover)}
              y2={pad.t + innerH}
              stroke="var(--tx-3)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle
              cx={x(hover)}
              cy={y(f[hover])}
              r={4.5}
              fill="var(--panel)"
              stroke="var(--blue)"
              strokeWidth={2}
            />
          </g>
        ) : null}

        {r.payback !== null ? (
          <g>
            <circle
              cx={x(r.payback)}
              cy={y(f[r.payback])}
              r={5}
              fill="var(--green)"
              stroke="var(--panel)"
              strokeWidth={2}
            />
            <text
              x={x(r.payback)}
              y={y(f[r.payback]) - 10}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fill="var(--green)"
            >
              návratnost {r.payback}. měs
            </text>
          </g>
        ) : null}

        {/* neviditelné pruhy na každý měsíc, ať se dá trefit myší i prstem */}
        {f.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - innerW / H / 2}
            y={pad.t}
            width={innerW / H}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(hover === i ? null : i)}
          />
        ))}
      </svg>

      {aktivni ? (
        <div
          className="chart-tip"
          role="tooltip"
          style={{
            top: 4,
            left: `${(x(aktivni.month) / W) * 100}%`,
            transform:
              aktivni.month > H * 0.6
                ? "translateX(-100%) translateX(-12px)"
                : "translateX(12px)",
          }}
        >
          <div className="t">
            {aktivni.month}. měsíc
            {aktivni.event?.multi ? " · souběh obnov" : aktivni.event ? " · obnova" : ""}
          </div>
          <div className="l">
            <span>Hotovost</span>
            <span
              className="v"
              style={{ color: f[aktivni.month] >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {money(f[aktivni.month])}
            </span>
          </div>
          {aktivni.event ? (
            <div style={{ marginTop: 5 }}>
              {aktivni.event.list.map((e) => (
                <div key={e.label} className="l">
                  <span>{e.label}</span>
                  <span className="muted tnum">{money(e.amount)}</span>
                </div>
              ))}
              <div className="l" style={{ marginTop: 3 }}>
                <span className="t">Obnovy celkem</span>
                <span className="v" style={{ color: "var(--amber)" }}>
                  {money(aktivni.event.amount)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="cap">
        <span>Kumulativní hotovost · start {moneyK(f[0])}</span>
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
