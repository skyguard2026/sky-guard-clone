import { PageHeader } from "@/components/PageHeader";
import { TransactionsClient } from "@/components/TransactionsClient";
import { getFinanceMeta, getTransactions } from "@/lib/data";

export default async function TransakcePage() {
  const [{ categories }, transactions] = await Promise.all([
    getFinanceMeta(),
    getTransactions(),
  ]);
  return (
    <>
      <PageHeader title="Transakce" crumb="pohyby na účtu a jejich zařazení" />
      <div className="page">
        <TransactionsClient
          transactions={transactions}
          categories={categories}
        />
      </div>
    </>
  );
}
