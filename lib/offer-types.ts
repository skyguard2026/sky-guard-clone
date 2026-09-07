/**
 * Typy nabídky.
 *
 * Klíčové rozdělení: `OfferSnapshot` je interní záznam a obsahuje nákupní ceny
 * celého katalogu. `OfferDocumentData` je to, co se tiskne klientovi, a
 * nákladová pole v něm vůbec neexistují — únik interních dat do PDF tak není
 * otázka pozornosti při psaní šablony, ale typu.
 */
import type {
  CalcLocation,
  CatalogItem,
  Product,
  Settings,
} from "./types";

export type OfferStatus = "draft" | "odeslana" | "prijata" | "odmitnuta";

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "Rozpracovaná",
  odeslana: "Odeslaná",
  prijata: "Přijatá",
  odmitnuta: "Odmítnutá",
};

/** Výsledek výpočtu zamrazený v okamžiku vzniku nabídky. */
export interface OfferSnapshotResult {
  day0: number;
  capexTotal: number;
  startupTotal: number;
  yearlyTotal: number;
  monthlyTotal: number;
  preTotal: number;
  accTotal: number;
  amortMonthly: number;
  monthlyCash: number;
  fullMonthly: number;
  profit: number;
  margin: number;
  payback: number | null;
  horizon: number;
  flowStart: number;
  flowEnd: number;
}

/** Interní snímek. Nikdy nesmí projít do klientského dokumentu. */
export interface OfferSnapshot {
  takenAt: string;
  clientName: string;
  locationName: string;
  location: CalcLocation & { commitmentMonths: number };
  settings: Settings;
  locationCount: number;
  catalog: CatalogItem[];
  result: OfferSnapshotResult;
}

/**
 * Jediné, co dostane PDF šablona.
 *
 * Schválně tu nejsou žádné náklady, ceny katalogu, marže ani návratnost —
 * co v typu není, nejde vytisknout.
 */
export interface OfferDocumentData {
  number: string;
  version: number;
  createdAt: string;
  validUntil: string;
  clientName: string;
  locationName: string;
  product: Product;
  scope: string;
  monthlyPrice: number;
  setupFee: number;
  commitmentMonths: number;
  note: string;
}

export interface Offer {
  id: string;
  locationId: string;
  number: string;
  version: number;
  status: OfferStatus;
  createdAt: string;
  validUntil: string;
  monthlyPrice: number;
  setupFee: number;
  commitmentMonths: number;
  scope: string;
  note: string;
  snapshot: OfferSnapshot;
}
