"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parseAndClassifyCsv } from "@/lib/csv";

const MAX_CSV_BYTES = 5_000_000; // 5MB — a household's export is nowhere near this size.

export async function uploadCsv(formData: FormData) {
  const { household, userId } = await requireHousehold();

  const accountId = String(formData.get("accountId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) throw new Error("A CSV file is required");
  if (file.size > MAX_CSV_BYTES) throw new Error("File is too large");

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, householdId: household.id },
  });
  if (!account) throw new Error("Account not found");

  const csvText = await file.text();

  const existing = await prisma.transaction.findMany({
    where: { householdId: household.id, accountId },
    select: { transactionDate: true, amountCents: true, description: true },
  });

  const { rows: parsedRows, pendingSkippedCount } = parseAndClassifyCsv(csvText, existing);

  const batch = await prisma.csvImportBatch.create({
    data: {
      householdId: household.id,
      accountId,
      fileName: file.name,
      createdBy: userId,
      pendingSkippedCount,
      rows: {
        create: parsedRows.map((row) => ({
          rawLine: row.rawLine,
          parsedDate: row.parsedDate,
          parsedAmountCents: row.parsedAmountCents,
          parsedDescription: row.parsedDescription,
          status: row.status,
          errorMessage: row.errorMessage,
        })),
      },
    },
  });

  await logAudit({
    householdId: household.id,
    entityType: "CsvImportBatch",
    entityId: batch.id,
    actorUserId: userId,
    action: "create",
    diff: { fileName: file.name, accountId, rowCount: parsedRows.length },
  });

  redirect(`/transactions/import/${batch.id}`);
}

/** Manual escape hatch for an exact-match false positive (plan.md §7) — the dedup rule
 * itself never changes; this just lets a household member confirm one flagged row anyway. */
export async function toggleDuplicateApproval(formData: FormData) {
  const { household } = await requireHousehold();
  const rowId = String(formData.get("rowId") ?? "");
  const nextApproved = String(formData.get("nextApproved") ?? "") === "true";

  const row = await prisma.csvImportRow.findFirst({
    where: { id: rowId, batch: { householdId: household.id } },
  });
  if (!row) throw new Error("Import row not found");

  await prisma.csvImportRow.update({
    where: { id: rowId },
    data: { approvedForImport: nextApproved },
  });

  revalidatePath(`/transactions/import/${row.batchId}`);
}

export async function commitCsvImport(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const batchId = String(formData.get("batchId") ?? "");

  const batch = await prisma.csvImportBatch.findFirst({
    where: { id: batchId, householdId: household.id },
    include: { rows: true },
  });
  if (!batch) throw new Error("Import batch not found");
  if (batch.status === "committed") throw new Error("This batch was already committed");

  const committableRows = batch.rows.filter(
    (row) => row.status === "new" || (row.status === "duplicate" && row.approvedForImport)
  );

  await prisma.$transaction(async (tx) => {
    for (const row of committableRows) {
      if (row.parsedDate === null || row.parsedAmountCents === null) continue;
      const transaction = await tx.transaction.create({
        data: {
          householdId: household.id,
          accountId: batch.accountId,
          amountCents: row.parsedAmountCents,
          transactionDate: row.parsedDate,
          // asPurchasedDate intentionally left unset (spec 002, FR-008/FR-012) - CSV import
          // only ever knows the bank's recorded date; a household member fills this in
          // manually afterward if a charge physically happened on a different day.
          transactionType: row.parsedAmountCents < 0 ? "spend" : "income",
          description: row.parsedDescription,
          source: "csv_import",
          categorizationSource: "uncategorized",
          createdBy: userId,
        },
      });
      await tx.csvImportRow.update({
        where: { id: row.id },
        data: { status: "committed", transactionId: transaction.id },
      });
    }
    await tx.csvImportBatch.update({
      where: { id: batch.id },
      data: { status: "committed", committedAt: new Date() },
    });
  });

  await logAudit({
    householdId: household.id,
    entityType: "CsvImportBatch",
    entityId: batch.id,
    actorUserId: userId,
    action: "update",
    diff: { committedRows: committableRows.length },
  });

  revalidatePath("/transactions");
  revalidatePath("/");
  redirect("/transactions");
}
