import Link from "next/link";
import { CalcClient } from "@/components/CalcClient";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { getActiveLocationId } from "@/lib/active-location";
import { getOffersForLocation, getPortfolio } from "@/lib/data";
import { hub } from "@/lib/hub-path";

export default async function KalkulacePage() {
  const { locations, catalog, settings } = await getPortfolio();
  const activeId = await getActiveLocationId(locations);
  const loc = locations.find((l) => l.id === activeId) ?? null;
  const offers = loc ? await getOffersForLocation(loc.id) : [];

  return (
    <>
      <PageHeader
        title="Kalkulace"
        crumb="náklady a cena jedné lokality"
        actions={<PrintButton />}
      />
      <div className="page">
        {loc ? (
          <CalcClient
            key={loc.id}
            location={loc}
            catalog={catalog}
            settings={settings}
            locationCount={locations.length}
            offers={offers}
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
