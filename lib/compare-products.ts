/**
 * Srovnání ekonomiky téže lokality jako Sky Cam, Sky Guard a kombinace.
 *
 * Jen náhled pro rozhodnutí, co klientovi nabídnout — nic se neukládá
 * a vstupní lokalita se nemění.
 */
import { calc, type CalcResult } from "./calc";
import type { CalcLocation, CatalogItem, Product, Settings } from "./types";

export interface ProductComparison {
  product: Product;
  label: string;
  /** Varianta, která je na lokalitě právě nastavená. */
  current: boolean;
  result: CalcResult;
  /** Proč varianta v tomhle nastavení nedává smysl, nebo null. */
  warning: string | null;
}

const LABEL: Record<Product, string> = {
  cam: "Sky Cam",
  drone: "Sky Guard",
  both: "Kombinace",
};

export function compareProducts(
  loc: CalcLocation,
  catalog: CatalogItem[],
  settings: Settings,
  locationCount: number,
): ProductComparison[] {
  return (["cam", "drone", "both"] as Product[]).map((product) => {
    const result = calc({ ...loc, product }, catalog, settings, locationCount);

    // Varianta se počítá vždy, ale když jsou vstupy nulové, řekneme to
    // rovnou — prázdný sloupec by vypadal jako levná varianta.
    let warning: string | null = null;
    const potrebujeKamery = product === "cam" || product === "both";
    const potrebujeStanice = product === "drone" || product === "both";
    if (potrebujeKamery && !loc.cameras) {
      warning = "Nastaveno nula kamer, varianta je proto nesrovnatelně levná.";
    } else if (potrebujeStanice && !loc.docks) {
      warning = "Nastaveno nula stanic, varianta je proto nesrovnatelně levná.";
    }

    return {
      product,
      label: LABEL[product],
      current: loc.product === product,
      result,
      warning,
    };
  });
}
