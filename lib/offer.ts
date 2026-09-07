/**
 * Nabídka — čisté funkce bez databáze.
 *
 * `buildSnapshot` zmrazí stav v okamžiku vzniku, `toOfferDocument` z něj
 * vybere to málo, co smí vidět klient. Mezi tím je záměrná zúžená hranice:
 * dokument nedostane katalog ani snímek, takže nákupní ceny do PDF nemá
 * jak proniknout.
 */
import { calc } from "./calc";
import type {
  Offer,
  OfferDocumentData,
  OfferSnapshot,
  OfferSnapshotResult,
} from "./offer-types";
import type {
  CalcLocation,
  CatalogItem,
  Product,
  Settings,
} from "./types";

export function buildSnapshot(args: {
  clientName: string;
  locationName: string;
  location: CalcLocation & { commitmentMonths: number };
  catalog: CatalogItem[];
  settings: Settings;
  locationCount: number;
  takenAt: Date;
}): OfferSnapshot {
  const r = calc(
    args.location,
    args.catalog,
    args.settings,
    args.locationCount,
  );
  const result: OfferSnapshotResult = {
    day0: r.day0,
    capexTotal: r.capexTotal,
    startupTotal: r.startupTotal,
    yearlyTotal: r.yearlyTotal,
    monthlyTotal: r.monthlyTotal,
    preTotal: r.preTotal,
    accTotal: r.accTotal,
    amortMonthly: r.amortMonthly,
    monthlyCash: r.monthlyCash,
    fullMonthly: r.fullMonthly,
    profit: r.profit,
    margin: r.margin,
    payback: r.payback,
    horizon: r.horizon,
    flowStart: r.flow[0],
    flowEnd: r.flow[r.horizon],
  };
  return {
    takenAt: args.takenAt.toISOString(),
    clientName: args.clientName,
    locationName: args.locationName,
    // hluboká kopie, ať pozdější mutace objektu snímkem nehnou
    location: JSON.parse(JSON.stringify(args.location)),
    settings: { ...args.settings },
    locationCount: args.locationCount,
    catalog: JSON.parse(JSON.stringify(args.catalog)),
    result,
  };
}

/** Přepočet ze snímku. Musí dát stejná čísla jako v okamžiku vzniku. */
export function recalcFromSnapshot(s: OfferSnapshot) {
  return calc(s.location, s.catalog, s.settings, s.locationCount);
}

const dateCs = (iso: string) =>
  new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

/**
 * Převod na to, co jde do PDF.
 *
 * Bere jen pole nabídky, nikdy snímek. Kdyby sem někdo chtěl přidat marži
 * nebo cenu položky, musel by nejdřív rozšířit `OfferDocumentData` — a to je
 * krok, který je vidět v code review.
 */
export function toOfferDocument(offer: Offer): OfferDocumentData {
  return {
    number: offer.number,
    version: offer.version,
    createdAt: dateCs(offer.createdAt),
    validUntil: dateCs(offer.validUntil),
    clientName: offer.snapshot.clientName,
    locationName: offer.snapshot.locationName,
    product: offer.snapshot.location.product,
    scope: offer.scope,
    monthlyPrice: offer.monthlyPrice,
    setupFee: offer.setupFee,
    commitmentMonths: offer.commitmentMonths,
    note: offer.note,
  };
}

/** Číslo nabídky ve tvaru 2026-001. */
export function formatOfferNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(3, "0")}`;
}

/**
 * Předvyplněný rozsah služby. Pojmenovává hardware obecně — značky ani
 * modelová označení výrobce se do klientského výstupu nedostanou.
 */
export function defaultScope(
  product: Product,
  cfg: {
    cameras: number;
    poles: number;
    docks: number;
    camerasTlBig?: number;
    camerasTlSmall?: number;
  },
): string {
  const parts: string[] = [];

  if (product === "cam" || product === "both") {
    // Klientovi se uvádí počet kamer celkem, ne rozpad podle typu.
    const ks =
      (cfg.cameras || 0) +
      (cfg.camerasTlBig || 0) +
      (cfg.camerasTlSmall || 0);
    const sl = cfg.poles || 0;
    parts.push(
      `Nepřetržitý kamerový dohled lokality — ${ks} ${sklon(ks, "kamera", "kamery", "kamer")}` +
        (sl > 0
          ? ` na ${sl} ${sklon(sl, "nosném sloupu", "nosných sloupech", "nosných sloupech")}`
          : "") +
        ". Přenos a záznam obrazu do zabezpečeného úložiště, vzdálený přístup k živému obrazu i k záznamům.",
    );
  }

  if (product === "drone" || product === "both") {
    const d = cfg.docks || 0;
    parts.push(
      `Autonomní vzdušný dohled lokality — ${d} ${sklon(d, "dokovací stanice", "dokovací stanice", "dokovacích stanic")} s automatickým startem. ` +
        "Plánované i vyžádané oblety, přenos obrazu v reálném čase, vyhodnocení pohybu v areálu.",
    );
  }

  parts.push(
    "V ceně je instalace, uvedení do provozu, servis a technická podpora po celou dobu trvání smlouvy.",
  );

  return parts.join("\n\n");
}

function sklon(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
