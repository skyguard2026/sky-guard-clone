/**
 * Osa grafu s „hezkými" hodnotami.
 *
 * Kroky jsou 1, 2, 2,5 nebo 5 násobky mocniny deseti, takže popisky na ose
 * vycházejí na 0, 25 000, 50 000 … a ne na 41 031 / 82 062. Rozsah se
 * roztáhne na celé násobky kroku, aby nejvyšší sloupec nekončil v čáře
 * mřížky a záporné hodnoty měly vlastní čáru.
 */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export function niceTicks(
  min: number,
  max: number,
  count = 4,
): { ticks: number[]; lo: number; hi: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { ticks: [0], lo: 0, hi: 1 };
  }
  if (min === max) {
    if (min === 0) return { ticks: [0, 1], lo: 0, hi: 1 };
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // celočíselný čítač, aby se nesčítaly desetinné chyby
  const n = Math.round((hi - lo) / step);
  for (let i = 0; i <= n; i++) ticks.push(lo + i * step);
  return { ticks, lo, hi };
}

/** Obdélník se zaoblenou jen horní hranou — sloupec grafu. */
export function roundedTopRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  if (h <= 0 || w <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  const x2 = x + w;
  const y2 = y + h;
  return (
    `M${x.toFixed(1)},${y2.toFixed(1)} ` +
    `V${(y + rr).toFixed(1)} ` +
    `Q${x.toFixed(1)},${y.toFixed(1)} ${(x + rr).toFixed(1)},${y.toFixed(1)} ` +
    `H${(x2 - rr).toFixed(1)} ` +
    `Q${x2.toFixed(1)},${y.toFixed(1)} ${x2.toFixed(1)},${(y + rr).toFixed(1)} ` +
    `V${y2.toFixed(1)} Z`
  );
}

/** Krátké české názvy měsíců pro popisky osy: „říj 25". */
const SHORT_MONTHS = [
  "led",
  "úno",
  "bře",
  "dub",
  "kvě",
  "čvn",
  "čvc",
  "srp",
  "zář",
  "říj",
  "lis",
  "pro",
];
export function shortMonth(key: string): string {
  const [y, m] = key.split("-");
  return `${SHORT_MONTHS[Number(m) - 1] ?? m} ${y.slice(2)}`;
}
