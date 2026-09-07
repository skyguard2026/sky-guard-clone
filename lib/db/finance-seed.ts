/**
 * Naplnění výchozích kategorií a pravidel. Idempotentní.
 *
 * Stejné pravidlo jako u katalogu: plní se jen prázdná tabulka. Kategorie,
 * které si jednatel přejmenoval nebo smazal, se dalším deployem nevrátí.
 */
import { sql } from "drizzle-orm";
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from "../bank/defaults";
import { categoryRules, expenseCategories } from "./schema";
import type { AnyPgDatabase } from "./seed-core";

export interface FinanceSeedReport {
  categoriesSeeded: boolean;
  categoryCount: number;
  rulesSeeded: boolean;
  ruleCount: number;
}

export function categoryRows() {
  return DEFAULT_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    color: c.color,
    note: c.note,
    sort: c.sort,
  }));
}

export function ruleRows() {
  return DEFAULT_RULES.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    field: r.field,
    op: r.op,
    value: r.value,
    priority: r.priority,
    enabled: r.enabled,
  }));
}

export async function seedFinanceIfEmpty(
  db: AnyPgDatabase,
): Promise<FinanceSeedReport> {
  const catCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(expenseCategories);
  let categoriesSeeded = false;
  if ((catCount[0]?.n ?? 0) === 0) {
    await db.insert(expenseCategories).values(categoryRows());
    categoriesSeeded = true;
  }

  const ruleCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(categoryRules);
  let rulesSeeded = false;
  // Pravidla se plní jen spolu s kategoriemi — bez nich by odkazovala
  // na kategorie, které si mezitím někdo přejmenoval k jinému účelu.
  if (categoriesSeeded && (ruleCount[0]?.n ?? 0) === 0) {
    await db.insert(categoryRules).values(ruleRows());
    rulesSeeded = true;
  }

  const [cats, rules] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(expenseCategories),
    db.select({ n: sql<number>`count(*)::int` }).from(categoryRules),
  ]);

  return {
    categoriesSeeded,
    categoryCount: cats[0]?.n ?? 0,
    rulesSeeded,
    ruleCount: rules[0]?.n ?? 0,
  };
}
