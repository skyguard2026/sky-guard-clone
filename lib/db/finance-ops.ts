/**
 * Zápisy finanční sekce. Odděleně od server actions, aby šly otestovat
 * proti skutečné databázi.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { categorize, recategorize } from "../bank/categorize";
import type { ParsedRow, ParsedStatement } from "../bank/rb-csv";
import type { CategoryRule } from "../bank/types";
import { uid } from "../id";
import { bankImports, bankTransactions, categoryRules } from "./schema";
import type { AnyPgDatabase } from "./seed-core";

/**
 * Postgres unese 65 535 parametrů na dotaz a řádek transakce má 21 sloupců.
 * Pět set řádků na dávku je bezpečně pod hranicí i s rezervou na budoucí sloupec.
 */
const CHUNK = 500;

export interface ImportResult {
  importId: string;
  rowCount: number;
  newCount: number;
  dupeCount: number;
  problemCount: number;
}

function rulesFromRows(rows: (typeof categoryRules.$inferSelect)[]): CategoryRule[] {
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    field: r.field,
    op: r.op,
    value: r.value,
    priority: r.priority,
    enabled: r.enabled,
  }));
}

export async function loadRules(db: AnyPgDatabase): Promise<CategoryRule[]> {
  const rows = await db.select().from(categoryRules);
  return rulesFromRows(rows);
}

/**
 * Uloží rozparsovaný výpis.
 *
 * Duplicity nechává odmítnout databázi přes unikátní index, ne kontrolou
 * v kódu. Kdyby dva lidé nahráli překrývající se výpisy naráz, obě kontroly
 * by proběhly dřív, než první z nich zapíše, a transakce by se uložily dvakrát.
 */
export async function importStatement(
  db: AnyPgDatabase,
  args: {
    filename: string;
    statement: ParsedStatement;
    note?: string;
  },
): Promise<ImportResult> {
  const { filename, statement } = args;
  const importId = uid();
  const rules = await loadRules(db);

  await db.insert(bankImports).values({
    id: importId,
    filename: filename.slice(0, 300),
    account: statement.account ?? "",
    rowCount: statement.rows.length,
    newCount: 0,
    dupeCount: 0,
    problemCount: statement.problems.length,
    periodFrom: statement.periodFrom,
    periodTo: statement.periodTo,
    note: (args.note ?? "").slice(0, 2000),
  });

  const toRow = (r: ParsedRow) => {
    const hit = categorize(r, rules);
    return {
      id: uid(),
      importId,
      bookedAt: r.bookedAt,
      valueDate: r.valueDate,
      account: r.account,
      amount: r.amount,
      currency: r.currency,
      counterAccount: r.counterAccount,
      counterName: r.counterName,
      vs: r.vs,
      ks: r.ks,
      ss: r.ss,
      message: r.message,
      note: r.note,
      txType: r.txType,
      fee: r.fee,
      externalId: r.externalId,
      dedupeKey: r.dedupeKey,
      categoryId: hit?.categoryId ?? null,
      categorySource: hit ? ("rule" as const) : null,
      raw: r.raw,
    };
  };

  let newCount = 0;
  for (let i = 0; i < statement.rows.length; i += CHUNK) {
    const chunk = statement.rows.slice(i, i + CHUNK).map(toRow);
    if (!chunk.length) continue;
    const inserted = await db
      .insert(bankTransactions)
      .values(chunk)
      .onConflictDoNothing({
        target: [bankTransactions.account, bankTransactions.dedupeKey],
      })
      .returning({ id: bankTransactions.id });
    newCount += inserted.length;
  }

  const dupeCount = statement.rows.length - newCount;
  await db
    .update(bankImports)
    .set({ newCount, dupeCount })
    .where(eq(bankImports.id, importId));

  return {
    importId,
    rowCount: statement.rows.length,
    newCount,
    dupeCount,
    problemCount: statement.problems.length,
  };
}

/**
 * Vrácení importu. Smaže i transakce, které přinesl — včetně jejich ručního
 * zařazení. Transakce, které přišly dřív jiným výpisem, zůstávají: patří
 * svému importu, ne tomu, ve kterém se objevily podruhé.
 */
