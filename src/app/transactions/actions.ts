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
  const asPurchasedDateValue = String(formData.get("asPurchasedDate") ?? "").trim();
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
      asPurchasedDate: asPurchasedDateValue ? new Date(asPurchasedDateValue) : null,
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

export async function editTransaction(formData: FormData) {
  const { household, userId } = await requireHousehold();

  const transactionId = String(formData.get("transactionId") ?? "");
  const accountId = String(formData.get("accountId") ?? "") || null;
  const bucketId = String(formData.get("bucketId") ?? "") || null;
  const transactionType = String(formData.get("transactionType") ?? "") as TransactionType;
  const dateValue = String(formData.get("transactionDate") ?? "");
  const asPurchasedDateValue = String(formData.get("asPurchasedDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const merchantNameRaw = String(formData.get("merchantNameRaw") ?? "").trim() || null;
  const amountInput = String(formData.get("amount") ?? "0");

  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId: household.id },
  });
  if (!existing) throw new Error("Transaction not found");

  if (!VALID_TYPES.includes(transactionType)) throw new Error("Invalid transaction type");
  if (!dateValue) throw new Error("Date is required");

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

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      accountId,
      bucketId,
      transactionType,
      amountCents,
      transactionDate: new Date(dateValue),
      asPurchasedDate: asPurchasedDateValue ? new Date(asPurchasedDateValue) : null,
      description,
      merchantNameRaw,
      categorizationSource: bucketId ? "manual" : "uncategorized",
    },
  });

  await logAudit({
    householdId: household.id,
    entityType: "Transaction",
    entityId: transactionId,
    actorUserId: userId,
    action: "update",
    diff: { amountCents, transactionType, bucketId, accountId, description, merchantNameRaw },
  });

  revalidatePath("/transactions");
  revalidatePath("/");
  redirect("/transactions");
}

/**
 * Quick inline bucket-only recategorize (FR-011) — same-page action, no redirect, unlike
 * the full `editTransaction` which lives on its own page.
 */
export async function updateTransactionBucket(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const transactionId = String(formData.get("transactionId") ?? "");
  const bucketId = String(formData.get("bucketId") ?? "") || null;

  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId: household.id },
  });
  if (!existing) throw new Error("Transaction not found");

  if (bucketId) {
    const bucket = await prisma.bucket.findFirst({
      where: { id: bucketId, householdId: household.id },
    });
    if (!bucket) throw new Error("Bucket not found");
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { bucketId, categorizationSource: bucketId ? "manual" : "uncategorized" },
  });

  await logAudit({
    householdId: household.id,
    entityType: "Transaction",
    entityId: transactionId,
    actorUserId: userId,
    action: "update",
    diff: { bucketId },
  });

  revalidatePath("/transactions");
  revalidatePath("/");
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
