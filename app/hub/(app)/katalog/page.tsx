import { CatalogClient } from "@/components/CatalogClient";
import { PageHeader } from "@/components/PageHeader";
import { getPortfolio } from "@/lib/data";

export default async function KatalogPage() {
  const { catalog } = await getPortfolio();
  return (
    <>
      <PageHeader
        title="Katalog nákladů"
        crumb="přidání, úprava a mazání položek"
      />
      <div className="page">
        <CatalogClient catalog={catalog} />
      </div>
    </>
  );
}
