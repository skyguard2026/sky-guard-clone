/**
 * Databázové schéma — SPEC.md §2.
 *
 * Peněžní hodnoty jsou `doublePrecision`, ne `numeric`. Kontrolní hodnoty ve
 * specifikaci vznikly v JavaScriptu v double a sazby jako 10,33 Kč/km se přes
 * numeric vracejí jako string, který by se musel parsovat — a právě tam by
 * vznikla odchylka, kvůli které by výsledky proti databázi nesouhlasily
 * s jádrem, i když je jádro správně.
 */
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { OfferSnapshot } from "../offer-types";

export const groupEnum = pgEnum("cost_group", ["cam", "drone", "shared"]);
export const catEnum = pgEnum("cost_cat", ["hw", "sw", "net", "ops", "lab"]);
export const billingEnum = pgEnum("billing", ["oneoff", "monthly", "yearly"]);
export const driverEnum = pgEnum("driver", [
  "site",
  "camera",
  // Součet všech kamer — bezpečnostních i časosběrných.
  "cameraAll",
  "tlBig",
  "tlSmall",
  "pole",
  "dock",
  "km",
  "hour",
  "trip",
  // kilometry na výjezdech — zrcadlí driver trip, jen násobí vzdáleností
  "tripKm",
  "pctHw",
  "qty",
]);
export const productEnum = pgEnum("product", ["cam", "drone", "both"]);
export const offerStatusEnum = pgEnum("offer_status", [
  "draft",
  "odeslana",
  "prijata",
  "odmitnuta",
]);

export const catalogItems = pgTable("catalog_item", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  group: groupEnum("group").notNull(),
  cat: catEnum("cat").notNull(),
  /** Kč, u driveru pctHw procenta. Může být záporná. */
  price: doublePrecision("price").notNull().default(0),
  /** Životnost v měsících, null = neamortizuje se. */
  life: integer("life"),
  billing: billingEnum("billing").notNull(),
  driver: driverEnum("driver").notNull(),
  shared: boolean("shared").notNull().default(false),
  prepay: boolean("prepay").notNull().default(true),
  enabled: boolean("enabled").notNull().default(true),
  note: text("note").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

export const clients = pgTable("client", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const locations = pgTable("location", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  note: text("note").notNull().default(""),
  product: productEnum("product").notNull().default("drone"),
  /** Měsíční cena klientovi v Kč. */
  price: doublePrecision("price").notNull().default(0),
  /** Bezpečnostní kamery. */
  cameras: integer("cameras").notNull().default(0),
  /** Časosběrné kamery velké. */
  camerasTlBig: integer("cameras_tl_big").notNull().default(0),
  /** Časosběrné kamery malé. */
  camerasTlSmall: integer("cameras_tl_small").notNull().default(0),
  poles: integer("poles").notNull().default(0),
  docks: integer("docks").notNull().default(0),
  km: doublePrecision("km").notNull().default(0),
  hours: doublePrecision("hours").notNull().default(0),
  trips1: integer("trips1").notNull().default(0),
  trips2: integer("trips2").notNull().default(0),
  /** Jednorázový poplatek za zřízení. Příjem od klienta, ne náklad. */
  setupFee: doublePrecision("setup_fee").notNull().default(0),
  /** Minimální doba závazku v měsících. Do výpočtu nevstupuje. */
  commitmentMonths: integer("commitment_months").notNull().default(24),
  /** { itemId: true } — položka se na této lokalitě nezapočítává. */
  off: jsonb("off").notNull().default({}).$type<Record<string, boolean>>(),
  /** { itemId: number } — přepsaná cena položky. */
  over: jsonb("over").notNull().default({}).$type<Record<string, number>>(),
  /** { itemId: number } — množství pro driver qty. */
  qty: jsonb("qty").notNull().default({}).$type<Record<string, number>>(),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Cenová nabídka pro klienta. Neměnný snímek — po vytvoření se mění jen stav.
 * Když se pak změní katalog nebo konfigurace lokality, stará nabídka zůstane
 * přesně taková, jaká odešla klientovi.
 */
export const offers = pgTable(
  "offer",
  {
    id: text("id").primaryKey(),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    /** Pořadové číslo v rámci roku, např. 2026-001. */
    number: text("number").notNull(),
    /** Nová verze téže nabídky = nový řádek se stejným číslem. */
    version: integer("version").notNull().default(1),
    status: offerStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    monthlyPrice: doublePrecision("monthly_price").notNull().default(0),
    setupFee: doublePrecision("setup_fee").notNull().default(0),
    commitmentMonths: integer("commitment_months").notNull().default(24),
    /** Rozsah služby, jak ho uvidí klient. */
    scope: text("scope").notNull().default(""),
    note: text("note").notNull().default(""),
    /**
     * Snímek konfigurace, katalogu, nastavení a spočítaného výsledku
     * v okamžiku vzniku. Interní — obsahuje nákupní ceny, do PDF nesmí.
     */
    snapshot: jsonb("snapshot").notNull().$type<OfferSnapshot>(),
  },
  (t) => [
    // Souběžný zápis nesmí přidělit stejné číslo dvakrát — transakce sama
    // o sobě nestačí, protože dvě čtení maxima mohou proběhnout naráz.
    uniqueIndex("offer_number_version_idx").on(t.number, t.version),
  ],
);

/** Jeden řádek, vždy id = 1. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  share: boolean("share").notNull().default(true),
  prepay: boolean("prepay").notNull().default(true),
  renew: boolean("renew").notNull().default(true),
  tax: doublePrecision("tax").notNull().default(21),
  horizon: integer("horizon").notNull().default(36),
  /** Roční inflace ročních položek v %. */
  inflation: doublePrecision("inflation").notNull().default(0),
  /** Realizovatelnost zbytkové hodnoty hardwaru v %. */
  residualRate: doublePrecision("residual_rate").notNull().default(40),
  /** Prodleva přenosu hardwaru v měsících. */
  transferDelay: integer("transfer_delay").notNull().default(6),
});

/* ------------------------------------------------------------------ */
/* Přístup — uživatelé, session, audit                                 */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("user_role", ["admin", "member"]);

/**
 * Uživatel aplikace.
 *
 * E-mail se ukládá **vždy malými písmeny** a unikátní index je nad ním přímo.
 * Kdyby se ukládal, jak ho někdo napsal, vznikly by dva účty lišící se jen
 * velikostí písmen a jeden by druhému tiše odebral přihlášení.
 */
export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    /** argon2id. Nikdy se nikam nevypisuje, ani do zálohy pro jednatele. */
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("member"),
    active: boolean("active").notNull().default(true),
    /** Dočasné heslo od admina — dokud se nezmění, uživatel nikam nesmí. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("user_email_idx").on(t.email)],
);

/**
 * Session v databázi, ne jen podepsaná cookie.
 *
 * Podepsaná cookie se nedá vzít zpět — jakmile je venku, platí až do vypršení
 * a tlačítko „ukončit session" by bylo kosmetika. Řádek v databázi se smaže
 * a další požadavek už neprojde.
 */
export const sessions = pgTable("session", {
  /** Neprůhledné náhodné id. Je to zároveň obsah cookie. */
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  userAgent: text("user_agent").notNull().default(""),
});

/**
 * Záznam o tom, kdo co udělal. **Append-only** — v aplikaci neexistuje cesta,
 * která by z něj mazala, a je to tak schválně: log, který jde uklidit, nemá
 * cenu vést.
 */
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  /**
   * Kdo akci provedl. Schválně **bez cizího klíče** na user.
   *
   * S klíčem by smazání uživatele buď zápis odmítlo, nebo — s onDelete set
   * null — přepsalo historické řádky. Obojí je proti smyslu logu, do kterého
   * se jen připisuje. Odkaz je proto volný a jméno se vedle toho ukládá
   * natvrdo do actor, ať je záznam čitelný i po smazání účtu.
   */
  userId: text("user_id"),
  /** Jméno a e-mail v době činu. Přežije i smazání uživatele. */
  actor: text("actor").notNull().default(""),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  detail: jsonb("detail").notNull().default({}).$type<Record<string, unknown>>(),
});

