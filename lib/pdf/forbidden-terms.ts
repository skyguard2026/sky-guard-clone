/**
 * Co se nesmí objevit v dokumentu, který jde klientovi.
 *
 * Seznam je schválně samostatný soubor, aby se dal doplňovat bez sahání do
 * šablony i testu. Když přibude nový dodavatel nebo model, přidej ho sem —
 * test v CI ho začne hlídat okamžitě.
 *
 * Porovnává se bez ohledu na velikost písmen a diakritiku, na hranicích slov.
 */

/** Značky a modelová označení výrobců dronů, kamer a čidel. */
export const FORBIDDEN_BRANDS: string[] = [
  // výrobci dronů a jejich modelové řady
  "DJI",
  "Dock",
  "Mavic",
  "Mavic 4",
  "M4TD",
  "M4D",
  "M3TD",
  "Matrice",
  "Phantom",
  "Inspire",
  "Autel",
  "EVO",
  "Skydio",
  "Parrot",
  "Anafi",
  "Percepto",
  "Airobotics",
  // platformy a software
  "FlytBase",
  "FlightHub",
  "DronPro",
  "DroneDeploy",
  // kamery a perimetrická čidla
  "Hikvision",
  "Dahua",
  "Axis Communications",
  "Reolink",
  "Uniview",
  "Ubiquiti",
  "UniFi",
  "Jablotron",
  "OPTEX",
  "LoRaWAN",
  "Ajax",
  // ostatní dodavatelé a služby, které klientovi neříkáme
  "CZEPOS",
  "Trimble",
];

/**
 * Interní slovník kalkulace. Tahle slova nemají v nabídce co dělat, i kdyby
 * je tam někdo napsal ručně do rozsahu služby — signalizují, že se do
 * dokumentu dostala vnitřní ekonomika.
 */
export const FORBIDDEN_INTERNAL: string[] = [
  "marže",
  "marze",
  "návratnost",
  "navratnost",
  "amortizace",
  "nákupní cena",
  "nakupni cena",
  "nákladová položka",
  "capex",
  "cenová podlaha",
  "cenova podlaha",
  "plný měsíční náklad",
  "plny mesicni naklad",
  "kumulativní hotovost",
  "hrubá marže",
  "dealer",
  "sleva dealera",
];

export const FORBIDDEN_TERMS: string[] = [
  ...FORBIDDEN_BRANDS,
  ...FORBIDDEN_INTERNAL,
];

/** Malá písmena, bez diakritiky, sjednocené mezery. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Vrátí zakázané výrazy nalezené v textu. */
export function findForbiddenTerms(
  text: string,
  terms: string[] = FORBIDDEN_TERMS,
): string[] {
  const hay = normalizeForMatch(text);
  // PDF s prostrkanými písmeny vrací „D J I" místo „DJI", proto se stejná
  // kontrola pouští ještě jednou nad textem bez mezer. U krátkých výrazů
  // by to falešně chytalo („evo" v „je vodní"), takže jen u dost dlouhých.
  const squashed = hay.replace(/\s+/g, "");

  return terms.filter((term) => {
    const needle = normalizeForMatch(term);
    // hranice slova, ať "dock" nechytá "dokovací" a "evo" nechytá "evoluce"
    const re = new RegExp(`(^|[^0-9a-z])${escapeRegExp(needle)}([^0-9a-z]|$)`);
    if (re.test(hay)) return true;

    const tight = needle.replace(/\s+/g, "");
    return tight.length >= 6 && squashed.includes(tight);
  });
}

/** Číslo v textu, ohraničené tak, aby 20000 nechytalo uvnitř 120000. */
export function containsAmount(text: string, value: number): boolean {
  const digits = String(Math.abs(Math.round(value)));
  // mezery a tečky uvnitř čísel pryč, ať „120 000" je „120000"
  const hay = normalizeForMatch(text)
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/(?<=\d)[ .](?=\d)/g, "");
  return new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(hay);
}
