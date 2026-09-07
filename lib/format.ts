/** Formátování v češtině — SPEC.md §6. Mezera jako oddělovač tisíců, Kč za číslem. */

const nbsp = / /g;

export function money(n: number): string {
  const v = Math.round(n || 0);
  return `${v.toLocaleString("cs-CZ").replace(nbsp, " ")} Kč`;
}

/** Nad 100 000 Kč se v souhrnech zkracuje na tisíce. */
export function moneyK(n: number): string {
  const v = n || 0;
  if (Math.abs(v) >= 100000) {
    return `${(v / 1000)
      .toLocaleString("cs-CZ", { maximumFractionDigits: 0 })
      .replace(nbsp, " ")} tis. Kč`;
  }
  return money(v);
}

export function perc(x: number): string {
  return `${((x || 0) * 100)
    .toLocaleString("cs-CZ", { maximumFractionDigits: 1 })
    .replace(nbsp, " ")} %`;
}

export function num(n: number, max = 2): string {
  return (n || 0)
    .toLocaleString("cs-CZ", { maximumFractionDigits: max })
    .replace(nbsp, " ");
}

/** České skloňování za číslovkou. */
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const i = Math.abs(Math.round(n));
  if (i === 1) return one;
  if (i >= 2 && i <= 4) return few;
  return many;
}

/** Barevné prahy marže — SPEC.md §3.8. */
export function marginClass(margin: number): "good" | "warn" | "bad" {
  if (margin >= 0.4) return "good";
  if (margin >= 0.2) return "warn";
  return "bad";
}

export function marginColor(margin: number): string {
  return `var(--${marginClass(margin) === "good" ? "green" : marginClass(margin) === "warn" ? "amber" : "red"})`;
}
