/**
 * Co se smí a nesmí objevit v PDF, které jde klientovi.
 *
 * Kontroluje se ve třech nezávislých vrstvách:
 *  1. vstupní data dokumentu — bez artefaktů sazby, chytí i prostrkaný text
 *  2. text vytažený z hotového PDF — chytí regresi v šabloně
 *  3. whitelist částek — chytí i cenu, kterou tam někdo přidá příště
 *     a na kterou nikdo nemyslel, když se psal blacklist
 */
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SEED_CATALOG } from "../lib/defaults";
import { buildSnapshot, defaultScope, toOfferDocument } from "../lib/offer";
import { checkOfferText, describeOfferWarnings } from "../lib/offer-guard";
import type { Offer } from "../lib/offer-types";
import {
  FORBIDDEN_BRANDS,
  containsAmount,
  findForbiddenTerms,
  normalizeForMatch,
} from "../lib/pdf/forbidden-terms";
import { renderOfferPdf } from "../lib/pdf/render";
import type { CalcLocation } from "../lib/types";

const LOCATION: CalcLocation & { commitmentMonths: number } = {
  product: "drone",
  cameras: 0,
  camerasTlBig: 0,
  camerasTlSmall: 0,
  poles: 0,
  docks: 1,
  km: 260,
  hours: 8,
  trips1: 10,
  trips2: 8,
  price: 50000,
  setupFee: 120000,
  commitmentMonths: 36,
  off: {},
  over: {},
  qty: {},
};

function makeOffer(over: Partial<Offer> = {}): Offer {
  const snapshot = buildSnapshot({
    clientName: "Zemědělské družstvo Vysočina",
    locationName: "Areál Pelhřimov",
    location: LOCATION,
    catalog: SEED_CATALOG,
    settings: DEFAULT_SETTINGS,
    locationCount: 1,
    takenAt: new Date("2026-03-01T10:00:00.000Z"),
  });
  return {
    id: "of1",
    locationId: "l1",
    number: "2026-001",
    version: 1,
    status: "draft",
    createdAt: "2026-03-01T10:00:00.000Z",
    validUntil: "2026-03-31T10:00:00.000Z",
    monthlyPrice: 50000,
    setupFee: 120000,
    commitmentMonths: 36,
    scope: defaultScope("drone", { cameras: 0, poles: 0, docks: 1 }),
    note: "Cena zahrnuje dopravu na lokalitu i pravidelné servisní výjezdy.",
    snapshot,
    ...over,
  };
}

async function pdfText(offer: Offer): Promise<string> {
  const buf = await renderOfferPdf(toOfferDocument(offer));
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}

/** Text bez mezer — šablona písmena prostrkává, extrakce to vrací jako „D O B A". */
const squash = (t: string) => normalizeForMatch(t).replace(/\s+/g, "");

/** Všechny textové hodnoty, které do dokumentu vstupují. */
const documentStrings = (offer: Offer) =>
  Object.values(toOfferDocument(offer))
    .filter((v) => typeof v === "string")
    .join(" ");

const TIMEOUT = 30000;

describe("PDF vznikne a dá se z něj číst", () => {
  it("je to platné PDF s textem", async () => {
    const buf = await renderOfferPdf(toOfferDocument(makeOffer()));
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
    expect((await pdfText(makeOffer())).length).toBeGreaterThan(200);
  }, TIMEOUT);

  it("česká diakritika se vysází správně", async () => {
    const text = await pdfText(makeOffer());
    expect(text).toContain("Měsíční paušál");
    expect(text).toContain("Zemědělské družstvo");
    expect(text).toContain("Areál Pelhřimov");
    expect(text).toContain("36 měsíců");
    expect(squash(text)).toContain(squash("Doba závazku"));
  }, TIMEOUT);

  it("obsahuje, co obsahovat má", async () => {
    const text = await pdfText(makeOffer());
    const tight = squash(text);
    expect(text).toContain("2026-001");
    expect(text).toContain("Sky Guard s.r.o.");
    expect(text).toContain("Pernerova 533/59");
    expect(text).toContain("186 00 Praha 8");
    expect(text).toContain("24803383");
    expect(text).toContain("+420 737 373 430");
    expect(normalizeForMatch(text)).toContain("bez dph");
    expect(tight).toContain(squash("Cenová nabídka"));
    expect(tight).toContain(squash("Rozsah služby"));
  }, TIMEOUT);
});

