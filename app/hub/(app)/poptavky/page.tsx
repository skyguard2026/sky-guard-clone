import { InquiriesClient } from "@/components/InquiriesClient";
import { PageHeader } from "@/components/PageHeader";
import { getInquiries } from "@/lib/data";
import type { Inquiry } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

export default async function PoptavkyPage() {
  // Migrace se pouštějí ručně (README → Nasazení). Než doběhne, tabulka
  // chybí — stránka to řekne místo toho, aby spadla.
  let inquiries: Inquiry[] | null = null;
  let missingTable = false;
  try {
    inquiries = await getInquiries();
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    missingTable = cause?.code === "42P01" || cause?.cause?.code === "42P01";
    inquiries = null;
  }

  return (
    <>
      <PageHeader
        title="Poptávky z webu"
        crumb="co přišlo z kontaktního formuláře na sky-guard.cz"
      />
      <div className="page">
        {inquiries ? (
          <InquiriesClient inquiries={inquiries} />
        ) : (
          <div className="card">
            <div className="empty">
              <b>
                {missingTable
                  ? "Poptávky čekají na aktivaci"
                  : "Poptávky se nepodařilo načíst"}
              </b>
              <p>
                {missingTable
                  ? "Správce musí dokončit nastavení databáze. Zájemci zatím mohou využít přímý kontakt na webu."
                  : "Databáze teď není dostupná. Zkuste stránku načíst znovu za chvíli."}
              </p>
              <a className="btn" href="/hub/poptavky">
                Zkusit znovu
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
