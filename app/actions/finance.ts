"use server";

import { writeAudit } from "@/lib/auth/audit";
import { withAdmin } from "@/lib/auth/guards";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseBankStatement } from "@/lib/bank/parse";
import type { CategoryKind, RuleField, RuleOp } from "@/lib/bank/types";
import { db } from "@/lib/db";
import {
  applyRules,
  countTxInCategory,
  deleteImport,
  importStatement,
  previewRule,
  setTxCategory,
  wipeFinance,
} from "@/lib/db/finance-ops";
import {
  bankImports,
  bankTransactions,
  categoryRules,
  expenseCategories,
} from "@/lib/db/schema";
import { uid } from "@/lib/id";
import { hub } from "@/lib/hub-path";

const KINDS: CategoryKind[] = ["expense", "income", "transfer", "ignore"];
const FIELDS: RuleField[] = [
  "counterName",
  "counterAccount",
  "vs",
  "message",
  "note",
  "txType",
  "any",
];
const OPS: RuleOp[] = ["contains", "equals", "startsWith"];

/** Výpis nad tuhle velikost není výpis. Ochrana proti překlepu při výběru souboru. */
const MAX_CHARS = 20_000_000;

function refresh() {
  revalidatePath(hub("/finance"), "layout");
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

/**
 * Uloží výpis.
 *
 * Text přichází z prohlížeče, kde ho stejná čistá funkce už jednou rozparsovala
 * kvůli náhledu. Server si ho parsuje **znovu** a neuloží nic, co by přišlo
 * hotové z klienta — jinak by stačilo poslat vlastní JSON a zapsat si
 * do databáze cokoli.
 */
async function saveStatement__impl(filename: string, text: string) {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false as const, error: "Soubor je prázdný." };
  }
  if (text.length > MAX_CHARS) {
    return { ok: false as const, error: "Soubor je příliš velký." };
  }

  const statement = parseBankStatement(text);
  if (!statement.ok) {
    return {
      ok: false as const,
      error:
        statement.problems[0]?.detail ??
        "Soubor se nepodařilo přečíst jako bankovní výpis.",
    };
  }

  const res = await importStatement(db, {
    filename: String(filename || "výpis.csv"),
    statement,
  });
  refresh();
  return { ok: true as const, ...res };
}

async function removeImport__impl(id: string) {
  const res = await deleteImport(db, String(id));
  refresh();
  return { ok: true as const, ...res };
}

/* ------------------------------------------------------------------ */
/* Zařazování                                                          */
/* ------------------------------------------------------------------ */

async function assignCategory__impl(ids: string[], categoryId: string | null) {
  const clean = (Array.isArray(ids) ? ids : [])
    .filter((i): i is string => typeof i === "string" && !!i)
    .slice(0, 5000);
  if (!clean.length) return { ok: true as const, updated: 0 };

  const target = categoryId ? String(categoryId) : null;
  if (target) {
    const exists = await db.query.expenseCategories.findFirst({
      where: eq(expenseCategories.id, target),
    });
    if (!exists) return { ok: false as const, error: "Kategorie neexistuje." };
  }

  const res = await setTxCategory(db, clean, target);
  refresh();
  return { ok: true as const, ...res };
}

async function recalcRules__impl() {
  const res = await applyRules(db);
  refresh();
  return { ok: true as const, ...res };
}

/** Poznámka jednatele k transakci. Do klientských výstupů se nedostane. */
async function setTxNote__impl(id: string, note: string) {
  await db
    .update(bankTransactions)
    .set({ note: String(note).slice(0, 2000) })
    .where(eq(bankTransactions.id, String(id)));
  refresh();
  return { ok: true as const };
}

export interface TxDetail {
  id: string;
  note: string;
  /** Původní řádek výpisu, sloupec po sloupci. */
  raw: Record<string, string>;
  importFilename: string;
  importedAt: string;
  dedupeKey: string;
}

/**
 * Detail jedné transakce včetně původního řádku výpisu.
 *
 * `raw` se schválně netahá do seznamu — u tisíců transakcí je to zbytečně
 * velký přenos. Načte se až tady, když se na konkrétní řádek někdo podívá.
 */