/** Pokusy o přihlášení. Podklad pro zamykání i pro audit. */
export const loginAttempts = pgTable("login_attempt", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ip: text("ip").notNull().default(""),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  success: boolean("success").notNull(),
});

/**
 * Stav aplikace, jeden řádek. Zatím jen příznak, že bootstrap admina proběhl.
 *
 * Kontrolovat místo toho prázdnou tabulku uživatelů by nestačilo: po smazání
 * posledního admina by bootstrap ožil a z proměnných prostředí by vznikl nový
 * účet. Příznak se nastaví při prvním úspěšném přihlášení, takže cesta zpět
 * existuje jen do té chvíle.
 */
export const appState = pgTable("app_state", {
  id: integer("id").primaryKey().default(1),
  bootstrapUsedAt: timestamp("bootstrap_used_at", { withTimezone: true }),
});

/* ------------------------------------------------------------------ */
/* Finance — bankovní výpisy a analytika výdajů                        */
/* ------------------------------------------------------------------ */

export const categoryKindEnum = pgEnum("category_kind", [
  "expense",
  "income",
  // Převod mezi vlastními účty. Do výdajů ani příjmů nevstupuje.
  "transfer",
  "ignore",
]);

export const ruleFieldEnum = pgEnum("rule_field", [
  "counterName",
  "counterAccount",
  "vs",
  "message",
  "note",
  "txType",
  "any",
]);

export const ruleOpEnum = pgEnum("rule_op", [
  "contains",
  "equals",
  "startsWith",
]);

/** Kdo transakci zařadil. Ruční zařazení přepočet pravidel nepřepisuje. */
export const categorySourceEnum = pgEnum("category_source", ["rule", "manual"]);

