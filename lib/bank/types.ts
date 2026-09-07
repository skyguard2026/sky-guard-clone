/**
 * Typy finanční sekce. Bez závislosti na databázi i na Reactu — stejně jako
 * lib/calc.ts, aby se parser i analytika daly volat ze serveru i z klienta.
 */

/** Druh kategorie. Určuje, jestli částka vstupuje do výdajů, příjmů, nebo nikam. */
export type CategoryKind = "expense" | "income" | "transfer" | "ignore";

export interface ExpenseCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  /** CSS barva pro graf a štítek. */
  color: string;
  note: string;
  sort: number;
}

/** Pole transakce, proti kterému se pravidlo vyhodnocuje. */
export type RuleField =
  | "counterName"
  | "counterAccount"
  | "vs"
  | "message"
  | "note"
  | "txType"
  | "any";

export type RuleOp = "contains" | "equals" | "startsWith";

export interface CategoryRule {
  id: string;
  categoryId: string;
  field: RuleField;
  op: RuleOp;
  value: string;
  /** Nižší číslo vyhrává. Při shodě rozhoduje id, aby bylo pořadí stabilní. */
  priority: number;
  enabled: boolean;
}

/** Kdo transakci zařadil. Ruční zařazení pravidlo nikdy nepřepíše. */
export type CategorySource = "rule" | "manual" | null;

export interface BankTx {
  id: string;
  importId: string;
  /** Datum zaúčtování, ISO YYYY-MM-DD. */
  bookedAt: string;
  /** Datum provedení, když ho výpis uvádí zvlášť. */
  valueDate: string | null;
  /** Vlastní účet, ze kterého výpis pochází. */
  account: string;
  /** Kladná = příjem, záporná = výdaj. Znaménko z výpisu, nepřevrací se. */
  amount: number;
  currency: string;
  counterAccount: string;
  counterName: string;
  vs: string;
  ks: string;
  ss: string;
  message: string;
  note: string;
  txType: string;
  fee: number;
  /** Id transakce z výpisu, když ho banka uvádí. */
  externalId: string | null;
  dedupeKey: string;
  categoryId: string | null;
  categorySource: CategorySource;
  /** Původní řádek výpisu, sloupec po sloupci. Ať jde vždycky dohledat originál. */
  raw: Record<string, string>;
}

export interface BankImport {
  id: string;
  filename: string;
  importedAt: string;
  account: string;
  /** Kolik datových řádků soubor obsahoval. */
  rowCount: number;
  /** Kolik z nich se uložilo jako nové. */
  newCount: number;
  /** Kolik z nich už v databázi bylo. */
  dupeCount: number;
  /** Kolik řádků parser odmítl. Rozpis je v problems. */
  problemCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  note: string;
}
