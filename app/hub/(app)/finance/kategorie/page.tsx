import { CategoriesClient } from "@/components/CategoriesClient";
import { PageHeader } from "@/components/PageHeader";
import { getFinanceMeta, getTransactions } from "@/lib/data";

export default async function KategoriePage() {
  const [{ categories, rules }, transactions] = await Promise.all([
    getFinanceMeta(),
    getTransactions(),
  ]);
  return (
    <>
      <PageHeader
        title="Kategorie a pravidla"
        crumb="podle čeho se transakce zařazují"
      />
      <div className="page">
        <CategoriesClient
          categories={categories}
          rules={rules}
          transactions={transactions}
        />
      </div>
    </>
  );
}
