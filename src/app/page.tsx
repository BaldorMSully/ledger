import Link from "next/link";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import {
  addMonths,
  currentMonthStart,
  formatMonth,
  monthInputValue,
  monthProgressPercent,
  parseMonthParam,
} from "@/lib/dates";
import { completeCheckIn, createHeadsUpNote, resolveHeadsUpNote } from "./actions";

// Pacing is flagged as "outpacing the calendar" once spend is this many percentage
// points ahead of how far through the month we are.
const PACING_WARNING_THRESHOLD = 10;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { household } = await requireHousehold();
  const { month: monthParam } = await searchParams;

  const month = parseMonthParam(monthParam);
  const nextMonthStart = addMonths(month, 1);
  const monthValue = monthInputValue(month);

  const currentMonth = currentMonthStart();
  const monthElapsedPercent =
    monthValue === monthInputValue(currentMonth)
      ? monthProgressPercent()
      : month < currentMonth
        ? 100
        : 0;

  const [buckets, headsUpNotes] = await Promise.all([
    prisma.bucket.findMany({
      where: { householdId: household.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        allocations: { where: { month } },
      },
    }),
    prisma.headsUpNote.findMany({
      where: { householdId: household.id, status: "open" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const spendByBucket = await prisma.transaction.groupBy({
    by: ["bucketId"],
    where: {
      householdId: household.id,
      transactionType: "spend",
      transactionDate: { gte: month, lt: nextMonthStart },
      bucketId: { not: null },
    },
    _sum: { amountCents: true },
  });
  const spendMap = new Map(
    spendByBucket.map((row) => [row.bucketId, row._sum.amountCents ?? 0])
  );

  const prevHref = `/?month=${monthInputValue(addMonths(month, -1))}`;
  const nextHref = `/?month=${monthInputValue(addMonths(month, 1))}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={prevHref} className="text-sm underline">
            ← Prev
          </Link>
          <h1 className="text-xl font-semibold">{formatMonth(month)}</h1>
          <Link href={nextHref} className="text-sm underline">
            Next →
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/transactions/new" className="text-sm underline">
            + Add transaction
          </Link>
          <form action={completeCheckIn}>
            <button
              type="submit"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Mark check-in complete
            </button>
          </form>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Last check-in:{" "}
        {household.lastCheckInCompletedAt
          ? household.lastCheckInCompletedAt.toISOString().slice(0, 10)
          : "never — every transaction below is flagged as new"}
      </p>

      {headsUpNotes.length > 0 && (
        <div className="flex flex-col gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-medium">Heads up</h2>
          <ul className="flex flex-col gap-2">
            {headsUpNotes.map((note) => (
              <li key={note.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{note.body}</span>
                <form action={resolveHeadsUpNote}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <button type="submit" className="text-xs underline whitespace-nowrap">
                    Resolve
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form action={createHeadsUpNote} className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Add a heads-up note (e.g. an upcoming bill)
          <input
            type="text"
            name="body"
            required
            className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
          />
        </label>
        <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
          Add
        </button>
      </form>

      {buckets.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No buckets yet. <Link href="/buckets" className="underline">Create your first bucket</Link>.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="py-2">Bucket</th>
              <th className="py-2 text-right">Allocated</th>
              <th className="py-2 text-right">Spent</th>
              <th className="py-2 text-right">Remaining</th>
              <th className="py-2 text-right">Pacing</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => {
              const allocatedCents = bucket.allocations[0]?.allocatedAmountCents ?? 0;
              // Spend is stored as negative cents by convention; flip sign for display.
              const spentCents = -(spendMap.get(bucket.id) ?? 0);
              const remainingCents = allocatedCents - spentCents;
              const budgetUsedPercent =
                allocatedCents > 0 ? Math.round((spentCents / allocatedCents) * 100) : null;
              const isOutpacing =
                budgetUsedPercent !== null &&
                budgetUsedPercent - monthElapsedPercent > PACING_WARNING_THRESHOLD;
              return (
                <tr key={bucket.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">
                    <Link
                      href={`/transactions?bucketId=${bucket.id}&month=${monthValue}`}
                      className="underline"
                    >
                      {bucket.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{formatCents(allocatedCents)}</td>
                  <td className="py-2 text-right">{formatCents(spentCents)}</td>
                  <td
                    className={`py-2 text-right ${remainingCents < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {formatCents(remainingCents)}
                  </td>
                  <td
                    className={`py-2 text-right text-xs ${isOutpacing ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {budgetUsedPercent === null
                      ? "no budget set"
                      : `${budgetUsedPercent}% used, ${monthElapsedPercent}% of month`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