describe("do PDF se nesmí dostat nic interního", () => {
  it("vstupní data dokumentu neobsahují zakázaný výraz", () => {
    expect(findForbiddenTerms(documentStrings(makeOffer()))).toEqual([]);
  });

  it("ani hotový text PDF", async () => {
    expect(findForbiddenTerms(await pdfText(makeOffer()))).toEqual([]);
  }, TIMEOUT);

  it("žádná nákupní cena z katalogu", async () => {
    const text = await pdfText(makeOffer());
    const leaked = SEED_CATALOG.filter((i) => {
      const v = Math.abs(Math.round(i.price));
      // krátká čísla jako 60 nebo 300 se legitimně potkají s daty a počty
      return v >= 1000 && containsAmount(text, v);
    }).map((i) => `${i.label} = ${i.price}`);
    expect(leaked).toEqual([]);
  }, TIMEOUT);

  it("žádný název položky, která nese značku nebo platformu", async () => {
    const tight = squash(await pdfText(makeOffer()));
    const brandish = SEED_CATALOG.filter((i) =>
      FORBIDDEN_BRANDS.some((b) =>
        normalizeForMatch(`${i.label} ${i.note}`).includes(
          normalizeForMatch(b),
        ),
      ),
    );
    // pojistka, že tenhle test není prázdný: v katalogu značky opravdu jsou
    expect(brandish.map((i) => i.id)).toEqual(
      expect.arrayContaining(["dr_flytbase", "dr_flighthub", "dr_sensors"]),
    );
    for (const i of brandish) {
      expect(tight, `unikl název ${i.label}`).not.toContain(squash(i.label));
    }
  }, TIMEOUT);

  it("žádná vnitřní ekonomika — day0, marže, návratnost, amortizace", async () => {
    const offer = makeOffer();
    const text = await pdfText(offer);
    const r = offer.snapshot.result;
    for (const [name, n] of Object.entries({
      day0: r.day0,
      fullMonthly: r.fullMonthly,
      monthlyCash: r.monthlyCash,
      amortMonthly: r.amortMonthly,
      capexTotal: r.capexTotal,
      startupTotal: r.startupTotal,
      yearlyTotal: r.yearlyTotal,
      flowEnd: r.flowEnd,
    })) {
      expect(containsAmount(text, n), `unikla částka ${name} = ${n}`).toBe(
        false,
      );
    }
    const hay = normalizeForMatch(text);
    expect(hay).not.toContain("49,2");
    expect(hay).not.toContain("15 mes");
  }, TIMEOUT);
});

describe("whitelist částek — silnější než blacklist", () => {
  /** Všechny částky ve tvaru „… Kč", normalizované na holé číslo. */
  function amountsInText(text: string): string[] {
    return Array.from(
      text.replace(/[  ]/g, " ").matchAll(/([\d][\d .,]*?)\s*Kč/g),
    ).map((m) => m[1].replace(/[ .]/g, "").replace(",", ".").trim());
  }

  /** Hodnoty, které generuje šablona — včetně varianty s DPH. */
  function templateAmounts(offer: Offer): Set<string> {
    return new Set(
      [offer.monthlyPrice, offer.setupFee].flatMap((v) => [
        String(Math.round(v)),
        String(Math.round(v * 1.21)),
      ]),
    );
  }

  it("v dokumentu nejsou jiné částky než ty, které tam patří", async () => {
    const offer = makeOffer();
    const found = amountsInText(await pdfText(offer));
    expect(found.length).toBeGreaterThan(0);

    const allowed = templateAmounts(offer);
    const fromFreeText = new Set(
      amountsInText(`${offer.scope} ${offer.note}`),
    );
    expect(
      found.filter((a) => !allowed.has(a) && !fromFreeText.has(a)),
    ).toEqual([]);
  }, TIMEOUT);

  it("částka s DPH ve volném textu whitelist neshodí", async () => {
    // 50 000 × 1,21 = 60 500 a 120 000 × 1,21 = 145 200
    const offer = makeOffer({
      scope: "Měsíční paušál 60 500 Kč včetně DPH. Zahrnuje dohled i servis.",
      note: "Zřizovací poplatek 145 200 Kč včetně DPH.",
    });
    const found = amountsInText(await pdfText(offer));
    const allowed = templateAmounts(offer);
    expect(found.filter((a) => !allowed.has(a))).toEqual([]);
  }, TIMEOUT);
});

