/**
 * Výchozí kategorie a startovní pravidla.
 *
 * Kategorie jsou účetní, ne modelové — bankovní výpis obsahuje spoustu věcí,
 * které v kalkulačce nejsou (daně, odvody, bankovní poplatky), a naopak.
 * Kdyby se použily kategorie katalogu, půlka výpisu by neměla kam spadnout.
 *
 * Barvy jsou natvrdo v hex, ne přes proměnné motivu. Kategorií je víc než
 * akcentů v paletě a graf potřebuje barvy, které jdou od sebe rozeznat
 * na tmavém i světlém podkladu.
 */
import type { CategoryRule, ExpenseCategory } from "./types";

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: "fc_hw", name: "Hardware", kind: "expense", color: "#3b8fff", note: "Drony, kamery, stanice, díly", sort: 10 },
  { id: "fc_sw", name: "Software a licence", kind: "expense", color: "#8b7cf6", note: "Předplatná, licence, cloud", sort: 20 },
  { id: "fc_net", name: "Konektivita a SIM", kind: "expense", color: "#2fb8c6", note: "Datové tarify, modemy, SIM", sort: 30 },
  { id: "fc_doprava", name: "Doprava a PHM", kind: "expense", color: "#f5b544", note: "Pohonné hmoty, servis, dálniční známky", sort: 40 },
  { id: "fc_mzdy", name: "Mzdy a odvody", kind: "expense", color: "#3ddc97", note: "Mzdy, sociální a zdravotní pojištění", sort: 50 },
  { id: "fc_najem", name: "Nájem a energie", kind: "expense", color: "#ff8ba7", note: "Kancelář, sklad, elektřina", sort: 60 },
  { id: "fc_dane", name: "Daně a odvody státu", kind: "expense", color: "#ff6b6b", note: "DPH, daň z příjmu, silniční daň", sort: 70 },
  { id: "fc_banka", name: "Bankovní poplatky", kind: "expense", color: "#9aa7bd", note: "Vedení účtu, platby, karty", sort: 80 },
  { id: "fc_marketing", name: "Marketing", kind: "expense", color: "#e061c8", note: "Reklama, web, tisk", sort: 90 },
  { id: "fc_kancelar", name: "Kancelář a drobný nákup", kind: "expense", color: "#7fa650", note: "Spotřební materiál, vybavení", sort: 100 },
  { id: "fc_sluzby", name: "Odborné služby", kind: "expense", color: "#d98b4a", note: "Účetní, právník, revize, pojištění", sort: 110 },
  { id: "fc_ostatni", name: "Ostatní", kind: "expense", color: "#6b7a91", note: "Co se nikam nehodí", sort: 120 },
  { id: "fc_trzby", name: "Tržby od klientů", kind: "income", color: "#3ddc97", note: "Úhrady faktur za službu", sort: 200 },
  { id: "fc_prijem_ost", name: "Ostatní příjmy", kind: "income", color: "#2fb8c6", note: "Dotace, vratky, úroky", sort: 210 },
  { id: "fc_prevod", name: "Převod mezi účty", kind: "transfer", color: "#6b7a91", note: "Přesun vlastních peněz. Do výdajů ani příjmů nevstupuje.", sort: 300 },
  { id: "fc_ignor", name: "Ignorovat", kind: "ignore", color: "#4a5668", note: "Řádky, které do analytiky nepatří vůbec.", sort: 310 },
];

/**
 * Startovní pravidla. Jen věci, které jsou v českém bankovnictví jednoznačné —
 * úřad, pojišťovna, správa sociálního zabezpečení. Dodavatelé se doplní sami
 * při procházení prvního výpisu, protože ty zná jen ten, kdo je platil.
 *
 * Pravidla se seedují jako obyčejná data. Jdou smazat i přepsat a další seed
 * je nevrátí, stejně jako u katalogu.
 */
export const DEFAULT_RULES: CategoryRule[] = [
  { id: "fr_fu", categoryId: "fc_dane", field: "counterName", op: "contains", value: "financni urad", priority: 10, enabled: true },
  { id: "fr_cssz", categoryId: "fc_mzdy", field: "counterName", op: "contains", value: "socialniho zabezpeceni", priority: 20, enabled: true },
  { id: "fr_cssz2", categoryId: "fc_mzdy", field: "counterName", op: "contains", value: "cssz", priority: 30, enabled: true },
  { id: "fr_zp", categoryId: "fc_mzdy", field: "counterName", op: "contains", value: "zdravotni pojistovna", priority: 40, enabled: true },
  { id: "fr_vzp", categoryId: "fc_mzdy", field: "counterName", op: "contains", value: "vseobecna zdravotni", priority: 50, enabled: true },
  { id: "fr_poplatek", categoryId: "fc_banka", field: "txType", op: "contains", value: "poplatek", priority: 60, enabled: true },
  { id: "fr_pojisteni", categoryId: "fc_sluzby", field: "counterName", op: "contains", value: "pojistovna", priority: 70, enabled: true },
];