export async function deleteImport(
  db: AnyPgDatabase,
  importId: string,
): Promise<{ deleted: number }> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bankTransactions)
    .where(eq(bankTransactions.importId, importId));
  await db.delete(bankImports).where(eq(bankImports.id, importId));
  return { deleted: rows[0]?.n ?? 0 };
}

/**
 * Ruční zařazení jedné nebo více transakcí.
 *
 * Prázdná kategorie znamená vrátit transakci pravidlům, ne „natrvalo bez
 * kategorie" — na to je kategorie Ignorovat. Kdyby vyčištění zůstalo ruční,
 * transakce by se pravidlům odebrala navždy a nikdo by nepoznal proč.
 */
export async function setTxCategory(
  db: AnyPgDatabase,
  ids: string[],
  categoryId: string | null,
): Promise<{ updated: number }> {
  if (!ids.length) return { updated: 0 };
  const rows = await db
    .update(bankTransactions)
    .set({
      categoryId,
      categorySource: categoryId ? "manual" : null,
    })
    .where(inArray(bankTransactions.id, ids))
    .returning({ id: bankTransactions.id });
  return { updated: rows.length };
}

export interface ApplyRulesResult {
  considered: number;
  changed: number;
  /** Kolik transakcí zůstalo netknutých, protože je zařadil člověk. */
  skippedManual: number;
}

/**
 * Přepočet pravidel nad všemi transakcemi.
 *
 * Ručně zařazené se přeskakují — viz lib/bank/categorize.ts. Spouští se po
 * změně pravidel a z tlačítka v Kategoriích.
 */
export async function applyRules(
  db: AnyPgDatabase,
): Promise<ApplyRulesResult> {
  const rules = await loadRules(db);
  const txs = await db
    .select({
      id: bankTransactions.id,
      counterName: bankTransactions.counterName,
      counterAccount: bankTransactions.counterAccount,
      vs: bankTransactions.vs,
      message: bankTransactions.message,
      note: bankTransactions.note,
      txType: bankTransactions.txType,
      categoryId: bankTransactions.categoryId,
      categorySource: bankTransactions.categorySource,
    })
    .from(bankTransactions);

  const results = recategorize(txs, rules);
  const changed = results.filter((r) => r.changed);

  // Seskupení podle cílové kategorie — jeden UPDATE na kategorii místo
  // jednoho na transakci. U tisíců řádků je to rozdíl mezi vteřinou a minutou.
  const byCategory = new Map<string | null, string[]>();
  for (const r of changed) {
    const list = byCategory.get(r.categoryId) ?? [];
    list.push(r.tx.id);
    byCategory.set(r.categoryId, list);
  }

  for (const [categoryId, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      await db
        .update(bankTransactions)
        .set({
          categoryId,
          categorySource: categoryId ? "rule" : null,
        })
        .where(inArray(bankTransactions.id, ids.slice(i, i + CHUNK)));
    }
  }

  return {
    considered: txs.length,
    changed: changed.length,
    skippedManual: txs.filter((t) => t.categorySource === "manual").length,
  };
}

/** Kolik transakcí by pravidlo zabralo. Do náhledu při jeho zakládání. */
export async function previewRule(
  db: AnyPgDatabase,
  rule: CategoryRule,
): Promise<{ matches: number; manual: number }> {
  const txs = await db
    .select({
      counterName: bankTransactions.counterName,
      counterAccount: bankTransactions.counterAccount,
      vs: bankTransactions.vs,
      message: bankTransactions.message,
      note: bankTransactions.note,
      txType: bankTransactions.txType,
      categorySource: bankTransactions.categorySource,
    })
    .from(bankTransactions);

  let matches = 0;
  let manual = 0;
  for (const tx of txs) {
    const hit = categorize(tx, [rule]);
    if (!hit) continue;
    matches++;
    if (tx.categorySource === "manual") manual++;
  }
  return { matches, manual };
}

/** Počet transakcí, které na kategorii odkazují. Do potvrzení před smazáním. */
export async function countTxInCategory(
  db: AnyPgDatabase,
  categoryId: string,
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bankTransactions)
    .where(eq(bankTransactions.categoryId, categoryId));
  return rows[0]?.n ?? 0;
}

/** Smaže všechny finanční data. Vědomá akce z Nastavení. */
export async function wipeFinance(db: AnyPgDatabase): Promise<void> {
  await db.delete(bankTransactions);
  await db.delete(bankImports);
}
