import { CompareClient } from "@/components/CompareClient";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { getPortfolio } from "@/lib/data";

export default async function SrovnaniPage() {
  const { locations, catalog, settings } = await getPortfolio();
  return (
    <>
      <PageHeader
        title="Srovnání lokalit"
        crumb="všechny lokality vedle sebe"
        actions={<PrintButton />}
      />
      <div className="page">
        <CompareClient
          locations={locations}
          catalog={catalog}
          settings={settings}
        />
      </div>
    </>
  );
}
