import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteAllTransactions, deleteTransactionsInRange, revertCsvImport } from "./actions";

export default async function SettingsPage() {
  const { household } = await requireHousehold();

  const [transactionCount, batches] = await Promise.all([
    prisma.transaction.count({ where: { householdId: household.id } }),
    prisma.csvImportBatch.findMany({
      where: { householdId: household.id, status: "committed" },
      orderBy: { committedAt: "desc" },
      include: { account: true, _count: { select: { rows: true } } },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Revert a CSV import</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Deletes every transaction that import created — including anything you&apos;ve since
          edited or recategorized. No partial undo.
        </p>
        {batches.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No committed imports yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="py-2 pr-3 pl-0">Imported</th>
                <th className="py-2 px-3">File</th>
                <th className="py-2 px-3">Account</th>
                <th className="py-2 px-3 text-right">Rows</th>
                <th className="py-2 pl-3 pr-0" />
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-3 pl-0 whitespace-nowrap">
                    {batch.committedAt?.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-2 px-3">{batch.fileName}</td>
                  <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400">
                    {batch.account.name}
                  </td>
                  <td className="py-2 px-3 text-right">{batch._count.rows}</td>
                  <td className="py-2 pl-3 pr-0 text-right">
                    <form action={revertCsvImport}>
                      <input type="hidden" name="batchId" value={batch.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Revert "${batch.fileName}"? This deletes every transaction it created.`}
                        className="text-red-600 underline dark:text-red-400"
                      >
                        Revert
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Delete transactions in a date range</h2>
        <form action={deleteTransactionsInRange} className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            From
            <input
              type="date"
              name="from"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            To
            <input
              type="date"
              name="to"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Delete every transaction dated in this range? This can't be undone."
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            Delete range
          </ConfirmSubmitButton>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded border border-red-600/30 bg-red-600/5 p-4">
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Deletes all {transactionCount} transaction{transactionCount === 1 ? "" : "s"} and all
          CSV import history for this household. Buckets, accounts, and check-in state are
          untouched.
        </p>
        <form action={deleteAllTransactions} className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Type DELETE to confirm
            <input
              type="text"
              name="confirmation"
              required
              placeholder="DELETE"
              className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="This deletes ALL transactions and import history. Are you sure?"
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            Delete everything
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
