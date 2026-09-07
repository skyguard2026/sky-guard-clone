/**
 * Záloha a obnova celé databáze.
 *
 * Import přepisuje všechno, takže logika sedí tady, oddělená od server action,
 * a je otestovaná proti skutečné databázi (tests/backup.test.ts).
 */
import {
  bankImports,
  bankTransactions,
  catalogItems,
  categoryRules,
  clients,
  expenseCategories,
  locations,
  settings,
} from "./schema";
import type { AnyPgDatabase } from "./seed-core";
import { DEFAULT_SETTINGS } from "../defaults";
import { uid } from "../id";

export interface BackupPayload {
  version: number;
  exportedAt: string;
  catalog: unknown[];
  clients: unknown[];
  settings: unknown;
  /**
   * Finanční sekce. Ve verzi 1 chyběla — obnova takové zálohy proto bankovní
   * data nechává být, viz importBackup.
   */
  finance?: {
    categories: unknown[];
    rules: unknown[];
    imports: unknown[];
    transactions: unknown[];
  };
}

/**
 * Kompletní záloha. Obsahuje nákupní ceny hardwaru **i pohyby na bankovním
 * účtu** — je to interní soubor pro jednatele, nikdy ne podklad, který jde
 * klientovi.
 */
export async function exportBackup(
  db: AnyPgDatabase,
  now: string,
): Promise<BackupPayload> {
  const [cat, cls, locs, set, fcats, frules, fimports, ftx] =
    await Promise.all([
      db.select().from(catalogItems),
      db.select().from(clients),
      db.select().from(locations),
      db.select().from(settings).limit(1),
      db.select().from(expenseCategories),
      db.select().from(categoryRules),
      db.select().from(bankImports),
      db.select().from(bankTransactions),
    ]);
  return {
    version: 2,
    exportedAt: now,
    catalog: cat,
    clients: cls.map((c) => ({
      ...c,
      locations: locs.filter((l) => l.clientId === c.id),
    })),
    finance: {
      categories: fcats,
      rules: frules,
      imports: fimports,
      transactions: ftx,
    },
    settings: set[0]
      ? {
          share: set[0].share,
          prepay: set[0].prepay,
          renew: set[0].renew,
          tax: set[0].tax,
          horizon: set[0].horizon,
          inflation: set[0].inflation,
          residualRate: set[0].residualRate,
          transferDelay: set[0].transferDelay,
        }
      : DEFAULT_SETTINGS,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const n = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const s = (v: any, d = "") => (typeof v === "string" ? v : d);
const mapOf = (v: any): Record<string, any> =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};

/**
 * Datum založení ze zálohy. Podle něj se řadí klienti i lokality, takže by ho
 * import neměl přepsat na „teď" — jinak se po obnově přeháže pořadí.
 */
const createdAt = (v: any): Date | undefined => {
  if (v == null) return undefined;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const GROUPS = ["cam", "drone", "shared"];
const CATS = ["hw", "sw", "net", "ops", "lab"];
const BILLINGS = ["oneoff", "monthly", "yearly"];
const DRIVERS = [
  "site",
  "camera",
  "cameraAll",
  "tlBig",
  "tlSmall",
  "pole",
  "dock",
  "km",
  "hour",
  "trip",
  "tripKm",
  "pctHw",
  "qty",
];
const PRODUCTS = ["cam", "drone", "both"];

const KINDS = ["expense", "income", "transfer", "ignore"];
const RULE_FIELDS = [
  "counterName",
  "counterAccount",
  "vs",
  "message",
  "note",
  "txType",
  "any",
];
const RULE_OPS = ["contains", "equals", "startsWith"];
const SOURCES = ["rule", "manual"];

/** ISO datum ze zálohy. Cokoli jiného se zahodí — text v bookedAt by rozbil
 * řazení i měsíční řady, které se na tvar YYYY-MM-DD spoléhají. */
const isoDate = (v: any): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;

export type ImportResult =
  | {
      ok: true;
      catalog: number;
      clients: number;
      locations: number;
      /** null = záloha finanční sekci neobsahovala a data zůstala nedotčená. */
      finance: {
        categories: number;
        rules: number;
        imports: number;
        transactions: number;
      } | null;
    }
  | { ok: false; error: string };

/**
 * Načtení zálohy. Přepíše všechno, proto je to v Nastavení s potvrzením.
 * Data ze souboru se berou jako neznámá — všechno se validuje a dopočítává,
 * aby stará nebo ručně upravená záloha nerozbila databázi.
 */
export async function importBackup(
  db: AnyPgDatabase,
  json: string,
): Promise<ImportResult> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "Soubor není platný JSON." };
  }
  if (!data || !Array.isArray(data.catalog) || !Array.isArray(data.clients)) {
    return { ok: false, error: "Soubor nevypadá jako záloha této aplikace." };
  }

  const cat = data.catalog
    .filter((i: any) => i && typeof i.id === "string" && i.id && i.label)
    .map((i: any, idx: number) => ({
      id: i.id,
      label: s(i.label, "Bez názvu"),
      group: GROUPS.includes(i.group) ? i.group : "shared",
      cat: CATS.includes(i.cat) ? i.cat : "hw",
      price: n(i.price),
      life: i.life == null ? null : Math.max(1, Math.round(n(i.life, 1))),
      billing: BILLINGS.includes(i.billing) ? i.billing : "monthly",
      driver: DRIVERS.includes(i.driver) ? i.driver : "site",
      shared: !!i.shared,
      prepay: i.prepay !== false,
      enabled: i.enabled !== false,
      note: s(i.note),
      sort: Number.isFinite(Number(i.sort)) ? Number(i.sort) : idx * 10,
    }));

  const fin =
    data.finance && typeof data.finance === "object" ? data.finance : null;

  const fCats = (Array.isArray(fin?.categories) ? fin.categories : [])
    .filter((c: any) => c && typeof c.id === "string" && c.id && c.name)
    .map((c: any, idx: number) => ({
      id: c.id,
      name: s(c.name, "Bez názvu"),
      kind: KINDS.includes(c.kind) ? c.kind : "expense",
      color: s(c.color, "var(--muted)"),
      note: s(c.note),
      sort: Number.isFinite(Number(c.sort)) ? Number(c.sort) : idx * 10,
    }));
  const catIds = new Set(fCats.map((c: any) => c.id));

  // Pravidlo ani transakce nesmí odkazovat na kategorii, která v záloze není —
  // cizí klíč by celou obnovu shodil na jednom osiřelém řádku.
  const fRules = (Array.isArray(fin?.rules) ? fin.rules : [])
    .filter(
      (r: any) => r && typeof r.id === "string" && r.id && catIds.has(r.categoryId),
    )
    .map((r: any) => ({
      id: r.id,
      categoryId: r.categoryId,
      field: RULE_FIELDS.includes(r.field) ? r.field : "counterName",
      op: RULE_OPS.includes(r.op) ? r.op : "contains",
      value: s(r.value),
      priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : 100,
      enabled: r.enabled !== false,
    }));

  const fImports = (Array.isArray(fin?.imports) ? fin.imports : [])
    .filter((i: any) => i && typeof i.id === "string" && i.id)
    .map((i: any) => ({
      id: i.id,
      filename: s(i.filename, "bez názvu"),
      ...(createdAt(i.importedAt) ? { importedAt: createdAt(i.importedAt) } : {}),
      account: s(i.account),
      rowCount: Math.max(0, Math.round(n(i.rowCount))),
      newCount: Math.max(0, Math.round(n(i.newCount))),
      dupeCount: Math.max(0, Math.round(n(i.dupeCount))),
      problemCount: Math.max(0, Math.round(n(i.problemCount))),
      periodFrom: isoDate(i.periodFrom),
      periodTo: isoDate(i.periodTo),
      note: s(i.note),
    }));
  const importIds = new Set(fImports.map((i: any) => i.id));

  const seenKeys = new Set<string>();
  const fTx = (Array.isArray(fin?.transactions) ? fin.transactions : [])
    .filter(
      (t: any) =>
        t &&
        typeof t.id === "string" &&
        t.id &&
        importIds.has(t.importId) &&
        isoDate(t.bookedAt) &&
        typeof t.dedupeKey === "string" &&
        t.dedupeKey,
    )
    .filter((t: any) => {
      // Ručně upravená záloha může obsahovat duplicitu, kterou by unikátní
      // index odmítl a shodil s ní obnovu celé databáze.
      const key = `${s(t.account)}|${t.dedupeKey}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .map((t: any) => ({
      id: t.id,
      importId: t.importId,
      bookedAt: isoDate(t.bookedAt)!,
      valueDate: isoDate(t.valueDate),
      account: s(t.account),
      amount: n(t.amount),
      currency: s(t.currency, "CZK"),
      counterAccount: s(t.counterAccount),
      counterName: s(t.counterName),
      vs: s(t.vs),
      ks: s(t.ks),
      ss: s(t.ss),
      message: s(t.message),
      note: s(t.note),
      txType: s(t.txType),
      fee: n(t.fee),
      externalId: typeof t.externalId === "string" ? t.externalId : null,
      dedupeKey: t.dedupeKey,
      categoryId: catIds.has(t.categoryId) ? t.categoryId : null,
      categorySource:
        catIds.has(t.categoryId) && SOURCES.includes(t.categorySource)
          ? t.categorySource
          : null,
      raw: mapOf(t.raw),
    }));

  let clientCount = 0;
  let locationCount = 0;

  await db.transaction(async (tx) => {
    await tx.delete(locations);
    await tx.delete(clients);
    await tx.delete(catalogItems);
    if (cat.length) await tx.insert(catalogItems).values(cat);

    for (const c of data.clients) {
      if (!c || !c.name) continue;
      const cid = typeof c.id === "string" && c.id ? c.id : uid();
      const cCreated = createdAt(c.createdAt);
      await tx.insert(clients).values({
        id: cid,
        name: s(c.name, "Bez názvu"),
        contact: s(c.contact),
        note: s(c.note),
        ...(cCreated ? { createdAt: cCreated } : {}),
      });
      clientCount++;

      const locs = Array.isArray(c.locations) ? c.locations : [];
      for (const [idx, l] of locs.entries()) {
        if (!l || !l.name) continue;
        const lCreated = createdAt(l.createdAt);
        await tx.insert(locations).values({
          id: typeof l.id === "string" && l.id ? l.id : uid(),
          clientId: cid,
          name: s(l.name, "Bez názvu"),
          note: s(l.note),
          product: PRODUCTS.includes(l.product) ? l.product : "drone",
          price: n(l.price),
          cameras: Math.max(0, Math.round(n(l.cameras))),
          camerasTlBig: Math.max(0, Math.round(n(l.camerasTlBig))),
          camerasTlSmall: Math.max(0, Math.round(n(l.camerasTlSmall))),
          poles: Math.max(0, Math.round(n(l.poles))),
          docks: Math.max(0, Math.round(n(l.docks))),
          km: Math.max(0, n(l.km)),
          hours: Math.max(0, n(l.hours)),
          trips1: Math.max(0, Math.round(n(l.trips1))),
          trips2: Math.max(0, Math.round(n(l.trips2))),
          setupFee: Math.max(0, n(l.setupFee)),
          commitmentMonths: Math.max(0, Math.round(n(l.commitmentMonths, 24))),
          off: mapOf(l.off),
          over: mapOf(l.over),
          qty: mapOf(l.qty),
          sort: Number.isFinite(Number(l.sort)) ? Number(l.sort) : idx * 10,
          ...(lCreated ? { createdAt: lCreated } : {}),
        });
        locationCount++;
      }
    }

    /**
     * Finanční sekce se obnovuje jen tehdy, když v záloze je.
     *
     * Záloha verze 1 ji neobsahuje a tichý výmaz bankovních dat při obnově
     * starší zálohy katalogu je přesně ten druh ztráty, který si nikdo
     * nevšimne včas. Neobsahuje-li ji, zůstane všechno, jak bylo.
     */
    if (fin) {
      await tx.delete(bankTransactions);
      await tx.delete(bankImports);
      await tx.delete(categoryRules);
      await tx.delete(expenseCategories);

      if (fCats.length) await tx.insert(expenseCategories).values(fCats);
      if (fRules.length) await tx.insert(categoryRules).values(fRules);
      if (fImports.length) await tx.insert(bankImports).values(fImports);
      for (let i = 0; i < fTx.length; i += 500) {
        await tx.insert(bankTransactions).values(fTx.slice(i, i + 500));
      }
    }

    const st = data.settings ?? {};
    await tx.delete(settings);
    await tx.insert(settings).values({
      id: 1,
      share: st.share !== false,
      prepay: st.prepay !== false,
      renew: st.renew !== false,
      tax: n(st.tax, 21),
      horizon: Math.min(120, Math.max(12, Math.round(n(st.horizon, 36)))),
      inflation: Math.min(50, Math.max(0, n(st.inflation, 0))),
      residualRate: Math.min(100, Math.max(0, n(st.residualRate, 40))),
      transferDelay: Math.min(60, Math.max(0, Math.round(n(st.transferDelay, 6)))),
    });
  });

  return {
    ok: true,
    catalog: cat.length,
    clients: clientCount,
    locations: locationCount,
    finance: fin
      ? {
          categories: fCats.length,
          rules: fRules.length,
          imports: fImports.length,
          transactions: fTx.length,
        }
      : null,
  };
}
