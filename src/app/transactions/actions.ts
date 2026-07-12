"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { dollarsToCents } from "@/lib/money";
import type { TransactionType } from "@/generated/prisma/client";

const VALID_TYPES: TransactionType[] = ["spend", "income", "transfer"];

export async function createTransaction(formData: FormData) {
  const { household, userId } = await requireHousehold();

  const accountId = String(formData.get("accountId") ?? "") || null;
  const bucketId = String(formData.get("bucketId") ?? "") || null;
  const transactionType = String(formData.get("transactionType") ?? "") as TransactionType;
  const dateValue = String(formData.get("transactionDate") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;
  const merchantNameRaw = String(formData.get("merchantNameRaw") ?? "").trim() || null;
  const amountInput = String(formData.get("amount") ?? "0");

  if (!VALID_TYPES.includes(transactionType)) throw new Error("Invalid transaction type");
  if (!dateValue) throw new Error("Date is required");

  // Manual entry convention: user always types a positive dollar amount; sign is derived
  // from transactionType (spend = negative, income/transfer-in = positive).
  const magnitudeCents = Math.abs(dollarsToCents(amountInput));
  const amountCents = transactionType === "spend" ? -magnitudeCents : magnitudeCents;

  if (accountId) {
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, householdId: household.id },
    });
    if (!account) throw new Error("Account not found");
  }
  if (bucketId) {
    const bucket = await prisma.bucket.findFirst({
      where: { id: bucketId, householdId: household.id },
    });
    if (!bucket) throw new Error("Bucket not found");
  }

  const transaction = await prisma.transaction.create({
    data: {
      householdId: household.id,
      accountId,
      bucketId,
      transactionType,
      amountCents,
      transactionDate: new Date(dateValue),
      postedDate: new Date(dateValue),
      description,
      merchantNameRaw,
      source: "manual",
      categorizationSource: bucketId ? "manual" : "uncategorized",
      createdBy: userId,
    },
  });

  await logAudit({
    householdId: household.id,
    entityType: "Transaction",
    entityId: transaction.id,
    actorUserId: userId,
    action: "create",
    diff: { amountCents, transactionType, bucketId, accountId },
  });

  revalidatePath("/transactions");
  revalidatePath("/");
  redirect("/transactions");
}

export async function deleteTransaction(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const transactionId = String(formData.get("transactionId") ?? "");

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId: household.id },
  });
  if (!transaction) throw new Error("Transaction not found");

  await prisma.transaction.delete({ where: { id: transactionId } });
  await logAudit({
    householdId: household.id,
    entityType: "Transaction",
    entityId: transactionId,
    actorUserId: userId,
    action: "delete",
  });

  revalidatePath("/transactions");
  revalidatePath("/");
}
