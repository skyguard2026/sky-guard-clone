import { FinanceOverviewClient } from "@/components/FinanceOverviewClient";
import { PageHeader } from "@/components/PageHeader";
import { PrintButton } from "@/components/PrintButton";
import { getFinanceMeta, getTransactions } from "@/lib/data";

export default async function FinancePage() {
  const [{ categories }, transactions] = await Promise.all([
    getFinanceMeta(),
    getTransactions(),
  ]);
  return (
    <>
      <PageHeader
        title="Finance"
        crumb="skutečné výdaje z bankovního výpisu"
        actions={<PrintButton />}
      />
      <div className="page">
        <FinanceOverviewClient
          transactions={transactions}
          categories={categories}
        />
      </div>
    </>
  );
}
