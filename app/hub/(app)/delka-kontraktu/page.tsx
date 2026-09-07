import Link from "next/link";
import { ContractLengthClient } from "@/components/ContractLengthClient";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { getActiveLocationId } from "@/lib/active-location";
import { getPortfolio } from "@/lib/data";
import { hub } from "@/lib/hub-path";

export default async function DelkaKontraktuPage() {
  const { locations, catalog, settings } = await getPortfolio();
  const activeId = await getActiveLocationId(locations);
  const loc = locations.find((l) => l.id === activeId) ?? null;

  return (
    <>
      <PageHeader
        title="Délka kontraktu"
        crumb="kde se vyplatí kontrakt uzavřít"
        actions={<PrintButton />}
      />
      <div className="page">
        {loc ? (
          <ContractLengthClient
            key={loc.id}
            location={loc}
            catalog={catalog}
            settings={settings}
            locationCount={locations.length}
          />
        ) : (
          <div className="card">
            <div className="empty">
              <b>Zatím žádná lokalita</b>
              Založ klienta a lokalitu v sekci{" "}
              <Link href={hub("/klienti")} style={{ color: "var(--blue)" }}>
                Klienti a lokality
              </Link>
              .
            </div>
          </div>
        )}
      </div>
    </>
  );
}
