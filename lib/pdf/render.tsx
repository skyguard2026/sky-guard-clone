import { renderToBuffer } from "@react-pdf/renderer";
import type { OfferDocumentData } from "../offer-types";
import { OfferDocument } from "./offer-document";

/** Vyrenderuje nabídku do PDF. Běží na serveru, v Node runtime. */
export async function renderOfferPdf(
  data: OfferDocumentData,
): Promise<Buffer> {
  return renderToBuffer(<OfferDocument data={data} />);
}

/** Název souboru ke stažení. */
export function offerFileName(number: string, version: number): string {
  const v = version > 1 ? `-v${version}` : "";
  return `sky-guard-nabidka-${number}${v}.pdf`;
}
