import Link from "next/link";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { latestAuditByEntity } from "@/lib/audit";
import { addMonths, monthInputValue, parseMonthParam } from "@/lib/dates";
import { deleteTransaction, updateTransactionBucket } from "./actions";
import type { Prisma } from "@/generated/prisma/client";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; bucketId?: string; month?: string }>;
}) {
  const { household } = await requireHousehold();
  const { bucket: bucketFilter, bucketId, month: monthParam } = await searchParams;

  const isUnclassifiedFilter = bucketFilter === "unclassified";
  const month = monthParam ? parseMonthParam(monthParam) : null;

  const where: Prisma.TransactionWhereInput = { householdId: household.id };
  if (isUnclassifiedFilter) {
    where.bucketId = null;
  } else if (bucketId) {
    where.bucketId = bucketId;
  }
  if (month) {
    where.transactionDate = { gte: month, lt: addMonths(month, 1) };
  }

  const [transactions, buckets, drillDownBucket] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      take: 100,
      include: { account: true, bucket: true },
    }),
    prisma.bucket.findMany({
      where: { householdId: household.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    bucketId
      ? prisma.bucket.findFirst({ where: { id: bucketId, householdId: household.id } })
      : null,
  ]);

  const lastEdited = await latestAuditByEntity(
    "Transaction",
    transactions.map((t) => t.id)
  );

  const lastCheckIn = household.lastCheckInCompletedAt;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <div className="flex items-center gap-3">
          <Link href="/transactions/import" className="text-sm underline">
            + Import CSV
          </Link>
          <Link
            href="/transactions/new"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            + Add transaction
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/transactions?bucket=unclassified"
          className={`rounded-full px-3 py-1 ${isUnclassifiedFilter ? "bg-foreground text-background" : "underline"}`}
        >
          Needs a bucket
        </Link>
        {drillDownBucket && (
          <span className="text-zinc-500 dark:text-zinc-400">
            Viewing: <strong className="text-foreground">{drillDownBucket.name}</strong>
            {month && ` — ${monthInputValue(month)}`}
          </span>
        )}
        {(isUnclassifiedFilter || bucketId) && (
          <Link href="/transactions" className="underline">
            Clear filter
          </Link>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="py-2 pr-3 pl-0">Date</th>
            <th className="py-2 px-3">Description</th>
            <th className="py-2 px-3">Account</th>
            <th className="py-2 px-3">Bucket</th>
            <th className="py-2 px-3 text-right">Amount</th>
            <th className="py-2 px-3">Last edited</th>
            <th className="py-2 pl-3 pr-0" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const edited = lastEdited.get(tx.id);
            const isNew = !lastCheckIn || tx.createdAt > lastCheckIn;
            return (
              <tr key={tx.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-3 pl-0 whitespace-nowrap">
                  {tx.transactionDate.toISOString().slice(0, 10)}
                  {isNew && (
                    <span className="ml-2 rounded-full bg-blue-600/10 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
                      New
                    </span>
                  )}
                </td>
                <td className="py-2 px-3">{tx.description ?? tx.merchantNameRaw ?? "—"}</td>
                <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400">
                  {tx.account?.name ?? "—"}
                </td>
                <td className="py-2 px-3">
                  <form action={updateTransactionBucket} className="flex items-center gap-1">
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <select
                      key={tx.bucketId ?? "none"}
                      name="bucketId"
                      defaultValue={tx.bucketId ?? ""}
                      className="rounded border border-black/10 bg-transparent px-1 py-0.5 text-xs dark:border-white/20"
                    >
                      <option value="">— uncategorized —</option>
                      {buckets.map((bucket) => (
                        <option key={bucket.id} value={bucket.id}>
                          {bucket.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs underline">
                      Set
                    </button>
                  </form>
                </td>
                <td
                  className={`py-2 px-3 text-right ${tx.amountCents < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                >
                  {formatCents(tx.amountCents)}
                </td>
                <td className="py-2 px-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {edited ? `${edited.actorName}` : "—"}
                </td>
                <td className="py-2 pl-3 pr-0 text-right whitespace-nowrap">
                  <Link href={`/transactions/${tx.id}/edit`} className="underline">
                    Edit
                  </Link>
                  <form action={deleteTransaction} className="inline">
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <button
                      type="submit"
                      className="ml-3 text-red-600 underline dark:text-red-400"
                    >
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
