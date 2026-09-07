/**
 * Parser CSV výpisu z Raiffeisenbank.
 *
 * Řízený hlavičkou, ne pozicí sloupců. Banka může kdykoli přidat sloupec nebo
 * změnit jeho pořadí a export tím rozbít každý parser, který počítá čárky.
 * Tenhle hledá sloupce podle názvu přes tabulku aliasů, takže přežije i to,
 * a zároveň spolkne výpis z jiné banky, pokud používá stejná česká slova.
 *
 * Co parser neumí přečíst, **nezahodí**. Řádek se do výsledku nedostane a
 * skončí v `problems` i s číslem řádku a důvodem. Chybějící číslo ve výsledku
 * je horší než hlášená chyba — tiše sníženému součtu nikdo nepřijde na kloub.
 *
 * Čistá funkce nad řetězcem. Dekódování bajtů řeší lib/bank/decode.ts.
 */

/** Kanonická pole, na která se sloupce výpisu mapují. */
export type Field =
  | "bookedAt"
  | "valueDate"
  | "account"
  | "accountName"
  | "amount"
  | "currency"
  | "counterAccount"
  | "counterName"
  | "vs"
  | "ks"
  | "ss"
  | "message"
  | "note"
  | "txType"
  | "fee"
  | "externalId";

/**
 * Aliasy hlaviček. Porovnává se po normalizaci — bez diakritiky, malými
 * písmeny, bez interpunkce a přebytečných mezer. Pořadí uvnitř pole rozhoduje:
 * dřívější alias vyhrává, když by se hlavička hodila na víc polí.
 */
const ALIASES: Record<Field, string[]> = {
  bookedAt: [
    "datum zauctovani",
    "datum zauctovani transakce",
    "datum splatnosti",
    "datum",
    "datum transakce",
  ],
  valueDate: ["datum provedeni", "datum vytvoreni", "datum odepsani"],
  account: ["cislo uctu", "cislo vaseho uctu", "ucet", "vas ucet"],
  accountName: ["nazev uctu", "nazev vaseho uctu"],
  amount: [
    "zauctovana castka",
    "castka",
    "objem",
    "castka v mene uctu",
    "suma",
  ],
  currency: ["mena uctu", "mena"],
  counterAccount: [
    "cislo protiuctu",
    "protiucet",
    "cislo uctu protistrany",
    "ucet protistrany",
  ],
  counterName: [
    "nazev protiuctu",
    "nazev protistrany",
    "protistrana",
    "nazev prijemce",
    "prijemce",
    "odesilatel",
  ],
  vs: ["variabilni symbol", "vs"],
  ks: ["konstantni symbol", "ks"],
  ss: ["specificky symbol", "ss"],
  message: [
    "zprava pro prijemce",
    "zprava",
    "popis prijemce",
    "detail platby",
    "ucel platby",
  ],
  note: ["poznamka pro mne", "poznamka", "vlastni poznamka", "popis"],
  txType: ["typ transakce", "typ", "kategorie transakce", "druh transakce"],
  fee: ["poplatek", "poplatky"],
  externalId: [
    "id transakce",
    "identifikace transakce",
    "referencni cislo",
    "cislo transakce",
  ],
};

/** Bez těchhle dvou nemá import smysl — nevíme kdy a kolik. */
const REQUIRED: Field[] = ["bookedAt", "amount"];

export type ProblemKind =
  | "missing-column"
  | "bad-date"
  | "bad-amount"
  | "ragged-row"
  | "empty-file";

export interface ParseProblem {
  /** Číslo řádku v souboru, počítáno od 1. Hlavička je řádek 1. */
  line: number;
  kind: ProblemKind;
  detail: string;
}

export interface ParsedRow {
  bookedAt: string;
  valueDate: string | null;
  account: string;
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
  externalId: string | null;
  dedupeKey: string;
  raw: Record<string, string>;
  line: number;
}

export interface ParsedStatement {
  rows: ParsedRow[];
  problems: ParseProblem[];
  /** Co se na co namapovalo. Jde rovnou do náhledu před uložením. */
  mapping: Record<Field, string | null>;
  /** Hlavičky, které se nenamapovaly na žádné pole. Nejsou chyba. */
  unmapped: string[];
  delimiter: string;
  /** Ze kterého formátu výsledek pochází. */
  format: "csv" | "camt053";
  /** Účet výpisu, když ho soubor uvádí. */
  account: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  /** Import nesmí proběhnout, když je tohle false. */
  ok: boolean;
}

