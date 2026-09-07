/**
 * Parser bankovního výpisu ve formátu camt.053 (ISO 20022).
 *
 * Tohle je hlavní cesta pro Raiffeisenbank — CSV z internetového bankovnictví
 * nabídnout nejde, exportuje se PDF, XML, GPC nebo ACE. XML je z nich jediné,
 * které nese název protistrany i volný text; GPC má na jméno dvacet znaků
 * a zprávu neveze vůbec.
 *
 * Výsledek má **stejný tvar jako u CSV**, takže všechno za parserem —
 * kategorizace, pravidla, analytika, klíč proti duplicitám, databáze i UI —
 * o formátu neví a nemuselo se kvůli němu měnit.
 *
 * Čistá funkce nad řetězcem, běží i v prohlížeči.
 */
import { XMLParser } from "fast-xml-parser";
import type { Field, ParseProblem, ParsedRow, ParsedStatement } from "./rb-csv";
import { dedupeKey } from "./rb-csv";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  // Jmenný prostor camt se liší verzi od verze. Zahodit ho je bezpečnější
  // než ho hlídat — jinak by výpis v camt.053.001.08 přestal jít načíst.
  removeNSPrefix: true,
  // Hodnoty si převádíme sami. Automatický převod by z variabilního symbolu
  // 0012345 udělal číslo 12345 a ze symbolu by zmizely úvodní nuly.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** Jeden prvek, nebo pole prvků — camt obojí připouští podle počtu výskytů. */
function arr<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function str(x: unknown): string {
  if (x === undefined || x === null) return "";
  if (typeof x === "object") return "";
  return String(x).trim();
}

/** Datum z DtTm nebo Dt. Čas se zahazuje — výpis je denní. */
function isoDate(x: unknown): string | null {
  const s = str(x);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function num(x: unknown): number | null {
  const s = str(x).replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Symboly jsou v RmtInf/Strd/CdtrRefInf/Ref, každý s prefixem — `VS:250101624`,
 * `KS:1178`, `SS:...`. Jeden záznam jich může nést víc.
 */
function symbols(txDtls: any): { vs: string; ks: string; ss: string } {
  const out = { vs: "", ks: "", ss: "" };
  for (const strd of arr(txDtls?.RmtInf?.Strd)) {
    for (const ref of arr(strd?.CdtrRefInf?.Ref)) {
      const s = str(ref);
      const m = /^(VS|KS|SS)\s*:\s*(.*)$/i.exec(s);
      if (!m) continue;
      const key = m[1].toLowerCase() as "vs" | "ks" | "ss";
      if (!out[key]) out[key] = m[2].trim();
    }
  }
  return out;
}

/** Maskované číslo karty, např. 408361XXXXXX0464. */
const MASKED_CARD = /^\d{6}X{4,8}\d{4}$/i;

/**
 * Obchodník z volného textu u karetní transakce.
 *
 * Text má tvar `OBCHODNÍK; Město; ZEMĚ`, u plateb v cizí měně je před ním
 * ještě původní částka: `13,31 USD;ELEVENLABS.IO; NEW YORK; USA`. Někdy za
 * částkou nenásleduje obchodník vůbec, jen kurz — pak zůstane prázdný, což je
 * správně; vymýšlet jméno protistrany z ničeho by bylo horší než ho nemít.
 */
export function merchantFromInfo(info: string): string {
  let rest = info.trim();
  const fx = /^[\d\s.,]+\s*[A-Z]{3}\s*;\s*/.exec(rest);
  if (fx) rest = rest.slice(fx[0].length);
  if (/^KURZ\s*:/i.test(rest)) return "";
  const first = rest.split(";")[0].trim();
  return first;
}

/** Číslo účtu protistrany včetně kódu banky, jak je Čech čte. */
function accountNumber(acct: any, agent: any): string {
  const id = str(acct?.Id?.Othr?.Id) || str(acct?.Id?.IBAN);
  const bank = str(agent?.FinInstnId?.Othr?.Id);
  if (!id) return "";
  return bank ? `${id}/${bank}` : id;
}

/** Původní záznam zploštělý na dvojice cesta → hodnota, pro detail transakce. */
function flatten(node: any, prefix = "", out: Record<string, string> = {}) {
  if (node === null || node === undefined) return out;
  if (typeof node !== "object") {
    if (prefix) out[prefix] = String(node);
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}/${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => flatten(item, `${key}[${i + 1}]`, out));
    } else {
      flatten(v, key, out);
    }
  }
  return out;
}

