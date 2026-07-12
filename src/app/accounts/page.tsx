import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createAccount, archiveAccount } from "./actions";

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
  "cash",
  "loan",
  "investment",
] as const;

export default async function AccountsPage() {
  const { household } = await requireHousehold();

  const accounts = await prisma.financialAccount.findMany({
    where: { householdId: household.id, isArchived: false },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Accounts</h1>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="py-2">Name</th>
            <th className="py-2">Type</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2">{account.name}</td>
              <td className="py-2 text-zinc-500 dark:text-zinc-400">
                {account.accountType.replace("_", " ")}
              </td>
              <td className="py-2 text-right">
                <form action={archiveAccount}>
                  <input type="hidden" name="accountId" value={account.id} />
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
        <h2 className="mb-2 text-sm font-medium">Add an account</h2>
        <form action={createAccount} className="flex items-end gap-3">
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
            Type
            <select
              name="accountType"
              required
              className="rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
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
