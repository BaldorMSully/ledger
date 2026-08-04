import Link from "next/link";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import {
  addMonths,
  currentMonthStart,
  effectiveDateFetchWhere,
  formatMonth,
  inEffectiveWindow,
  monthInputValue,
  monthProgressPercent,
  parseMonthParam,
} from "@/lib/dates";
import {
  addWeeks,
  assignWeekToMonth,
  currentWeekStart,
  fiscalPeriodLabel,
  parseWeekParam,
  weekEndInclusive,
  weekInputValue,
  weekProgressPercent,
  weeksAssignedToMonth,
} from "@/lib/fiscalWeek";
import { completeCheckIn, createHeadsUpNote, resolveHeadsUpNote } from "./actions";

// Pacing is flagged as "outpacing the calendar" once spend is this many percentage
// points ahead of how far through the period (week or month) we are.
const PACING_WARNING_THRESHOLD = 10;

type ViewMode = "week" | "month";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; week?: string; view?: string }>;
}) {
  const { household } = await requireHousehold();
  const { month: monthParam, week: weekParam, view: viewParam } = await searchParams;
  const dateSource = household.rollupDateSource;

  // Weekly is the default view (spec 002, FR-003) - the household's primary budgeting
  // rhythm; the monthly view stays exactly as it was before this feature, unchanged.
  const view: ViewMode = viewParam === "month" ? "month" : "week";

  let windowStart: Date;
  let windowEnd: Date;
  let headerLabel: string;
  let periodElapsedPercent: number;
  let prevHref: string;
  let nextHref: string;
  // The calendar month whose (unchanged, calendar-month) BucketAllocation this period
  // draws its target from, and - for the weekly view only - how many fiscal weeks that
  // allocation gets divided across (spec FR-004).
  let allocationMonth: Date;
  let weeksInAllocationMonth: number | null = null;

  if (view === "week") {
    const week = parseWeekParam(weekParam);
    windowStart = week;
    windowEnd = addWeeks(week, 1);
    const currentWeek = currentWeekStart();
    periodElapsedPercent =
      weekInputValue(week) === weekInputValue(currentWeek)
        ? weekProgressPercent()
        : week < currentWeek
          ? 100
          : 0;
    const assigned = assignWeekToMonth(week);
    allocationMonth = new Date(Date.UTC(assigned.year, assigned.month, 1));
    weeksInAllocationMonth = weeksAssignedToMonth(allocationMonth, addMonths(allocationMonth, 1));
    headerLabel = `${weekInputValue(week)} – ${weekInputValue(weekEndInclusive(week))}`;
    prevHref = `/?view=week&week=${weekInputValue(addWeeks(week, -1))}`;
    nextHref = `/?view=week&week=${weekInputValue(addWeeks(week, 1))}`;
  } else {
    const month = parseMonthParam(monthParam);
    windowStart = month;
    windowEnd = addMonths(month, 1);
    const currentMonth = currentMonthStart();
    periodElapsedPercent =
      monthInputValue(month) === monthInputValue(currentMonth)
        ? monthProgressPercent()
        : month < currentMonth
          ? 100
          : 0;
    allocationMonth = month;
    headerLabel = formatMonth(month);
    prevHref = `/?view=month&month=${monthInputValue(addMonths(month, -1))}`;
    nextHref = `/?view=month&month=${monthInputValue(addMonths(month, 1))}`;
  }
  const drillDownParam =
    view === "week" ? `week=${weekInputValue(windowStart)}` : `month=${monthInputValue(windowStart)}`;

  const [buckets, headsUpNotes, rawSpend] = await Promise.all([
    prisma.bucket.findMany({
      where: { householdId: household.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        allocations: { where: { month: allocationMonth } },
      },
    }),
    prisma.headsUpNote.findMany({
      where: { householdId: household.id, status: "open" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: household.id,
        transactionType: "spend",
        ...effectiveDateFetchWhere(windowStart, windowEnd),
      },
      select: { bucketId: true, amountCents: true, transactionDate: true, asPurchasedDate: true },
    }),
  ]);

  const spendInWindow = rawSpend.filter((tx) =>
    inEffectiveWindow(tx, dateSource, windowStart, windowEnd)
  );

  const spendMap = new Map<string, number>();
  let uncategorizedCents = 0;
  let uncategorizedCount = 0;
  for (const tx of spendInWindow) {
    if (tx.bucketId) {
      spendMap.set(tx.bucketId, (spendMap.get(tx.bucketId) ?? 0) + tx.amountCents);
    } else {
      uncategorizedCents += tx.amountCents;
      uncategorizedCount += 1;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={prevHref} className="text-sm underline">
            ← Prev
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold">{headerLabel}</h1>
            {view === "week" && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {fiscalPeriodLabel(windowStart)}
              </span>
            )}
          </div>
          <Link href={nextHref} className="text-sm underline">
            Next →
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-full border border-black/10 p-0.5 text-sm dark:border-white/20">
            <Link
              href="/?view=week"
              className={`rounded-full px-3 py-1 ${view === "week" ? "bg-foreground text-background" : ""}`}
            >
              Week
            </Link>
            <Link
              href="/?view=month"
              className={`rounded-full px-3 py-1 ${view === "month" ? "bg-foreground text-background" : ""}`}
            >
              Month
            </Link>
          </div>
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

      {uncategorizedCount > 0 && (
        <Link
          href="/transactions?bucket=unclassified"
          className="text-sm text-amber-600 underline dark:text-amber-400"
        >
          {uncategorizedCount} uncategorized transaction
          {uncategorizedCount === 1 ? "" : "s"} this {view} (
          {formatCents(-uncategorizedCents)} unaccounted for)
        </Link>
      )}

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
              <th className="py-2 pr-3 pl-0">Bucket</th>
              <th className="py-2 px-3 text-right">
                {view === "week" ? "Weekly target" : "Allocated"}
              </th>
              <th className="py-2 px-3 text-right">Spent</th>
              <th className="py-2 px-3 text-right">Remaining</th>
              <th className="py-2 pl-3 pr-0 text-right">Pacing</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => {
              const monthlyAllocatedCents = bucket.allocations[0]?.allocatedAmountCents ?? 0;
              const allocatedCents =
                view === "week" && weeksInAllocationMonth
                  ? Math.round(monthlyAllocatedCents / weeksInAllocationMonth)
                  : monthlyAllocatedCents;
              // Spend is stored as negative cents by convention; flip sign for display.
              const spentCents = -(spendMap.get(bucket.id) ?? 0);
              const remainingCents = allocatedCents - spentCents;
              const budgetUsedPercent =
                allocatedCents > 0 ? Math.round((spentCents / allocatedCents) * 100) : null;
              const isOutpacing =
                budgetUsedPercent !== null &&
                budgetUsedPercent - periodElapsedPercent > PACING_WARNING_THRESHOLD;
              return (
                <tr key={bucket.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-3 pl-0">
                    <Link
                      href={`/transactions?bucketId=${bucket.id}&${drillDownParam}`}
                      className="underline"
                    >
                      {bucket.name}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-right">{formatCents(allocatedCents)}</td>
                  <td className="py-2 px-3 text-right">{formatCents(spentCents)}</td>
                  <td
                    className={`py-2 px-3 text-right ${remainingCents < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {formatCents(remainingCents)}
                  </td>
                  <td
                    className={`py-2 pl-3 pr-0 text-right text-xs ${isOutpacing ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {budgetUsedPercent === null
                      ? "no budget set"
                      : `${budgetUsedPercent}% used, ${periodElapsedPercent}% of ${view}`}
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
