import { ClientsClient } from "@/components/ClientsClient";
import { PageHeader } from "@/components/PageHeader";
import { getPortfolio } from "@/lib/data";

export default async function KlientiPage() {
  const { clients, catalog, settings, locations } = await getPortfolio();
  return (
    <>
      <PageHeader title="Klienti a lokality" crumb="správa portfolia" />
      <div className="page">
        <ClientsClient
          clients={clients}
          catalog={catalog}
          settings={settings}
          locationCount={locations.length}
        />
      </div>
    </>
  );
}