/* ------------------------------------------------------------------ */
/* Normalizace a rozdělení                                             */
/* ------------------------------------------------------------------ */

/** Malými písmeny, bez diakritiky, bez interpunkce, jedna mezera mezi slovy. */
export function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DELIMITERS = [";", "\t", ","] as const;

/**
 * Oddělovač se pozná podle hlavičky, ne podle celého souboru — ve zprávě pro
 * příjemce bývají čárky i středníky a ty by hlasování rozhodly špatně.
 */
export function detectDelimiter(headerLine: string): string {
  let best = ";";
  let bestCount = -1;
  for (const d of DELIMITERS) {
    const count = splitLine(headerLine, d).length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Rozdělí řádek podle oddělovače, respektuje uvozovky a zdvojené "" uvnitř. */
export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export interface Record_ {
  text: string;
  /** Fyzický řádek v souboru, na kterém záznam začíná. Počítáno od 1. */
  line: number;
}

/**
 * Rozdělí soubor na záznamy. Uvozovaná hodnota smí obsahovat konec řádku —
 * ve zprávě pro příjemce se to stává a naivní split by z jedné transakce
 * udělal dva rozbité řádky.
 *
 * Vedle textu se nese i fyzický řádek, na kterém záznam začíná. Jakmile je
 * v souboru jedna víceřádková zpráva, pořadí záznamu a číslo řádku se rozejdou
 * — a hlásit „chyba na řádku 12", když je v editoru na třináctce, je horší
 * než nehlásit nic.
 */
export function splitRecords(text: string): Record_[] {
  const out: Record_[] = [];
  let cur = "";
  let quoted = false;
  let startLine = 1;
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      quoted = !quoted;
      cur += ch;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      const crlf = ch === "\r" && text[i + 1] === "\n";
      if (quoted) {
        cur += crlf ? "\n" : ch;
        if (crlf) i++;
        line++;
        continue;
      }
      if (crlf) i++;
      out.push({ text: cur, line: startLine });
      cur = "";
      line++;
      startLine = line;
      continue;
    }
    cur += ch;
  }
  out.push({ text: cur, line: startLine });
  return out;
}

/* ------------------------------------------------------------------ */
/* Čísla a data                                                        */
/* ------------------------------------------------------------------ */

/** Všechny podoby mezery, které se v exportech objevují jako oddělovač tisíců. */
const SPACES = /[\s\u00a0\u202f\u2007\u2009]/g;

/**
 * České číslo z výpisu. Zvládne „1 234,56", „-1 234,56 CZK", „+1234.56".
 *
 * Když je v čísle jen tečka, rozhoduje počet číslic za ní: přesně tři znamenají
 * oddělovač tisíců („1.234" = 1234), cokoli jiného desetinnou tečku („1.5").
 * České exporty používají pro desetiny čárku, takže tečka se třemi číslicemi
 * je skoro jistě tisíce.
 */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).replace(SPACES, "");
  if (!s) return null;

  let negative = false;
  // Účetní zápis závorkami se ve výpisech objevuje u storna.
  if (/^\((.*)\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Měna nebo jiný text za číslem.
  s = s.replace(/[^0-9.,+-]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (s.includes("-") || s.includes("+")) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalAt = -1;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalAt = Math.max(lastComma, lastDot);
  } else if (lastComma >= 0) {
    decimalAt = lastComma;
  } else if (lastDot >= 0) {
    decimalAt = s.length - lastDot - 1 === 3 ? -1 : lastDot;
  }

  let intPart: string;
  let fracPart = "";
  if (decimalAt >= 0) {
    intPart = s.slice(0, decimalAt);
    fracPart = s.slice(decimalAt + 1);
    if (!/^\d*$/.test(fracPart)) return null;
  } else {
    intPart = s;
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d*$/.test(intPart)) return null;
  if (!intPart && !fracPart) return null;

  const value = Number(`${intPart || "0"}.${fracPart || "0"}`);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/;
const DMY_SHORT = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2})$/;