/** Co se z výpisu čte, pro náhled před uložením. */
const MAPPING: Record<Field, string | null> = {
  bookedAt: "Ntry/BookgDt/DtTm",
  valueDate: "Ntry/ValDt/DtTm",
  account: "Stmt/Acct/Id/IBAN",
  accountName: "Stmt/Acct/Nm",
  amount: "Ntry/Amt + CdtDbtInd",
  currency: "Ntry/Amt@Ccy",
  counterAccount: "RltdPties/{Cdtr,Dbtr}Acct + RltdAgts",
  counterName: "RltdPties/{Cdtr,Dbtr}[Acct]/Nm, jinak AddtlTxInf",
  vs: "RmtInf/Strd/CdtrRefInf/Ref (VS:)",
  ks: "RmtInf/Strd/CdtrRefInf/Ref (KS:)",
  ss: "RmtInf/Strd/CdtrRefInf/Ref (SS:)",
  message: "NtryDtls/TxDtls/AddtlTxInf",
  note: null,
  txType: "odvozeno z CdtDbtInd, RvslInd a ChqNb",
  // Poplatky jsou v camt.053 samostatné transakce, ne pole u platby.
  fee: null,
  externalId: "Ntry/NtryRef",
};

export function isCamt(text: string): boolean {
  const head = text.slice(0, 4000);
  return /<[A-Za-z0-9]*:?Document[\s>]/.test(head) && /camt\.05[23]/.test(head);
}

