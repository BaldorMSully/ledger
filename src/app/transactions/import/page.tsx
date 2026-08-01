import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { uploadCsv } from "./actions";

export default async function ImportCsvPage() {
  const { household } = await requireHousehold();

  const accounts = await prisma.financialAccount.findMany({
    where: { householdId: household.id, isArchived: false },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Import transactions from CSV</h1>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        Upload a CSV export from your bank for the household&apos;s primary account. You&apos;ll
        see a preview — including anything that looks like a duplicate or can&apos;t be parsed —
        before anything is added.
      </p>

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No accounts yet — add one on the Accounts page first.
        </p>
      ) : (
        <form action={uploadCsv} className="flex max-w-md flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Account
            <select
              name="accountId"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            CSV file
            <input type="file" name="file" accept=".csv,text/csv" required />
          </label>

          <button
            type="submit"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Upload &amp; preview
          </button>
        </form>
      )}
    </div>
  );
}
