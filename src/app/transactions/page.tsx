import Link from "next/link";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { latestAuditByEntity } from "@/lib/audit";
import { deleteTransaction } from "./actions";

export default async function TransactionsPage() {
  const { household } = await requireHousehold();

  const transactions = await prisma.transaction.findMany({
    where: { householdId: household.id },
    orderBy: { transactionDate: "desc" },
    take: 100,
    include: { account: true, bucket: true },
  });

  const lastEdited = await latestAuditByEntity(
    "Transaction",
    transactions.map((t) => t.id)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <Link
          href="/transactions/new"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          + Add transaction
        </Link>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="py-2">Date</th>
            <th className="py-2">Description</th>
            <th className="py-2">Account</th>
            <th className="py-2">Bucket</th>
            <th className="py-2 text-right">Amount</th>
            <th className="py-2">Last edited</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const edited = lastEdited.get(tx.id);
            return (
              <tr key={tx.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 whitespace-nowrap">
                  {tx.transactionDate.toISOString().slice(0, 10)}
                </td>
                <td className="py-2">{tx.description ?? tx.merchantNameRaw ?? "—"}</td>
                <td className="py-2 text-zinc-500 dark:text-zinc-400">
                  {tx.account?.name ?? "—"}
                </td>
                <td className="py-2 text-zinc-500 dark:text-zinc-400">
                  {tx.bucket?.name ?? "—"}
                </td>
                <td
                  className={`py-2 text-right ${tx.amountCents < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                >
                  {formatCents(tx.amountCents)}
                </td>
                <td className="py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {edited ? `${edited.actorName}` : "—"}
                </td>
                <td className="py-2 text-right">
                  <form action={deleteTransaction}>
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <button type="submit" className="text-red-600 underline dark:text-red-400">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
