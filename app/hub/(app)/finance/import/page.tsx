import { ImportClient } from "@/components/ImportClient";
import { PageHeader } from "@/components/PageHeader";
import { getFinanceMeta } from "@/lib/data";

export default async function ImportPage() {
  const { imports } = await getFinanceMeta();
  return (
    <>
      <PageHeader
        title="Nahrání výpisu"
        crumb="výpis z internetového bankovnictví"
      />
      <div className="page">
        <ImportClient imports={imports} />
      </div>
    </>
  );
}
