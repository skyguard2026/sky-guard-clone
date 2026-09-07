/**
 * Parser bankovního výpisu.
 *
 * Základní pravidlo, které se tu ověřuje: co parser nepřečte, musí nahlásit.
 * Tiše zahozený řádek by snížil součet výdajů a nikdo by nepoznal proč.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeStatement } from "../lib/bank/decode";
import {
  dedupeKey,
  detectDelimiter,
  normalizeHeader,
  parseAmount,
  parseDate,
  parseStatement,
  splitLine,
  splitRecords,
} from "../lib/bank/rb-csv";

const utf8 = readFileSync("tests/fixtures/rb-vypis.csv", "utf8");

describe("české číslo z výpisu", () => {
  it("přečte oddělovač tisíců mezerou a desetinnou čárku", () => {
    expect(parseAmount("1 234,56")).toBe(1234.56);
    expect(parseAmount("-12 500,00")).toBe(-12500);
    expect(parseAmount("50 000,00")).toBe(50000);
  });

  it("zvládne pevnou i úzkou mezeru, kterou exporty používají", () => {
    expect(parseAmount("1\u00a0234,56")).toBe(1234.56);
    expect(parseAmount("1\u202f234,56")).toBe(1234.56);
  });

  it("odstřihne měnu i znaménko plus", () => {
    expect(parseAmount("1 234,56 CZK")).toBe(1234.56);
    expect(parseAmount("+1234.56")).toBe(1234.56);
  });

  it("tečka se třemi číslicemi jsou tisíce, jinak desetiny", () => {
    expect(parseAmount("1.234")).toBe(1234);
    expect(parseAmount("1.5")).toBe(1.5);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
  });

  it("závorky u storna znamenají zápor", () => {
    expect(parseAmount("(1 200,00)")).toBe(-1200);
  });

  it("nečitelnou hodnotu vrátí jako null, ne jako nulu", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("neuvedeno")).toBeNull();
    expect(parseAmount("12-34")).toBeNull();
  });

  it("nulu vrátí jako nulu, ne jako null", () => {
    expect(parseAmount("0,00")).toBe(0);
  });
});

describe("datum z výpisu", () => {
  it("přečte český i ISO tvar", () => {
    expect(parseDate("05.08.2026")).toBe("2026-08-05");
    expect(parseDate("5.8.2026")).toBe("2026-08-05");
    expect(parseDate("2026-08-05")).toBe("2026-08-05");
    expect(parseDate("05/08/2026")).toBe("2026-08-05");
  });

  it("zahodí čas za datem", () => {
    expect(parseDate("05.08.2026 10:23:45")).toBe("2026-08-05");
  });

  it("odmítne datum, které neexistuje", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("32.13.2026")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("včera")).toBeNull();
  });
});

describe("rozdělení CSV", () => {
  it("hlavičku normalizuje bez diakritiky a interpunkce", () => {
    expect(normalizeHeader("Zaúčtovaná částka")).toBe("zauctovana castka");
    expect(normalizeHeader("  Číslo protiúčtu  ")).toBe("cislo protiuctu");
  });

  it("pozná středník jako oddělovač", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a,b,c")).toBe(",");
  });

  it("uvozovky ochrání oddělovač uvnitř hodnoty", () => {
    expect(splitLine('a;"b;c";d', ";")).toEqual(["a", "b;c", "d"]);
  });

  it("zdvojené uvozovky uvnitř hodnoty jsou jedny", () => {
    expect(splitLine('a;"řekl ""ano""";b', ";")).toEqual([
      "a",
      'řekl "ano"',
      "b",
    ]);
  });

  it("konec řádku uvnitř uvozovek nerozdělí transakci na dvě", () => {
    expect(splitRecords('a;"prvni\ndruhy";b\nx;y;z')).toEqual([
      { text: 'a;"prvni\ndruhy";b', line: 1 },
      { text: "x;y;z", line: 3 },
    ]);
  });

  it("záznam si nese fyzický řádek, ne své pořadí", () => {
    const recs = splitRecords('a\n"dva\nradky"\nc');
    expect(recs.map((r) => r.line)).toEqual([1, 2, 4]);
  });
});

describe("výpis z Raiffeisenbank", () => {
  const s = parseStatement(utf8);

  it("najde hlavičku, i když nad ní stojí řádky o účtu a období", () => {
    expect(s.ok).toBe(true);
    expect(s.delimiter).toBe(";");
    expect(s.mapping.bookedAt).toBe("Datum zaúčtování");
    expect(s.mapping.valueDate).toBe("Datum provedení");
    expect(s.mapping.amount).toBe("Zaúčtovaná částka");
    expect(s.mapping.counterName).toBe("Název protiúčtu");
    expect(s.mapping.counterAccount).toBe("Číslo protiúčtu");
    expect(s.mapping.externalId).toBe("ID transakce");
  });

  it("načte transakce, které přečíst šly", () => {
    expect(s.rows).toHaveLength(8);
    expect(s.periodFrom).toBe("2026-08-05");
    expect(s.periodTo).toBe("2026-08-25");
    expect(s.account).toBe("1234567890/5500");
  });

  it("znaménko z výpisu nechá být — výdaj je záporný, příjem kladný", () => {
    const alza = s.rows.find((r) => r.counterName.startsWith("Alza"))!;
    expect(alza.amount).toBe(-12500);
    const klient = s.rows.find((r) => r.counterName === "Kerosin s.r.o.")!;
    expect(klient.amount).toBe(50000);
  });

  it("středník ve zprávě pro příjemce nerozhodí sloupce", () => {
    const vodafone = s.rows.find((r) => r.counterName.startsWith("Vodafone"))!;
    expect(vodafone.message).toBe("Faktura 2026/0812; SIM karty");
    expect(vodafone.amount).toBe(-2480);
  });

  it("víceřádková zpráva zůstane jednou transakcí", () => {
    const pojistka = s.rows.find((r) => r.counterName.startsWith("Česká"))!;
    expect(pojistka.message).toContain("Pojistné za dron");
    expect(pojistka.message).toContain("období 08/2026");
    expect(pojistka.fee).toBe(12);
  });

  it("řádek s nečitelným datem nahlásí a nezapočítá", () => {
    const bad = s.problems.find((p) => p.kind === "bad-date");
    expect(bad).toBeDefined();
    expect(bad!.detail).toContain("32.13.2026");
    expect(bad!.line).toBe(9);
    expect(s.rows.some((r) => r.message === "Rozbité datum")).toBe(false);
  });

  it("hlášené číslo řádku sedí na soubor i za víceřádkovou zprávou", () => {
    // Pojistné zabírá dva fyzické řádky, takže od něj dál se pořadí záznamu
    // a číslo řádku rozcházejí. Hlásí se to, co uživatel najde v editoru.
    const ragged = s.problems.find((p) => p.kind === "ragged-row")!;
    expect(ragged.line).toBe(15);
    const benzina = s.rows.filter((r) => r.counterName === "Benzina s.r.o.");
    expect(benzina.map((r) => r.line)).toEqual([13, 14]);
  });

  it("useknutý řádek, který vypadá jako transakce, nahlásí", () => {
    const ragged = s.problems.find((p) => p.kind === "ragged-row");
    expect(ragged).toBeDefined();
    expect(ragged!.detail).toContain("14 sloupců místo 16");
  });

  it("patičku se součtem ignoruje beze slova", () => {
    expect(s.rows.some((r) => r.counterName === "Celkem")).toBe(false);
    expect(s.problems.filter((p) => p.kind === "ragged-row")).toHaveLength(1);
  });

  it("uloží původní řádek sloupec po sloupci", () => {
    const alza = s.rows.find((r) => r.counterName.startsWith("Alza"))!;
    expect(alza.raw["Zaúčtovaná částka"]).toBe("-12 500,00");
    expect(alza.raw["Konstantní symbol"]).toBe("0308");
  });
});

describe("klíč proti duplicitám", () => {
  it("stejný soubor nahraný dvakrát dá stejné klíče", () => {
    const a = parseStatement(utf8).rows.map((r) => r.dedupeKey);
    const b = parseStatement(utf8).rows.map((r) => r.dedupeKey);
    expect(a).toEqual(b);
  });

  it("id transakce z banky má přednost", () => {
    const s = parseStatement(utf8);
    const alza = s.rows.find((r) => r.counterName.startsWith("Alza"))!;
    expect(alza.dedupeKey).toBe("id:TX0001");
  });

  it("dvě shodné platby v jednom souboru jsou dvě platby, ne duplicita", () => {
    const s = parseStatement(utf8);
    const benzina = s.rows.filter((r) => r.counterName === "Benzina s.r.o.");
    expect(benzina).toHaveLength(2);
    expect(benzina[0].dedupeKey).not.toBe(benzina[1].dedupeKey);
    expect(benzina[1].dedupeKey.endsWith("#2")).toBe(true);
  });

  it("bez id se klíč liší, když se liší částka", () => {
    const base = {
      externalId: null,
      bookedAt: "2026-08-05",
      account: "1/1",
      counterAccount: "2/2",
      vs: "1234",
      counterName: "Alza",
      message: "hw",
    };
    expect(dedupeKey({ ...base, amount: -100 })).not.toBe(
      dedupeKey({ ...base, amount: -101 }),
    );
  });

  it("bez id se klíč liší, když se liší jen zpráva", () => {
    const base = {
      externalId: null,
      bookedAt: "2026-08-05",
      amount: -100,
      account: "1/1",
      counterAccount: "2/2",
      vs: "1234",
      counterName: "Alza",
    };
    expect(dedupeKey({ ...base, message: "první" })).not.toBe(
      dedupeKey({ ...base, message: "druhá" }),
    );
  });
});

describe("import se nesmí spustit nad souborem, kterému parser nerozumí", () => {
  it("chybějící sloupec s částkou zastaví celý import", () => {
    const s = parseStatement(
      "Datum zaúčtování;Název protiúčtu;Variabilní symbol\n05.08.2026;Alza;1234\n",
    );
    expect(s.ok).toBe(false);
    expect(s.rows).toHaveLength(0);
    const p = s.problems.find((x) => x.kind === "missing-column")!;
    expect(p.detail).toContain("částka");
  });

  it("soubor bez rozpoznatelné hlavičky neprojde", () => {
    const s = parseStatement("tohle;není;výpis\n1;2;3\n");
    expect(s.ok).toBe(false);
    expect(s.problems[0].kind).toBe("missing-column");
  });

  it("prázdný soubor neprojde", () => {
    const s = parseStatement("");
    expect(s.ok).toBe(false);
    expect(s.problems[0].kind).toBe("empty-file");
  });

  it("hlavička v pořádku, ale žádná transakce, taky neprojde", () => {
    const s = parseStatement(
      "Datum zaúčtování;Zaúčtovaná částka;Název protiúčtu\n",
    );
    expect(s.ok).toBe(false);
    expect(s.problems[0].kind).toBe("empty-file");
  });

  it("neznámé sloupce nejsou chyba, jen se vypíšou", () => {
    const s = parseStatement(
      "Datum zaúčtování;Zaúčtovaná částka;Vlastní sloupec banky\n05.08.2026;-100,00;cokoli\n",
    );
    expect(s.ok).toBe(true);
    expect(s.unmapped).toEqual(["Vlastní sloupec banky"]);
    expect(s.rows[0].raw["Vlastní sloupec banky"]).toBe("cokoli");
  });
});

describe("kódování souboru", () => {
  it("windows-1250 se pozná a přečte se stejně jako UTF-8", () => {
    const bytes = readFileSync("tests/fixtures/rb-vypis-cp1250.csv");
    const d = decodeStatement(new Uint8Array(bytes));
    expect(d.encoding).toBe("windows-1250");
    const s = parseStatement(d.text);
    expect(s.ok).toBe(true);
    expect(s.rows).toHaveLength(8);
    expect(
      s.rows.some((r) => r.counterName === "Česká pojišťovna a.s."),
    ).toBe(true);
  });

  it("UTF-8 se pozná a diakritika zůstane celá", () => {
    const bytes = readFileSync("tests/fixtures/rb-vypis.csv");
    const d = decodeStatement(new Uint8Array(bytes));
    expect(d.encoding).toBe("utf-8");
    expect(d.text).toContain("Zaúčtovaná částka");
  });

  it("oba soubory dají po dekódování shodné transakce", () => {
    const a = parseStatement(
      decodeStatement(new Uint8Array(readFileSync("tests/fixtures/rb-vypis.csv"))).text,
    );
    const b = parseStatement(
      decodeStatement(
        new Uint8Array(readFileSync("tests/fixtures/rb-vypis-cp1250.csv")),
      ).text,
    );
    expect(b.rows.map((r) => r.dedupeKey)).toEqual(a.rows.map((r) => r.dedupeKey));
    expect(b.rows.map((r) => r.counterName)).toEqual(
      a.rows.map((r) => r.counterName),
    );
  });
});
