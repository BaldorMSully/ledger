import { notFound } from "next/navigation";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { centsToDollarsString } from "@/lib/money";
import { editTransaction } from "../../actions";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { household } = await requireHousehold();
  const { id } = await params;

  const [transaction, accounts, buckets] = await Promise.all([
    prisma.transaction.findFirst({ where: { id, householdId: household.id } }),
    prisma.financialAccount.findMany({
      where: { householdId: household.id, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.bucket.findMany({
      where: { householdId: household.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!transaction) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Edit transaction</h1>

      <form action={editTransaction} className="flex max-w-md flex-col gap-4">
        <input type="hidden" name="transactionId" value={transaction.id} />

        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="transactionType"
            defaultValue={transaction.transactionType}
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          >
            <option value="spend">Spend</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Amount ($)
          <input
            type="text"
            name="amount"
            required
            defaultValue={centsToDollarsString(Math.abs(transaction.amountCents))}
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            name="transactionDate"
            defaultValue={transaction.transactionDate.toISOString().slice(0, 10)}
            required
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          As-purchased date (optional)
          <input
            type="date"
            name="asPurchasedDate"
            defaultValue={transaction.asPurchasedDate?.toISOString().slice(0, 10) ?? ""}
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Only fill this in if the charge physically happened on a different day than the
            date above (e.g. a Saturday purchase posted the following Sunday). Clear it to
            remove.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Account
          <select
            name="accountId"
            defaultValue={transaction.accountId ?? ""}
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          >
            <option value="">— none —</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Bucket
          <select
            name="bucketId"
            defaultValue={transaction.bucketId ?? ""}
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          >
            <option value="">— uncategorized —</option>
            {buckets.map((bucket) => (
              <option key={bucket.id} value={bucket.id}>
                {bucket.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Merchant
          <input
            type="text"
            name="merchantNameRaw"
            defaultValue={transaction.merchantNameRaw ?? ""}
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <input
            type="text"
            name="description"
            defaultValue={transaction.description ?? ""}
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Save
        </button>
      </form>
    </div>
  );
}
