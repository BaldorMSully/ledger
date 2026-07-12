import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { centsToDollarsString } from "@/lib/money";
import { monthInputValue, parseMonthInput, startOfMonth } from "@/lib/dates";
import { createBucket, archiveBucket, setAllocation } from "./actions";

export default async function BucketsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { household } = await requireHousehold();
  const { month: monthParam } = await searchParams;
  const month = monthParam ? parseMonthInput(monthParam) : startOfMonth(new Date());
  const monthValue = monthInputValue(month);

  const buckets = await prisma.bucket.findMany({
    where: { householdId: household.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { allocations: { where: { month } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Buckets</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Monthly allocation for {monthValue}
        </p>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="py-2">Name</th>
            <th className="py-2">Group</th>
            <th className="py-2">Allocated this month</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2">{bucket.name}</td>
              <td className="py-2 text-zinc-500 dark:text-zinc-400">
                {bucket.bucketGroup ?? "—"}
              </td>
              <td className="py-2">
                <form action={setAllocation} className="flex items-center gap-2">
                  <input type="hidden" name="bucketId" value={bucket.id} />
                  <input type="hidden" name="month" value={monthValue} />
                  <span>$</span>
                  <input
                    type="text"
                    name="amount"
                    defaultValue={centsToDollarsString(
                      bucket.allocations[0]?.allocatedAmountCents ?? 0
                    )}
                    className="w-24 rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
                  />
                  <button type="submit" className="underline">
                    Save
                  </button>
                </form>
              </td>
              <td className="py-2 text-right">
                <form action={archiveBucket}>
                  <input type="hidden" name="bucketId" value={bucket.id} />
                  <button type="submit" className="text-red-600 underline dark:text-red-400">
                    Archive
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="mb-2 text-sm font-medium">Add a bucket</h2>
        <form action={createBucket} className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              type="text"
              name="name"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Group (optional)
            <input
              type="text"
              name="bucketGroup"
              placeholder="needs / wants / savings"
              className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
