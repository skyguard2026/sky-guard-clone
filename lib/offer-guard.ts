/**
 * Kontrola textu, který do nabídky napsal člověk.
 *
 * Typ `OfferDocumentData` chrání strukturu dokumentu — nákladová pole v něm
 * neexistují, takže je nejde vytisknout. Obsah, který do volných polí vloží
 * uživatel, ale žádný typ neuhlídá. Rozsah služby je přesně to místo, kam
 * někdo napíše modelové označení, protože ho tak zná z technické dokumentace.
 *
 * Test v CI pracuje s fixturami a o takovém textu se nikdy nedozví. Proto se
 * stejná kontrola pouští za provozu: při ukládání nabídky a znovu těsně před
 * generováním PDF.
 *
 * Není to tvrdé odmítnutí. Kdyby bylo, lidi ho začnou obcházet mezerami
 * uprostřed slova a kontrola přestane platit úplně. Je to varování, které
 * nález pojmenuje a nechá pokračovat vědomě.
 */
import { findForbiddenTerms } from "./pdf/forbidden-terms";

export type OfferTextField = "scope" | "note";

export interface OfferTextWarning {
  field: OfferTextField;
  fieldLabel: string;
  terms: string[];
}

const FIELD_LABEL: Record<OfferTextField, string> = {
  scope: "Rozsah služby",
  note: "Poznámka pro klienta",
};

/** Projde volná pole nabídky a vrátí, co v nich nemá co dělat. */
export function checkOfferText(input: {
  scope: string;
  note: string;
}): OfferTextWarning[] {
  const warnings: OfferTextWarning[] = [];
  for (const field of ["scope", "note"] as OfferTextField[]) {
    const terms = findForbiddenTerms(input[field] ?? "");
    if (terms.length) {
      warnings.push({ field, fieldLabel: FIELD_LABEL[field], terms });
    }
  }
  return warnings;
}

/** Věta pro uživatele. Nález pojmenuje, ať ví, co má opravit. */
export function describeOfferWarnings(warnings: OfferTextWarning[]): string {
  return warnings
    .map((w) => `${w.fieldLabel}: ${w.terms.join(", ")}`)
    .join(" · ");
}
