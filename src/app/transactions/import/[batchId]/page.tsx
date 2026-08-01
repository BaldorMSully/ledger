import { notFound } from "next/navigation";
import Link from "next/link";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { commitCsvImport, toggleDuplicateApproval } from "../actions";

export default async function CsvImportPreviewPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { household } = await requireHousehold();
  const { batchId } = await params;

  const batch = await prisma.csvImportBatch.findFirst({
    where: { id: batchId, householdId: household.id },
    include: {
      account: true,
      rows: { orderBy: [{ parsedDate: "desc" }, { id: "asc" }] },
    },
  });
  if (!batch) notFound();

  const newRows = batch.rows.filter((row) => row.status === "new");
  const duplicateRows = batch.rows.filter((row) => row.status === "duplicate");
  const unparseableRows = batch.rows.filter((row) => row.status === "unparseable");
  const approvedDuplicateCount = duplicateRows.filter((row) => row.approvedForImport).length;
  const committableCount = newRows.length + approvedDuplicateCount;

  if (batch.status === "committed") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Import already committed</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This batch ({batch.fileName}) was already imported.
        </p>
        <Link href="/transactions" className="text-sm underline">
          Back to transactions
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Preview: {batch.fileName}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Importing to <strong>{batch.account.name}</strong>. Nothing is added until you confirm.
      </p>

      <div className="flex gap-6 text-sm">
        <span>
          <strong>{newRows.length}</strong> new
        </span>
        <span>
          <strong>{duplicateRows.length}</strong> flagged as duplicate
          {approvedDuplicateCount > 0 && ` (${approvedDuplicateCount} approved anyway)`}
        </span>
        <span>
          <strong>{unparseableRows.length}</strong> unparseable
        </span>
        {batch.pendingSkippedCount > 0 && (
          <span className="text-zinc-500 dark:text-zinc-400">
            {batch.pendingSkippedCount} pending rows skipped
          </span>
        )}
      </div>

      {unparseableRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Unparseable rows (will not be imported)</h2>
          <table className="w-full text-left text-sm">
            <tbody>
              {unparseableRows.map((row) => (
                <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-1 pr-4 text-red-600 dark:text-red-400">{row.errorMessage}</td>
                  <td className="py-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {JSON.stringify(row.rawLine)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {duplicateRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Flagged as duplicate</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="py-1">Date</th>
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Amount</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {duplicateRows.map((row) => (
                <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-1 whitespace-nowrap">
                    {row.parsedDate?.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1">{row.parsedDescription}</td>
                  <td className="py-1 text-right">
                    {row.parsedAmountCents !== null && formatCents(row.parsedAmountCents)}
                  </td>
                  <td className="py-1 text-right">
                    <form action={toggleDuplicateApproval}>
                      <input type="hidden" name="rowId" value={row.id} />
                      <input
                        type="hidden"
                        name="nextApproved"
                        value={(!row.approvedForImport).toString()}
                      />
                      <button type="submit" className="text-xs underline whitespace-nowrap">
                        {row.approvedForImport ? "Undo — skip it" : "Import anyway"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {newRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">New transactions</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="py-1">Date</th>
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {newRows.map((row) => (
                <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-1 whitespace-nowrap">
                    {row.parsedDate?.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1">{row.parsedDescription}</td>
                  <td className="py-1 text-right">
                    {row.parsedAmountCents !== null && formatCents(row.parsedAmountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={commitCsvImport} className="flex items-center gap-4">
        <input type="hidden" name="batchId" value={batch.id} />
        <button
          type="submit"
          disabled={committableCount === 0}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          Import {committableCount} transaction{committableCount === 1 ? "" : "s"}
        </button>
        <Link href="/transactions/import" className="text-sm underline">
          Cancel / upload a different file
        </Link>
      </form>
    </div>
  );
}
