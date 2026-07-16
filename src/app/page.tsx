import Link from "next/link";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { addMonths, formatMonth, monthInputValue, parseMonthParam } from "@/lib/dates";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { household } = await requireHousehold();
  const { month: monthParam } = await searchParams;

  const month = parseMonthParam(monthParam);
  const nextMonthStart = addMonths(month, 1);

  const buckets = await prisma.bucket.findMany({
    where: { householdId: household.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      allocations: { where: { month } },
    },
  });

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
        <Link href="/transactions/new" className="text-sm underline">
          + Add transaction
        </Link>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => {
              const allocatedCents = bucket.allocations[0]?.allocatedAmountCents ?? 0;
              // Spend is stored as negative cents by convention; flip sign for display.
              const spentCents = -(spendMap.get(bucket.id) ?? 0);
              const remainingCents = allocatedCents - spentCents;
              return (
                <tr key={bucket.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">{bucket.name}</td>
                  <td className="py-2 text-right">{formatCents(allocatedCents)}</td>
                  <td className="py-2 text-right">{formatCents(spentCents)}</td>
                  <td
                    className={`py-2 text-right ${remainingCents < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                  >
                    {formatCents(remainingCents)}
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