/** Datum z výpisu na ISO YYYY-MM-DD. Případný čas za datem se zahodí. */
export function parseDate(raw: string): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let y: number, m: number, d: number;
  const iso = ISO.exec(s);
  const dmy = DMY.exec(s);
  const short = DMY_SHORT.exec(s);
  if (iso) {
    y = +iso[1];
    m = +iso[2];
    d = +iso[3];
  } else if (dmy) {
    d = +dmy[1];
    m = +dmy[2];
    y = +dmy[3];
  } else if (short) {
    d = +short[1];
    m = +short[2];
    y = 2000 + +short[3];
  } else {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Skutečná délka měsíce — 31. února je překlep, ne datum.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;

  return `${y.toString().padStart(4, "0")}-${m
    .toString()
    .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Klíč proti duplicitám                                               */
/* ------------------------------------------------------------------ */

/** FNV-1a, dvakrát s jiným základem — 64 bitů, aby kolize nebyla reálná. */
function hash64(s: string): string {
  const one = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return one(0x811c9dc5) + one(0x9dc5811c);
}

/**
 * Klíč proti opakovanému nahrání téhož výpisu.
 *
 * Když banka dodá vlastní id transakce, je to ono. Jinak se skládá klíč
 * z data, částky, protiúčtu a VS — a zbytek řádku se přidá jako otisk, aby
 * shoda nevznikla náhodou. Klíč je schválně čitelný, ne jen hash: když se
 * duplicita řeší, je vidět, čeho se týká.
 */
export function dedupeKey(r: {
  externalId: string | null;
  bookedAt: string;
  amount: number;
  account: string;
  counterAccount: string;
  vs: string;
  counterName: string;
  message: string;
}): string {
  if (r.externalId) return `id:${r.externalId}`;
  const rest = hash64(`${r.counterName}|${r.message}|${r.account}`);
  return `k:${r.bookedAt}|${r.amount.toFixed(2)}|${r.counterAccount}|${r.vs}|${rest}`;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

function emptyMapping(): Record<Field, string | null> {
  const m = {} as Record<Field, string | null>;
  for (const f of Object.keys(ALIASES) as Field[]) m[f] = null;
  return m;
}

/**
 * Najde záznam s hlavičkou. RB předsazuje před tabulku pár řádků o účtu
 * a období, takže hlavička nemusí být první.
 *
 * Vrací i řádek, ve kterém povinná pole chybí. Je to schválně: „ve výpisu
 * chybí sloupec s částkou" se dá spravit, kdežto „nenašel jsem hlavičku"
 * u souboru, kde hlavička viditelně je, akorát vypadá jako chyba aplikace.
 */
interface HeaderCandidate {
  index: number;
  delimiter: string;
  score: number;
  hasRequired: boolean;
}

function findHeader(records: Record_[]): HeaderCandidate | null {
  const limit = Math.min(records.length, 30);
  let best: HeaderCandidate | null = null;
  for (let i = 0; i < limit; i++) {
    const line = records[i].text;
    if (!line.trim()) continue;
    const delimiter = detectDelimiter(line);
    const cells = splitLine(line, delimiter).map(normalizeHeader);
    if (cells.length < 2) continue;
    let score = 0;
    for (const f of Object.keys(ALIASES) as Field[]) {
      if (cells.some((c) => c && ALIASES[f].includes(c))) score++;
    }
    if (score === 0) continue;
    const hasRequired = REQUIRED.every((f) =>
      cells.some((c) => c && ALIASES[f].includes(c)),
    );
    // Řádek s oběma povinnými poli vyhrává nad lépe bodovaným bez nich.
    const better =
      !best ||
      (hasRequired && !best.hasRequired) ||
      (hasRequired === best.hasRequired && score > best.score);
    if (better) best = { index: i, delimiter, score, hasRequired };
  }
  return best;
}

export function parseStatement(text: string): ParsedStatement {
  const base: ParsedStatement = {
    rows: [],
    problems: [],
    mapping: emptyMapping(),
    unmapped: [],
    delimiter: ";",
    format: "csv",
    account: null,
    periodFrom: null,
    periodTo: null,
    ok: false,
  };

  const clean = text.replace(/^\ufeff/, "");
  const records = splitRecords(clean);
  if (!records.some((r) => r.text.trim())) {
    base.problems.push({
      line: 1,
      kind: "empty-file",
      detail: "Soubor je prázdný.",
    });
    return base;
  }

  const head = findHeader(records);
  if (!head || head.score < 2) {
    base.problems.push({
      line: 1,
      kind: "missing-column",
      detail:
        "V souboru není řádek s hlavičkou, ve kterém by šly rozpoznat sloupce výpisu.",
    });
    return base;
  }

  const { index: headerIndex, delimiter } = head;
  base.delimiter = delimiter;
  const headers = splitLine(records[headerIndex].text, delimiter);
  const normalized = headers.map(normalizeHeader);

  // Mapování hlaviček na pole. Sloupec se použije jen jednou — kdyby výpis
  // obsahoval dva stejně pojmenované, druhý zůstane nenamapovaný a je vidět.
  const takenColumns = new Set<number>();
  const columnOf = {} as Record<Field, number>;
  for (const f of Object.keys(ALIASES) as Field[]) {
    let found = -1;
    for (const alias of ALIASES[f]) {
      const idx = normalized.findIndex(
        (h, i) => h === alias && !takenColumns.has(i),
      );
      if (idx >= 0) {
        found = idx;
        break;
      }
    }
    if (found >= 0) {
      takenColumns.add(found);
      columnOf[f] = found;
      base.mapping[f] = headers[found];
    }
  }
  base.unmapped = headers.filter((h, i) => h && !takenColumns.has(i));

  const missing = REQUIRED.filter((f) => columnOf[f] === undefined);
  if (missing.length) {
    const names: Record<Field, string> = {
      bookedAt: "datum",
      amount: "částka",
    } as Record<Field, string>;
    base.problems.push({
      line: records[headerIndex].line,
      kind: "missing-column",
      detail: `Ve výpisu chybí sloupec: ${missing
        .map((f) => names[f] ?? f)
        .join(", ")}. Import by uložil řádky bez data nebo bez částky.`,
    });
    return base;
  }

  const cell = (cells: string[], f: Field): string => {
    const i = columnOf[f];
    if (i === undefined) return "";
    return cells[i] ?? "";
  };

  const rows: ParsedRow[] = [];
  const seenInFile = new Map<string, number>();

  for (let i = headerIndex + 1; i < records.length; i++) {
    const line = records[i].text;
    const lineNo = records[i].line;
    if (!line.trim()) continue;

    const cells = splitLine(line, delimiter);
    // Řádek kratší než hlavička bývá patička se součtem, ne transakce.
    if (cells.length < headers.length) {
      const dateRaw = cells[columnOf.bookedAt] ?? "";
      const amountRaw = cells[columnOf.amount] ?? "";
      if (!parseDate(dateRaw) || parseAmount(amountRaw) === null) continue;
      base.problems.push({
        line: lineNo,
        kind: "ragged-row",
        detail: `Řádek má ${cells.length} sloupců místo ${headers.length}, ale vypadá jako transakce.`,
      });
      continue;
    }

    const bookedAt = parseDate(cell(cells, "bookedAt"));
    if (!bookedAt) {
      base.problems.push({
        line: lineNo,
        kind: "bad-date",
        detail: `Nečitelné datum „${cell(cells, "bookedAt")}".`,
      });
      continue;
    }

    const amount = parseAmount(cell(cells, "amount"));
    if (amount === null) {
      base.problems.push({
        line: lineNo,
        kind: "bad-amount",
        detail: `Nečitelná částka „${cell(cells, "amount")}".`,
      });
      continue;
    }

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) raw[h] = cells[idx] ?? "";
    });

    const externalIdRaw = cell(cells, "externalId").trim();
    const row: ParsedRow = {
      bookedAt,
      valueDate: parseDate(cell(cells, "valueDate")),
      account: cell(cells, "account"),
      amount,
      currency: cell(cells, "currency") || "CZK",
      counterAccount: cell(cells, "counterAccount"),
      counterName: cell(cells, "counterName"),
      vs: cell(cells, "vs"),
      ks: cell(cells, "ks"),
      ss: cell(cells, "ss"),
      message: cell(cells, "message"),
      note: cell(cells, "note"),
      txType: cell(cells, "txType"),
      fee: parseAmount(cell(cells, "fee")) ?? 0,
      externalId: externalIdRaw || null,
      dedupeKey: "",
      raw,
      line: lineNo,
    };

    let key = dedupeKey(row);
    // Dvě opravdu shodné platby v jednom souboru jsou dvě platby, ne duplicita.
    // Pořadové číslo je odvozené od pořadí v souboru, takže druhé nahrání
    // téhož výpisu dá stejné klíče a zachytí se jako duplicita.
    const seen = seenInFile.get(key) ?? 0;
    seenInFile.set(key, seen + 1);
    if (seen > 0) key = `${key}#${seen + 1}`;
    row.dedupeKey = key;

    rows.push(row);
  }

  base.rows = rows;
  if (rows.length) {
    const dates = rows.map((r) => r.bookedAt).sort();
    base.periodFrom = dates[0];
    base.periodTo = dates[dates.length - 1];
    base.account = rows.find((r) => r.account)?.account ?? null;
  }
  base.ok = rows.length > 0;
  if (!rows.length) {
    base.problems.push({
      line: records[headerIndex].line,
      kind: "empty-file",
      detail: "Hlavička je v pořádku, ale soubor neobsahuje žádnou transakci.",
    });
  }
  return base;
}