export const expenseCategories = pgTable("expense_category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: categoryKindEnum("kind").notNull().default("expense"),
  /** CSS barva pro graf a štítek. */
  color: text("color").notNull().default("var(--muted)"),
  note: text("note").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

export const categoryRules = pgTable("category_rule", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategories.id, { onDelete: "cascade" }),
  field: ruleFieldEnum("field").notNull().default("counterName"),
  op: ruleOpEnum("op").notNull().default("contains"),
  value: text("value").notNull().default(""),
  /** Nižší číslo vyhrává. Vyhodnocuje se první vyhovující, ne nejpřesnější. */
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
});

/** Jeden nahraný soubor. Podle něj jde import celý vrátit. */
export const bankImports = pgTable("bank_import", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  account: text("account").notNull().default(""),
  rowCount: integer("row_count").notNull().default(0),
  newCount: integer("new_count").notNull().default(0),
  dupeCount: integer("dupe_count").notNull().default(0),
  problemCount: integer("problem_count").notNull().default(0),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  note: text("note").notNull().default(""),
});

/**
 * Transakce z výpisu.
 *
 * Peníze jsou i tady double precision, ze stejného důvodu jako v katalogu:
 * numeric se z driveru vrací jako řetězec a u haléřů by parsování zaneslo
 * odchylku do součtů, které mají sedět na výpis do koruny.
 */
export const bankTransactions = pgTable(
  "bank_tx",
  {
    id: text("id").primaryKey(),
    importId: text("import_id")
      .notNull()
      .references(() => bankImports.id, { onDelete: "cascade" }),
    /** ISO YYYY-MM-DD. Text, ne date — výpis nemá čas ani pásmo a posun o den
     * přes půlnoc by přeházel transakce mezi měsíci. */
    bookedAt: text("booked_at").notNull(),
    valueDate: text("value_date"),
    account: text("account").notNull().default(""),
    /** Kladná = příjem, záporná = výdaj. Znaménko z výpisu se nepřevrací. */
    amount: doublePrecision("amount").notNull().default(0),
    currency: text("currency").notNull().default("CZK"),
    counterAccount: text("counter_account").notNull().default(""),
    counterName: text("counter_name").notNull().default(""),
    vs: text("vs").notNull().default(""),
    ks: text("ks").notNull().default(""),
    ss: text("ss").notNull().default(""),
    message: text("message").notNull().default(""),
    note: text("note").notNull().default(""),
    txType: text("tx_type").notNull().default(""),
    fee: doublePrecision("fee").notNull().default(0),
    externalId: text("external_id"),
    dedupeKey: text("dedupe_key").notNull(),
    categoryId: text("category_id").references(() => expenseCategories.id, {
      onDelete: "set null",
    }),
    categorySource: categorySourceEnum("category_source"),
    raw: jsonb("raw").notNull().default({}).$type<Record<string, string>>(),
  },
  (t) => [
    /**
     * Duplicitu hlídá databáze, ne aplikace. Kontrola v kódu by při dvou
     * současně nahraných překrývajících se výpisech propustila obojí —
     * obě čtení proběhnou dřív, než první zapíše.
     *
     * Klíč je na dvojici s účtem: id transakce je jedinečné v rámci účtu,
     * ne napříč bankou.
     */
    uniqueIndex("bank_tx_account_dedupe_idx").on(t.account, t.dedupeKey),
  ],
);

/* ------------------------------------------------------------------ */
/* Poptávky z veřejného webu                                            */
/* ------------------------------------------------------------------ */

export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "new",
  "contacted",
  "closed",
]);

/**
 * Poptávka z kontaktního formuláře na webu. Zapisuje ji veřejný endpoint
 * bez přihlášení, proto je každé pole ořezané na délku a hodnoty výběrů
 * se ukládají jako klíče formuláře (industrial, camera …), ne jako texty —
 * popisky se překládají až v Hubu.
 */
export const inquiries = pgTable("inquiry", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  objectType: text("object_type").notNull().default(""),
  interest: text("interest").notNull().default(""),
  message: text("message").notNull().default(""),
  status: inquiryStatusEnum("status").notNull().default("new"),
  /** Interní poznámka obchodníka, klient ji nevidí. */
  note: text("note").notNull().default(""),
  source: text("source").notNull().default("web"),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
});

export const schema = {
  users,
  sessions,
  auditLog,
  loginAttempts,
  appState,
  catalogItems,
  clients,
  locations,
  offers,
  settings,
  expenseCategories,
  categoryRules,
  bankImports,
  bankTransactions,
  inquiries,
};
export type Schema = typeof schema;

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type ClientRow = typeof clients.$inferSelect;
export type LocationRow = typeof locations.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;
export type ExpenseCategoryRow = typeof expenseCategories.$inferSelect;
export type CategoryRuleRow = typeof categoryRules.$inferSelect;
export type BankImportRow = typeof bankImports.$inferSelect;
export type BankTxRow = typeof bankTransactions.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
export type InquiryRow = typeof inquiries.$inferSelect;
