import { PageHeader } from "@/components/PageHeader";
import { SettingsClient } from "@/components/SettingsClient";
import { getPortfolio } from "@/lib/data";

export default async function NastaveniPage() {
  const { settings } = await getPortfolio();
  return (
    <>
      <PageHeader title="Nastavení" crumb="parametry modelu a data" />
      <div className="page">
        <SettingsClient settings={settings} />
      </div>
    </>
  );
}
