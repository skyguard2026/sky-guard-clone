"use server";

import { withUser } from "@/lib/auth/guards";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createOffer,
  deleteDraftOffer,
  getOffer,
  setOfferStatus,
} from "@/lib/db/offer-ops";
import { toOfferDocument } from "@/lib/offer";
import {
  checkOfferText,
  describeOfferWarnings,
  type OfferTextWarning,
} from "@/lib/offer-guard";
import type { OfferStatus } from "@/lib/offer-types";
import { offerFileName, renderOfferPdf } from "@/lib/pdf/render";
import { HUB } from "@/lib/hub-path";

export interface NewOfferInput {
  locationId: string;
  scope: string;
  note: string;
  commitmentMonths: number;
  /** ISO datum platnosti. */
  validUntil: string;
  /** Vyplněné u nové verze existující nabídky. */
  baseNumber?: string;
  /**
   * Uživatel viděl varování o zakázaných výrazech a vědomě pokračuje.
   * Bez tohohle se nabídka s takovým textem neuloží napoprvé.
   */
  acknowledgeWarnings?: boolean;
}

/**
 * Založí nabídku. Ekonomiku bere vždy z aktuálního stavu lokality a katalogu,
 * i když jde o novou verzi — jinak by vznikla nabídka se starými čísly
 * a novým datem.
 */
async function createOfferAction__impl(input: NewOfferInput) {
  const valid = new Date(input.validUntil);
  if (Number.isNaN(valid.getTime())) {
    return { ok: false as const, error: "Neplatné datum platnosti." };
  }
  if (!input.scope.trim()) {
    return { ok: false as const, error: "Vyplň rozsah služby." };
  }

  // Poslední článek: strukturu dokumentu hlídá typ, tenhle text ale napsal
  // člověk a do CI se nikdy nedostane.
  const warnings = checkOfferText({ scope: input.scope, note: input.note });
  if (warnings.length && !input.acknowledgeWarnings) {
    return {
      ok: false as const,
      warnings,
      error: `V textu je značka nebo interní výraz — ${describeOfferWarnings(warnings)}. Nabídka jde klientovi, tak to radši přepiš obecně.`,
    };
  }

  const res = await createOffer(
    db,
    {
      locationId: input.locationId,
      scope: input.scope,
      note: input.note,
      commitmentMonths: input.commitmentMonths,
      validUntil: valid,
      baseNumber: input.baseNumber,
    },
    new Date(),
  );
  if (!res.ok) return res;

  revalidatePath(HUB, "layout");
  return {
    ok: true as const,
    number: res.offer.number,
    version: res.offer.version,
  };
}

async function setOfferStatusAction__impl(id: string, status: OfferStatus) {
  if (!["draft", "odeslana", "prijata", "odmitnuta"].includes(status)) {
    return { ok: false as const, error: "Neznámý stav." };
  }
  await setOfferStatus(db, id, status);
  revalidatePath(HUB, "layout");
  return { ok: true as const };
}

async function deleteOfferAction__impl(id: string) {
  const res = await deleteDraftOffer(db, id);
  if (res.ok) revalidatePath(HUB, "layout");
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error ?? "Nepodařilo se smazat." };
}

/**
 * Vygeneruje PDF a vrátí ho jako base64.
 *
 * Do generátoru jde `toOfferDocument`, ne celá nabídka — snímek s nákupními
 * cenami se k šabloně vůbec nedostane.
 */
async function renderOfferPdfAction__impl(
  id: string,
  acknowledgeWarnings = false,
) {
  const offer = await getOffer(db, id);
  if (!offer) return { ok: false as const, error: "Nabídka neexistuje." };

  // Znovu, těsně před tiskem. Nabídka mohla vzniknout dřív, než se seznam
  // zakázaných výrazů doplnil o nový model.
  const warnings: OfferTextWarning[] = checkOfferText({
    scope: offer.scope,
    note: offer.note,
  });
  if (warnings.length && !acknowledgeWarnings) {
    return {
      ok: false as const,
      warnings,
      error: `V nabídce ${offer.number} je značka nebo interní výraz — ${describeOfferWarnings(warnings)}.`,
    };
  }

  const buf = await renderOfferPdf(toOfferDocument(offer));
  return {
    ok: true as const,
    fileName: offerFileName(offer.number, offer.version),
    base64: buf.toString("base64"),
  };
}

/* --- stráže -------------------------------------------------------- */
/* Každá akce prochází obálkou, která ověří přihlášení a roli. Test
   tests/auth-guards.test.ts to vynucuje strukturálně. */

export const createOfferAction = withUser(
  (_user, ...args: Parameters<typeof createOfferAction__impl>) => createOfferAction__impl(...args),
);
export const setOfferStatusAction = withUser(
  (_user, ...args: Parameters<typeof setOfferStatusAction__impl>) => setOfferStatusAction__impl(...args),
);
export const deleteOfferAction = withUser(
  (_user, ...args: Parameters<typeof deleteOfferAction__impl>) => deleteOfferAction__impl(...args),
);
export const renderOfferPdfAction = withUser(
  (_user, ...args: Parameters<typeof renderOfferPdfAction__impl>) => renderOfferPdfAction__impl(...args),
);
