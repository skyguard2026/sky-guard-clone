import { OverviewClient } from "@/components/OverviewClient";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { getPortfolio } from "@/lib/data";

export default async function PrehledPage() {
  const { catalog, locations, settings, clients } = await getPortfolio();
  return (
    <>
      <PageHeader
        title="Přehled"
        crumb="portfolio a ceník obou produktů"
        actions={<PrintButton />}
      />
      <div className="page">
        <OverviewClient
          catalog={catalog}
          locations={locations}
          settings={settings}
          clientCount={clients.length}
        />
      </div>
    </>
  );
}