describe("testy nejsou slepé — na podvržené nabídce musí spadnout", () => {
  it("značka v rozsahu služby se odhalí", async () => {
    const spatna = makeOffer({
      scope: "Na lokalitě bude nasazen DJI Dock 3 s dronem Mavic 4.",
    });
    expect(findForbiddenTerms(documentStrings(spatna))).toContain("DJI");
    const nalezene = findForbiddenTerms(await pdfText(spatna));
    expect(nalezene).toEqual(
      expect.arrayContaining(["DJI", "Dock", "Mavic"]),
    );
  }, TIMEOUT);

  it("nákupní cena v poznámce se odhalí", async () => {
    const spatna = makeOffer({
      note: "Interně: dokovací stanice nás stojí 268 587 Kč.",
    });
    expect(containsAmount(await pdfText(spatna), 268587)).toBe(true);
  }, TIMEOUT);

  it("interní slovník v poznámce se odhalí", async () => {
    const spatna = makeOffer({ note: "Hrubá marže na této lokalitě je 49 %." });
    expect(findForbiddenTerms(await pdfText(spatna)).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("cizí částka ve whitelistu neprojde", async () => {
    const spatna = makeOffer({
      note: "Amortizace hardwaru vychází na 10 448 Kč.",
    });
    const text = await pdfText(spatna);
    expect(containsAmount(text, 10448)).toBe(true);
  }, TIMEOUT);
});

describe("snímek nákupní ceny obsahuje, dokument ne", () => {
  it("bez tohohle by testy procházely triviálně", async () => {
    const offer = makeOffer();
    const snapshotJson = JSON.stringify(offer.snapshot);

    // ve snímku nákupní ceny a značky opravdu jsou — je to interní záznam
    expect(snapshotJson).toContain("268587");
    expect(snapshotJson).toContain("FlytBase");
    expect(offer.snapshot.result.fullMonthly).toBeGreaterThan(0);
    expect(offer.snapshot.result.margin).toBeGreaterThan(0);

    // v dokumentu, který z něj vznikne, už ne
    const doc = toOfferDocument(offer);
    const keys = Object.keys(doc);
    expect(keys).not.toContain("snapshot");
    expect(keys).not.toContain("catalog");
    expect(keys).not.toContain("margin");
    expect(keys).not.toContain("payback");
    expect(JSON.stringify(doc)).not.toContain("268587");
    expect(JSON.stringify(doc)).not.toContain("FlytBase");

    const text = await pdfText(offer);
    expect(containsAmount(text, 268587)).toBe(false);
    expect(findForbiddenTerms(text)).toEqual([]);
  }, TIMEOUT);
});

describe("kontrola za provozu nad textem, který napsal člověk", () => {
  /**
   * Testy výše pracují s fixturami. Rozsah služby ale píše člověk a do CI se
   * jeho text nikdy nedostane — proto stejná kontrola běží i za provozu,
   * při ukládání nabídky a znovu před tiskem.
   */
  it("čistý text projde bez varování", () => {
    expect(
      checkOfferText({
        scope: defaultScope("both", { cameras: 8, poles: 5, docks: 1 }),
        note: "Cena zahrnuje dopravu i servisní výjezdy.",
      }),
    ).toEqual([]);
  });

  it("modelové označení v rozsahu se pojmenuje, ne jen zakáže", () => {
    const w = checkOfferText({
      scope: "Na lokalitě bude Dock 3 s termokamerou.",
      note: "",
    });
    expect(w).toHaveLength(1);
    expect(w[0].field).toBe("scope");
    expect(w[0].fieldLabel).toBe("Rozsah služby");
    expect(w[0].terms).toContain("Dock");
    expect(describeOfferWarnings(w)).toBe("Rozsah služby: Dock");
  });

  it("najde nález v obou polích zvlášť", () => {
    const w = checkOfferText({
      scope: "Nasazení Mavic 4 nad areálem.",
      note: "Interně: hrubá marže vychází dobře.",
    });
    expect(w.map((x) => x.field)).toEqual(["scope", "note"]);
    expect(w[0].terms).toEqual(expect.arrayContaining(["Mavic", "Mavic 4"]));
    expect(w[1].terms.length).toBeGreaterThan(0);
  });

  it("varování zná i výrazy doplněné do seznamu později", () => {
    // přesně ty, které jsme doplnili po revizi seznamu
    for (const term of ["M4TD", "M4D", "Autel", "Skydio"]) {
      const w = checkOfferText({ scope: `Použijeme ${term} nad areálem.`, note: "" });
      expect(w[0]?.terms, `${term} neodhaleno`).toContain(term);
    }
  });

  it("Starlink varování nespustí — je to konektivita, ne tajená značka", () => {
    expect(
      checkOfferText({
        scope: "Připojení lokality přes satelitní internet Starlink.",
        note: "",
      }),
    ).toEqual([]);
  });

  it("prázdná pole nic nerozbijí", () => {
    expect(checkOfferText({ scope: "", note: "" })).toEqual([]);
  });
});
