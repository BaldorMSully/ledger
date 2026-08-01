"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Undoes one CSV import: deletes every transaction it created (including anything since
 * edited or recategorized — there's no partial undo) and the batch/row records themselves.
 * Safe delete order: CsvImportRow.transactionId is ON DELETE SET NULL, so deleting the
 * transactions first can't violate that FK; the batch delete then cascades its rows.
 */
export async function revertCsvImport(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const batchId = String(formData.get("batchId") ?? "");

  const batch = await prisma.csvImportBatch.findFirst({
    where: { id: batchId, householdId: household.id },
    include: { rows: { where: { transactionId: { not: null } } } },
  });
  if (!batch) throw new Error("Import batch not found");

  const transactionIds = batch.rows
    .map((row) => row.transactionId)
    .filter((id): id is string => id !== null);

  await prisma.$transaction(async (tx) => {
    if (transactionIds.length > 0) {
      await tx.transaction.deleteMany({ where: { id: { in: transactionIds } } });
    }
    await tx.csvImportBatch.delete({ where: { id: batch.id } });
  });

  await logAudit({
    householdId: household.id,
    entityType: "CsvImportBatch",
    entityId: batch.id,
    actorUserId: userId,
    action: "delete",
    diff: { fileName: batch.fileName, revertedTransactionCount: transactionIds.length },
  });

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function deleteTransactionsInRange(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const fromValue = String(formData.get("from") ?? "");
  const toValue = String(formData.get("to") ?? "");
  if (!fromValue || !toValue) throw new Error("Both dates are required");

  const from = new Date(fromValue);
  // Inclusive of the "to" day: bump to the start of the next day for the range's exclusive end.
  const to = new Date(toValue);
  to.setUTCDate(to.getUTCDate() + 1);

  const where: Prisma.TransactionWhereInput = {
    householdId: household.id,
    transactionDate: { gte: from, lt: to },
  };

  const count = await prisma.transaction.count({ where });
  await prisma.transaction.deleteMany({ where });

  await logAudit({
    householdId: household.id,
    entityType: "Transaction",
    entityId: "bulk-delete-range",
    actorUserId: userId,
    action: "delete",
    diff: { from: fromValue, to: toValue, count },
  });

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/");
}

/** Wipes every transaction and all CSV import history for this household. Buckets, accounts,
 * and check-in state are untouched. */
export async function deleteAllTransactions(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const confirmation = String(formData.get("confirmation") ?? "");
  if (confirmation !== "DELETE") throw new Error('Type "DELETE" to confirm');

  const { transactionCount, importBatchCount } = await prisma.$transaction(async (tx) => {
    const transactionCount = await tx.transaction.count({
      where: { householdId: household.id },
    });
    const importBatchCount = await tx.csvImportBatch.count({
      where: { householdId: household.id },
    });
    await tx.transaction.deleteMany({ where: { householdId: household.id } });
    await tx.csvImportBatch.deleteMany({ where: { householdId: household.id } });
    return { transactionCount, importBatchCount };
  });

  await logAudit({
    householdId: household.id,
    entityType: "Transaction",
    entityId: "bulk-delete-all",
    actorUserId: userId,
    action: "delete",
    diff: { transactionCount, importBatchCount },
  });

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/");
}
