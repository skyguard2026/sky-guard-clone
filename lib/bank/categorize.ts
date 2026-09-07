/**
 * Zařazení transakce do kategorie podle pravidel.
 *
 * Čistá funkce. Pravidla se vyhodnocují v pořadí podle priority a vyhrává
 * první, které sedne — ne to nejpřesnější. Je to schválně: pořadí je vidět
 * a dá se přetáhnout, kdežto „nejlepší shoda" je černá skříňka, u které
 * nikdo nepozná, proč platba spadla jinam, než čekal.
 */
import type { BankTx, CategoryRule, RuleField } from "./types";

/** Porovnává se bez diakritiky a velikosti písmen — „Alza" i „ALZA" je Alza. */
export function fold(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type Matchable = Pick<
  BankTx,
  "counterName" | "counterAccount" | "vs" | "message" | "note" | "txType"
>;

function fieldValue(tx: Matchable, field: RuleField): string {
  switch (field) {
    case "counterName":
      return tx.counterName;
    case "counterAccount":
      return tx.counterAccount;
    case "vs":
      return tx.vs;
    case "message":
      return tx.message;
    case "note":
      return tx.note;
    case "txType":
      return tx.txType;
    case "any":
      return [
        tx.counterName,
        tx.counterAccount,
        tx.vs,
        tx.message,
        tx.note,
        tx.txType,
      ].join(" ");
  }
}

export function ruleMatches(tx: Matchable, rule: CategoryRule): boolean {
  if (!rule.enabled) return false;
  const needle = fold(rule.value);
  // Prázdné pravidlo by sedlo na všechno a tiše spolklo celý výpis.
  if (!needle) return false;
  const hay = fold(fieldValue(tx, rule.field));
  if (!hay) return false;
  switch (rule.op) {
    case "contains":
      return hay.includes(needle);
    case "equals":
      return hay === needle;
    case "startsWith":
      return hay.startsWith(needle);
  }
}

/** Pravidla v pořadí, ve kterém se vyhodnocují. */
export function sortRules(rules: CategoryRule[]): CategoryRule[] {
  return [...rules].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );
}

/** Kategorie podle prvního vyhovujícího pravidla, jinak null. */
export function categorize(
  tx: Matchable,
  rules: CategoryRule[],
): { categoryId: string; ruleId: string } | null {
  for (const rule of sortRules(rules)) {
    if (ruleMatches(tx, rule)) {
      return { categoryId: rule.categoryId, ruleId: rule.id };
    }
  }
  return null;
}

export interface RecategorizeResult<T> {
  tx: T;
  categoryId: string | null;
  changed: boolean;
}

/**
 * Přepočet pravidel nad existujícími transakcemi.
 *
 * Ručně zařazené transakce zůstávají nedotčené. Automatický krok nesmí
 * přepsat to, co nastavil člověk — jinak si uživatel po každém přidání
 * pravidla přepíše vlastní práci a přestane pravidlům věřit.
 */
export function recategorize<
  T extends Matchable & { categoryId: string | null; categorySource: string | null },
>(txs: T[], rules: CategoryRule[]): RecategorizeResult<T>[] {
  const ordered = sortRules(rules);
  const out: RecategorizeResult<T>[] = [];
  for (const tx of txs) {
    if (tx.categorySource === "manual") {
      out.push({ tx, categoryId: tx.categoryId, changed: false });
      continue;
    }
    const hit = categorize(tx, ordered);
    const next = hit?.categoryId ?? null;
    out.push({ tx, categoryId: next, changed: next !== tx.categoryId });
  }
  return out;
}