export function parseCamt053(text: string): ParsedStatement {
  const base: ParsedStatement = {
    rows: [],
    problems: [],
    mapping: { ...MAPPING },
    unmapped: [],
    delimiter: "",
    format: "camt053",
    account: null,
    periodFrom: null,
    periodTo: null,
    ok: false,
  };

  let doc: any;
  try {
    doc = parser.parse(text);
  } catch {
    base.problems.push({
      line: 1,
      kind: "missing-column",
      detail: "Soubor není platné XML.",
    });
    return base;
  }

  const stmts = arr(doc?.Document?.BkToCstmrStmt?.Stmt);
  if (!stmts.length) {
    base.problems.push({
      line: 1,
      kind: "missing-column",
      detail:
        "V souboru není výpis camt.053 (chybí Document/BkToCstmrStmt/Stmt).",
    });
    return base;
  }

  const rows: ParsedRow[] = [];
  const problems: ParseProblem[] = [];
  const seenInFile = new Map<string, number>();
  let entryNo = 0;

  for (const stmt of stmts) {
    const account =
      str(stmt?.Acct?.Id?.IBAN) || str(stmt?.Acct?.Id?.Othr?.Id) || "";
    if (!base.account && account) base.account = account;

    for (const ntry of arr(stmt?.Ntry)) {
      entryNo++;
      const tx = arr(ntry?.NtryDtls?.TxDtls)[0] ?? {};

      const bookedAt = isoDate(ntry?.BookgDt?.DtTm ?? ntry?.BookgDt?.Dt);
      if (!bookedAt) {
        problems.push({
          line: entryNo,
          kind: "bad-date",
          detail: `Transakce ${str(ntry?.NtryRef) || entryNo}. nemá čitelné datum zaúčtování.`,
        });
        continue;
      }

      const magnitude = num(ntry?.Amt?.["#text"] ?? ntry?.Amt);
      if (magnitude === null) {
        problems.push({
          line: entryNo,
          kind: "bad-amount",
          detail: `Transakce ${str(ntry?.NtryRef) || entryNo}. nemá čitelnou částku.`,
        });
        continue;
      }

      /**
       * Znaménko není v částce, ale v CdtDbtInd — na rozdíl od CSV, kde ho
       * banka píše přímo k číslu. Chybějící indikátor proto nesmí projít jako
       * příjem; bez něj nevíme, kterým směrem peníze šly.
       */
      const ind = str(ntry?.CdtDbtInd).toUpperCase();
      if (ind !== "CRDT" && ind !== "DBIT") {
        problems.push({
          line: entryNo,
          kind: "bad-amount",
          detail: `Transakce ${str(ntry?.NtryRef) || entryNo}. neuvádí směr platby (CdtDbtInd = „${ind || "nic"}").`,
        });
        continue;
      }
      const amount = ind === "CRDT" ? magnitude : -magnitude;

      const parties = tx?.RltdPties;
      const agents = tx?.RltdAgts;
      const outgoing = ind === "DBIT";
      const info = str(tx?.AddtlTxInf);

      const partyName =
        (outgoing
          ? str(parties?.Cdtr?.Nm) || str(parties?.CdtrAcct?.Nm)
          : str(parties?.Dbtr?.Nm) || str(parties?.DbtrAcct?.Nm)) || "";
      // U karetních plateb protistrana v RltdPties není vůbec — jméno
      // obchodníka nese jedině volný text.
      const counterName = partyName || merchantFromInfo(info);

      const counterAccount = outgoing
        ? accountNumber(parties?.CdtrAcct, agents?.CdtrAgt)
        : accountNumber(parties?.DbtrAcct, agents?.DbtrAgt);

      const chqNb = str(tx?.Refs?.ChqNb);
      const reversal = ntry?.RvslInd !== undefined;
      /**
       * Popis se odvozuje z toho, co v záznamu skutečně stojí, ne z kódu
       * BkTxCd. Ten kód je u RB směska — pod jedním se schová zápočet, storno
       * karty i směnárenský poplatek — a vymýšlet k němu název by znamenalo
       * tvrdit uživateli něco, co z dat neplyne.
       */
      const txType = reversal
        ? "Storno"
        : MASKED_CARD.test(chqNb)
          ? "Platba kartou"
          : outgoing
            ? "Odchozí platba"
            : "Příchozí platba";

      const sym = symbols(tx);
      const externalId = str(ntry?.NtryRef) || str(tx?.Refs?.AcctSvcrRef) || null;

      const row: ParsedRow = {
        bookedAt,
        valueDate: isoDate(ntry?.ValDt?.DtTm ?? ntry?.ValDt?.Dt),
        account,
        amount,
        currency: str(ntry?.Amt?.["@Ccy"]) || "CZK",
        counterAccount,
        counterName,
        vs: sym.vs,
        ks: sym.ks,
        ss: sym.ss,
        message: info,
        note: "",
        txType,
        // Poplatky chodí jako samostatné transakce, ne jako pole u platby.
        fee: 0,
        externalId,
        dedupeKey: "",
        raw: flatten(ntry),
        line: entryNo,
      };

      let key = dedupeKey(row);
      const seen = seenInFile.get(key) ?? 0;
      seenInFile.set(key, seen + 1);
      if (seen > 0) key = `${key}#${seen + 1}`;
      row.dedupeKey = key;

      rows.push(row);
    }
  }

  base.rows = rows;
  base.problems = problems;
  if (rows.length) {
    const dates = rows.map((r) => r.bookedAt).sort();
    base.periodFrom = dates[0];
    base.periodTo = dates[dates.length - 1];
  } else {
    base.problems.push({
      line: 1,
      kind: "empty-file",
      detail: "Výpis je platný, ale neobsahuje žádnou transakci.",
    });
  }
  base.ok = rows.length > 0;
  return base;
}
