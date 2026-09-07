/**
 * Parser výpisu camt.053 z Raiffeisenbank.
 *
 * Proti CSV je tu jeden zásadní rozdíl: **znaménko není v částce**, ale
 * v elementu CdtDbtInd. Záznam bez něj proto nesmí projít jako příjem —
 * bez toho indikátoru se nedá poznat, kterým směrem peníze šly.
 *
 * Fixture má strukturu skutečného výpisu, ale vymyšlená data. Proti pravým
 * výpisům je parser ověřený zvlášť: 722 transakcí z 15 měsíců sedí do haléře
 * na součty, které si banka uvádí sama v hlavičce (TxsSummry).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isCamt, merchantFromInfo, parseCamt053 } from "../lib/bank/camt053";
import { parseBankStatement } from "../lib/bank/parse";

const xml = readFileSync("tests/fixtures/rb-camt053.xml", "utf8");
const s = parseCamt053(xml);
const byId = (id: string) => s.rows.find((r) => r.externalId === id)!;

describe("rozpoznání formátu", () => {
  it("pozná camt.053 podle obsahu, ne podle přípony", () => {
    expect(isCamt(xml)).toBe(true);
    expect(isCamt("Datum;Částka\n01.08.2026;-100,00\n")).toBe(false);
  });

  it("rozcestník pošle XML na camt a CSV na CSV", () => {
    expect(parseBankStatement(xml).format).toBe("camt053");
    expect(
      parseBankStatement(
        "Datum zaúčtování;Zaúčtovaná částka;Název protiúčtu\n05.08.2026;-100,00;Alza\n",
      ).format,
    ).toBe("csv");
  });

  it("cizí XML neposílá do CSV parseru, ale řekne, co stáhnout", () => {
    const out = parseBankStatement('<?xml version="1.0"?><faktura><id>7</id></faktura>');
    expect(out.ok).toBe(false);
    expect(out.problems[0].detail).toContain("camt.053");
  });
});

describe("čtení výpisu", () => {
  it("načte transakce a období", () => {
    expect(s.ok).toBe(true);
    expect(s.rows).toHaveLength(8);
    expect(s.periodFrom).toBe("2026-08-10");
    expect(s.periodTo).toBe("2026-08-31");
    expect(s.account).toBe("CZ0000000000001234567890");
  });

  it("směr platby určuje CdtDbtInd, ne znaménko u částky", () => {
    expect(byId("9000000001").amount).toBe(50000);
    expect(byId("9000000002").amount).toBe(-38361);
  });

  it("desetinná částka se nezaokrouhlí", () => {
    expect(byId("9000000005").amount).toBe(-288.87);
  });

  it("datum zaúčtování i provedení se berou zvlášť a čas se zahodí", () => {
    const karta = byId("9000000004");
    expect(karta.bookedAt).toBe("2026-08-14");
    expect(karta.valueDate).toBe("2026-08-12");
  });

  it("ID transakce slouží jako klíč proti duplicitám", () => {
    expect(byId("9000000001").dedupeKey).toBe("id:9000000001");
  });

  it("stejný soubor nahraný dvakrát dá stejné klíče", () => {
    expect(parseCamt053(xml).rows.map((r) => r.dedupeKey)).toEqual(
      s.rows.map((r) => r.dedupeKey),
    );
  });
});

describe("protistrana", () => {
  it("u příchozí platby se bere z Dbtr", () => {
    const r = byId("9000000001");
    expect(r.counterName).toBe("Kerosin s.r.o.");
    expect(r.counterAccount).toBe("778899000/0100");
  });

  it("u odchozí platby z CdtrAcct", () => {
    const r = byId("9000000002");
    expect(r.counterName).toBe("DronPro s.r.o");
    expect(r.counterAccount).toBe("9034331001/5500");
  });

  it("když jméno chybí, zbude aspoň číslo účtu", () => {
    const r = byId("9000000003");
    expect(r.counterName).toBe("");
    expect(r.counterAccount).toBe("115-8579770237/0100");
  });

  it("u karetní platby se jméno obchodníka vytáhne z volného textu", () => {
    expect(byId("9000000004").counterName).toBe("PAPIRNICTVI NOVAK s.r.o.");
  });

  it("u platby v cizí měně se přeskočí původní částka před obchodníkem", () => {
    expect(byId("9000000005").counterName).toBe("CLOUDSLUZBA.IO");
  });

  it("kde obchodník není, zůstane prázdno — jméno se nevymýšlí", () => {
    expect(byId("9000000006").counterName).toBe("");
  });
});

describe("vytažení obchodníka z volného textu", () => {
  it("bere první část před středníkem", () => {
    expect(merchantFromInfo("COPY GENERAL s.r.o.; Praha 5; CZE")).toBe(
      "COPY GENERAL s.r.o.",
    );
  });

  it("odstřihne původní částku u platby v cizí měně", () => {
    expect(merchantFromInfo("13,31 USD;ELEVENLABS.IO; NEW YORK; USA")).toBe(
      "ELEVENLABS.IO",
    );
  });

  it("z textu, kde je jen částka a kurz, nevyrobí obchodníka", () => {
    expect(merchantFromInfo("270,00 USD;KURZ: 20,977")).toBe("");
    expect(merchantFromInfo("79,00 EUR;KURZ: 24,304")).toBe("");
  });

  it("text bez středníku vezme celý", () => {
    expect(merchantFromInfo("Odměna za mobilní platby")).toBe(
      "Odměna za mobilní platby",
    );
  });
});

describe("symboly", () => {
  it("čtou se z prefixu, ne z pozice", () => {
    const r = byId("9000000002");
    expect(r.vs).toBe("260101624");
    expect(r.ks).toBe("0308");
    expect(r.ss).toBe("");
  });

  it("úvodní nula v symbolu se neztratí", () => {
    expect(byId("9000000004").ks).toBe("1178");
    expect(byId("9000000002").ks).toBe("0308");
  });
});

describe("typ transakce se odvozuje z dat, ne z kódu banky", () => {
  it("maskované číslo karty znamená platbu kartou", () => {
    expect(byId("9000000004").txType).toBe("Platba kartou");
  });

  it("RvslInd znamená storno", () => {
    expect(byId("9000000007").txType).toBe("Storno");
    expect(byId("9000000007").amount).toBe(884);
  });

  it("jinak rozhoduje směr", () => {
    expect(byId("9000000001").txType).toBe("Příchozí platba");
    expect(byId("9000000002").txType).toBe("Odchozí platba");
  });
});

describe("poplatky", () => {
  it("chodí jako samostatná transakce, ne jako pole u platby", () => {
    const poplatek = byId("9000000008");
    expect(poplatek.amount).toBe(-99);
    expect(poplatek.message).toContain("Souhrnná položka");
  });

  it("pole fee je proto vždy nulové a nic se nezapočítá dvakrát", () => {
    expect(s.rows.every((r) => r.fee === 0)).toBe(true);
  });
});

describe("co parser nepřečte, nahlásí", () => {
  it("záznam bez směru platby neprojde a řekne proč", () => {
    expect(s.rows.some((r) => r.externalId === "9000000009")).toBe(false);
    const p = s.problems.find((x) => x.kind === "bad-amount")!;
    expect(p.detail).toContain("9000000009");
    expect(p.detail).toContain("směr platby");
  });

  it("XML bez výpisu neprojde", () => {
    const out = parseCamt053(
      '<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"></Document>',
    );
    expect(out.ok).toBe(false);
    expect(out.problems[0].detail).toContain("camt.053");
  });

  it("rozbité XML neshodí parser", () => {
    const out = parseCamt053("<Document><Stmt>");
    expect(out.ok).toBe(false);
    expect(out.rows).toHaveLength(0);
  });
});

describe("původní záznam", () => {
  it("se uloží celý, ať jde dohledat, co banka poslala", () => {
    const raw = byId("9000000005").raw;
    expect(raw["NtryRef"]).toBe("9000000005");
    expect(raw["NtryDtls/TxDtls/AmtDtls/InstdAmt/Amt/#text"]).toBe("13.31");
    expect(raw["NtryDtls/TxDtls/Refs/ChqNb"]).toBe("547872XXXXXX8660");
  });
});