async function txDetail__impl(id: string): Promise<TxDetail | null> {
  const rows = await db
    .select({
      id: bankTransactions.id,
      note: bankTransactions.note,
      raw: bankTransactions.raw,
      dedupeKey: bankTransactions.dedupeKey,
      importFilename: bankImports.filename,
      importedAt: bankImports.importedAt,
    })
    .from(bankTransactions)
    .innerJoin(bankImports, eq(bankTransactions.importId, bankImports.id))
    .where(eq(bankTransactions.id, String(id)))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    note: r.note,
    raw: r.raw ?? {},
    importFilename: r.importFilename,
    importedAt: r.importedAt.toISOString(),
    dedupeKey: r.dedupeKey,
  };
}

/**
 * Smaže nahrané výpisy a transakce. Kategorie ani pravidla se nemažou —
 * je to nastavení, které se pracně ladí, a po vymazání dat se hodí znovu.
 *
 * Vědomá akce z Nastavení, s potvrzením.
 */
async function wipeFinanceData__impl() {
  await wipeFinance(db);
  refresh();
  revalidatePath(hub("/nastaveni"));
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Kategorie                                                           */
/* ------------------------------------------------------------------ */

async function createCategory__impl(patch: {
  name: string;
  kind?: CategoryKind;
  color?: string;
}) {
  const name = String(patch.name ?? "").trim().slice(0, 120);
  if (!name) return { ok: false as const, error: "Kategorie musí mít název." };

  const rows = await db.select({ sort: expenseCategories.sort }).from(expenseCategories);
  const maxSort = rows.reduce((m, r) => Math.max(m, r.sort), 0);

  const id = `fc_${uid()}`;
  await db.insert(expenseCategories).values({
    id,
    name,
    kind: KINDS.includes(patch.kind as CategoryKind) ? patch.kind! : "expense",
    color: String(patch.color ?? "#6b7a91").slice(0, 40),
    sort: maxSort + 10,
  });
  refresh();
  return { ok: true as const, id };
}

async function patchCategory__impl(
  id: string,
  patch: { name?: string; kind?: CategoryKind; color?: string; note?: string },
) {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = String(patch.name).trim().slice(0, 120);
    if (!name) return { ok: false as const, error: "Kategorie musí mít název." };
    set.name = name;
  }
  if (patch.kind !== undefined && KINDS.includes(patch.kind)) set.kind = patch.kind;
  if (patch.color !== undefined) set.color = String(patch.color).slice(0, 40);
  if (patch.note !== undefined) set.note = String(patch.note).slice(0, 500);
  if (!Object.keys(set).length) return { ok: true as const };

  await db.update(expenseCategories).set(set).where(eq(expenseCategories.id, String(id)));
  refresh();
  return { ok: true as const };
}

/** Kolik transakcí na kategorii visí. Do potvrzení před smazáním. */
async function categoryUsage__impl(id: string) {
  return { count: await countTxInCategory(db, String(id)) };
}

/**
 * Smaže kategorii. Transakce zůstanou a zařazení se z nich uvolní — o tom,
 * že se tím stanou nezařazenými, se uživatel dozví z potvrzení, ne až z grafu.
 */
async function removeCategory__impl(id: string) {
  await db.delete(expenseCategories).where(eq(expenseCategories.id, String(id)));
  refresh();
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Pravidla                                                            */
/* ------------------------------------------------------------------ */

interface RuleInput {
  categoryId: string;
  field?: RuleField;
  op?: RuleOp;
  value: string;
  priority?: number;
}

function cleanRule(input: RuleInput) {
  return {
    categoryId: String(input.categoryId),
    field: FIELDS.includes(input.field as RuleField)
      ? (input.field as RuleField)
      : "counterName",
    op: OPS.includes(input.op as RuleOp) ? (input.op as RuleOp) : "contains",
    value: String(input.value ?? "").trim().slice(0, 200),
    priority: Number.isFinite(Number(input.priority))
      ? Math.round(Number(input.priority))
      : 100,
  };
}

async function createRule__impl(input: RuleInput) {
  const r = cleanRule(input);
  // Prázdné pravidlo by sedlo na všechno. Jádro ho ignoruje, ale nechat ho
  // vůbec vzniknout by znamenalo řádek v seznamu, který nic nedělá.
  if (!r.value) return { ok: false as const, error: "Pravidlo musí mít hodnotu." };

  const cat = await db.query.expenseCategories.findFirst({
    where: eq(expenseCategories.id, r.categoryId),
  });
  if (!cat) return { ok: false as const, error: "Kategorie neexistuje." };

  const id = `fr_${uid()}`;
  await db.insert(categoryRules).values({ id, ...r, enabled: true });
  const res = await applyRules(db);
  refresh();
  return { ok: true as const, id, changed: res.changed };
}

async function patchRule__impl(
  id: string,
  patch: Partial<RuleInput> & { enabled?: boolean },
) {
  const set: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) set.categoryId = String(patch.categoryId);
  if (patch.field !== undefined && FIELDS.includes(patch.field)) set.field = patch.field;
  if (patch.op !== undefined && OPS.includes(patch.op)) set.op = patch.op;
  if (patch.value !== undefined) {
    const v = String(patch.value).trim().slice(0, 200);
    if (!v) return { ok: false as const, error: "Pravidlo musí mít hodnotu." };
    set.value = v;
  }
  if (patch.priority !== undefined && Number.isFinite(Number(patch.priority)))
    set.priority = Math.round(Number(patch.priority));
  if (patch.enabled !== undefined) set.enabled = !!patch.enabled;
  if (!Object.keys(set).length) return { ok: true as const };

  await db.update(categoryRules).set(set).where(eq(categoryRules.id, String(id)));
  const res = await applyRules(db);
  refresh();
  return { ok: true as const, changed: res.changed };
}

