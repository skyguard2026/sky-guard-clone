/** Čtení dat pro server komponenty. Dataset je malý, načítá se celý najednou. */
import { asc, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "./db";
import {
  bankImports,
  bankTransactions,
  catalogItems,
  categoryRules,
  clients,
  expenseCategories,
  inquiries,
  locations,
  offers,
  settings,
} from "./db/schema";
import { DEFAULT_SETTINGS } from "./defaults";
import type {
  BankImport,
  BankTx,
  CategoryRule,
  ExpenseCategory,
} from "./bank/types";
import type { Offer } from "./offer-types";
import type { Inquiry } from "./inquiries";
import type {
  CatalogItem,
  ClientWithLocations,
  Location,
  LocationWithClient,
  Settings,
} from "./types";

export interface Portfolio {
  catalog: CatalogItem[];
  clients: ClientWithLocations[];
  /** Všechny lokality napříč klienty, ve stejném pořadí jako v přehledu. */
  locations: LocationWithClient[];
  settings: Settings;
}

/** Nabídky jedné lokality, nejnovější první. */
export const getOffersForLocation = cache(
  async (locationId: string): Promise<Offer[]> => {
    const rows = await db
      .select()
      .from(offers)
      .where(eq(offers.locationId, locationId))
      .orderBy(desc(offers.createdAt), desc(offers.version));
    return rows.map((r) => ({
      id: r.id,
      locationId: r.locationId,
      number: r.number,
      version: r.version,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      validUntil: r.validUntil.toISOString(),
      monthlyPrice: r.monthlyPrice,
      setupFee: r.setupFee,
      commitmentMonths: r.commitmentMonths,
      scope: r.scope,
      note: r.note,
      snapshot: r.snapshot,
    }));
  },
);

export const getPortfolio = cache(async (): Promise<Portfolio> => {
  const [catRows, clientRows, locRows, setRows] = await Promise.all([
    db.select().from(catalogItems).orderBy(asc(catalogItems.sort)),
    db.select().from(clients).orderBy(asc(clients.createdAt), asc(clients.id)),
    db
      .select()
      .from(locations)
      .orderBy(asc(locations.sort), asc(locations.createdAt), asc(locations.id)),
    db.select().from(settings).limit(1),
  ]);

  const catalog: CatalogItem[] = catRows.map((r) => ({
    id: r.id,
    label: r.label,
    group: r.group,
    cat: r.cat,
    price: r.price,
    life: r.life,
    billing: r.billing,
    driver: r.driver,
    shared: r.shared,
    prepay: r.prepay,
    enabled: r.enabled,
    note: r.note,
    sort: r.sort,
  }));

  const toLocation = (r: (typeof locRows)[number]): Location => ({
    id: r.id,
    clientId: r.clientId,
    name: r.name,
    note: r.note,
    product: r.product,
    price: r.price,
    cameras: r.cameras,
    camerasTlBig: r.camerasTlBig,
    camerasTlSmall: r.camerasTlSmall,
    poles: r.poles,
    docks: r.docks,
    km: r.km,
    hours: r.hours,
    trips1: r.trips1,
    trips2: r.trips2,
    setupFee: r.setupFee,
    commitmentMonths: r.commitmentMonths,
    off: r.off ?? {},
    over: r.over ?? {},
    qty: r.qty ?? {},
    sort: r.sort,
  });

  const clientList: ClientWithLocations[] = clientRows.map((c) => ({
    id: c.id,
    name: c.name,
    contact: c.contact,
    note: c.note,
    createdAt: c.createdAt,
    locations: locRows.filter((l) => l.clientId === c.id).map(toLocation),
  }));

  const all: LocationWithClient[] = clientList.flatMap((c) =>
    c.locations.map((l) => ({ ...l, clientName: c.name })),
  );

  const s = setRows[0];
  const settingsValue: Settings = s
    ? {
        share: s.share,
        prepay: s.prepay,
        renew: s.renew,
        tax: s.tax,
        horizon: s.horizon,
        inflation: s.inflation,
        residualRate: s.residualRate,
        transferDelay: s.transferDelay,
      }
    : { ...DEFAULT_SETTINGS };

  return {
    catalog,
    clients: clientList,
    locations: all,
    settings: settingsValue,
  };
});


/* ------------------------------------------------------------------ */
/* Finance                                                             */
/* ------------------------------------------------------------------ */

export interface FinanceMeta {
  categories: ExpenseCategory[];
  rules: CategoryRule[];
  imports: BankImport[];
}

export const getFinanceMeta = cache(async (): Promise<FinanceMeta> => {
  const [cats, rules, imps] = await Promise.all([
    db.select().from(expenseCategories).orderBy(asc(expenseCategories.sort)),
    db.select().from(categoryRules).orderBy(asc(categoryRules.priority)),
    db.select().from(bankImports).orderBy(desc(bankImports.importedAt)),
  ]);

  return {
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      color: c.color,
      note: c.note,
      sort: c.sort,
    })),
    rules: rules.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      field: r.field,
      op: r.op,
      value: r.value,
      priority: r.priority,
      enabled: r.enabled,
    })),
    imports: imps.map((i) => ({
      id: i.id,
      filename: i.filename,
      importedAt: i.importedAt.toISOString(),
      account: i.account,
      rowCount: i.rowCount,
      newCount: i.newCount,
      dupeCount: i.dupeCount,
      problemCount: i.problemCount,
      periodFrom: i.periodFrom,
      periodTo: i.periodTo,
      note: i.note,
    })),
  };
});

/** Transakce pro seznam a analytiku. Sloupec raw se schválně nenačítá —
 * je to celý původní řádek výpisu a u tisíců transakcí by to byl zbytečně
 * velký přenos. Do detailu se dotáhne zvlášť. */
export type TxListRow = Omit<BankTx, "raw">;

export const getTransactions = cache(async (): Promise<TxListRow[]> => {
  const rows = await db
    .select({
      id: bankTransactions.id,
      importId: bankTransactions.importId,
      bookedAt: bankTransactions.bookedAt,
      valueDate: bankTransactions.valueDate,
      account: bankTransactions.account,
      amount: bankTransactions.amount,
      currency: bankTransactions.currency,
      counterAccount: bankTransactions.counterAccount,
      counterName: bankTransactions.counterName,
      vs: bankTransactions.vs,
      ks: bankTransactions.ks,
      ss: bankTransactions.ss,
      message: bankTransactions.message,
      note: bankTransactions.note,
      txType: bankTransactions.txType,
      fee: bankTransactions.fee,
      externalId: bankTransactions.externalId,
      dedupeKey: bankTransactions.dedupeKey,
      categoryId: bankTransactions.categoryId,
      categorySource: bankTransactions.categorySource,
    })
    .from(bankTransactions)
    .orderBy(desc(bankTransactions.bookedAt), asc(bankTransactions.id));
  return rows;
});

/** Poptávky z webu, nejnovější první. */
export const getInquiries = cache(async (): Promise<Inquiry[]> => {
  const rows = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt));
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    name: r.name,
    company: r.company,
    email: r.email,
    phone: r.phone,
    objectType: r.objectType,
    interest: r.interest,
    message: r.message,
    status: r.status,
    note: r.note,
  }));
});

/** Počet nevyřízených poptávek pro odznak v navigaci. */
export const countNewInquiries = cache(async (): Promise<number> => {
  const rows = await db
    .select({ id: inquiries.id })
    .from(inquiries)
    .where(eq(inquiries.status, "new"));
  return rows.length;
});
