import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "../actions";

export default async function NewTransactionPage() {
  const { household } = await requireHousehold();

  const [accounts, buckets] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { householdId: household.id, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.bucket.findMany({
      where: { householdId: household.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Add transaction</h1>

      <form action={createTransaction} className="flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="transactionType"
            defaultValue="spend"
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
            placeholder="0.00"
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            name="transactionDate"
            defaultValue={today}
            required
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Account
          <select
            name="accountId"
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
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <input
            type="text"
            name="description"
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