async function removeRule__impl(id: string) {
  await db.delete(categoryRules).where(eq(categoryRules.id, String(id)));
  const res = await applyRules(db);
  refresh();
  return { ok: true as const, changed: res.changed };
}

/** Kolik transakcí by pravidlo zabralo, než se uloží. */
async function testRule__impl(input: RuleInput) {
  const r = cleanRule(input);
  if (!r.value) return { matches: 0, manual: 0 };
  return previewRule(db, { id: "navrh", enabled: true, ...r });
}

/* --- stráže -------------------------------------------------------- */
/* Každá akce prochází obálkou, která ověří přihlášení a roli. Test
   tests/auth-guards.test.ts to vynucuje strukturálně. */

export const saveStatement = withAdmin(async (user, ...args: Parameters<typeof saveStatement__impl>) => {
  const result = await saveStatement__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "finance.imported", String(args[0] ?? ""));
  return result;
});
export const removeImport = withAdmin(async (user, ...args: Parameters<typeof removeImport__impl>) => {
  const result = await removeImport__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "finance.import_reverted", String(args[0] ?? ""));
  return result;
});
export const assignCategory = withAdmin(
  (_user, ...args: Parameters<typeof assignCategory__impl>) => assignCategory__impl(...args),
);
export const recalcRules = withAdmin(
  (_user, ...args: Parameters<typeof recalcRules__impl>) => recalcRules__impl(...args),
);
export const setTxNote = withAdmin(
  (_user, ...args: Parameters<typeof setTxNote__impl>) => setTxNote__impl(...args),
);
export const txDetail = withAdmin(
  (_user, ...args: Parameters<typeof txDetail__impl>) => txDetail__impl(...args),
);
export const wipeFinanceData = withAdmin(async (user, ...args: Parameters<typeof wipeFinanceData__impl>) => {
  const result = await wipeFinanceData__impl(...args);
  await writeAudit(db, { userId: user.userId, actor: user.email }, "finance.wiped", "");
  return result;
});
export const createCategory = withAdmin(
  (_user, ...args: Parameters<typeof createCategory__impl>) => createCategory__impl(...args),
);
export const patchCategory = withAdmin(
  (_user, ...args: Parameters<typeof patchCategory__impl>) => patchCategory__impl(...args),
);
export const categoryUsage = withAdmin(
  (_user, ...args: Parameters<typeof categoryUsage__impl>) => categoryUsage__impl(...args),
);
export const removeCategory = withAdmin(
  (_user, ...args: Parameters<typeof removeCategory__impl>) => removeCategory__impl(...args),
);
export const createRule = withAdmin(
  (_user, ...args: Parameters<typeof createRule__impl>) => createRule__impl(...args),
);
export const patchRule = withAdmin(
  (_user, ...args: Parameters<typeof patchRule__impl>) => patchRule__impl(...args),
);
export const removeRule = withAdmin(
  (_user, ...args: Parameters<typeof removeRule__impl>) => removeRule__impl(...args),
);
export const testRule = withAdmin(
  (_user, ...args: Parameters<typeof testRule__impl>) => testRule__impl(...args),
);
