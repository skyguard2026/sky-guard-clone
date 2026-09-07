import { InquiriesClient } from "@/components/InquiriesClient";
import { PageHeader } from "@/components/PageHeader";
import { getInquiries } from "@/lib/data";
import type { Inquiry } from "@/lib/inquiries";

export const dynamic = "force-dynamic";

export default async function PoptavkyPage() {
  // Migrace se pouštějí ručně (README → Nasazení). Než doběhne, tabulka
  // chybí — stránka to řekne místo toho, aby spadla.
  let inquiries: Inquiry[] | null = null;
  try {
    inquiries = await getInquiries();
  } catch {
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
              <b>Tabulka poptávek v databázi ještě není</b>
              Spusť migraci <code>npm run db:migrate</code> proti této databázi
              (postup v README, část Nasazení). Do té doby formulář na webu
              nabídne přímý kontakt místo odeslání.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
