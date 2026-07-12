"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { FinancialAccountType } from "@/generated/prisma/client";

const VALID_TYPES: FinancialAccountType[] = [
  "checking",
  "savings",
  "credit_card",
  "cash",
  "loan",
  "investment",
];

export async function createAccount(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const name = String(formData.get("name") ?? "").trim();
  const accountType = String(formData.get("accountType") ?? "") as FinancialAccountType;

  if (!name) throw new Error("Account name is required");
  if (!VALID_TYPES.includes(accountType)) throw new Error("Invalid account type");

  const account = await prisma.financialAccount.create({
    data: { householdId: household.id, name, accountType, createdBy: userId },
  });
  await logAudit({
    householdId: household.id,
    entityType: "FinancialAccount",
    entityId: account.id,
    actorUserId: userId,
    action: "create",
    diff: { name, accountType },
  });

  revalidatePath("/accounts");
}

export async function archiveAccount(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const accountId = String(formData.get("accountId") ?? "");

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, householdId: household.id },
  });
  if (!account) throw new Error("Account not found");

  await prisma.financialAccount.update({
    where: { id: accountId },
    data: { isArchived: true },
  });
  await logAudit({
    householdId: household.id,
    entityType: "FinancialAccount",
    entityId: accountId,
    actorUserId: userId,
    action: "update",
    diff: { isArchived: true },
  });

  revalidatePath("/accounts");
}
