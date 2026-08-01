-- CreateEnum
CREATE TYPE "HeadsUpNoteStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "CsvImportBatchStatus" AS ENUM ('pending', 'committed');

-- CreateEnum
CREATE TYPE "CsvImportRowStatus" AS ENUM ('new', 'duplicate', 'unparseable', 'committed');

-- AlterTable
ALTER TABLE "households" ADD COLUMN     "lastCheckInCompletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "heads_up_notes" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "HeadsUpNoteStatus" NOT NULL DEFAULT 'open',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "heads_up_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_import_batches" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "CsvImportBatchStatus" NOT NULL DEFAULT 'pending',
    "pendingSkippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "csv_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_import_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rawLine" JSONB NOT NULL,
    "parsedDate" TIMESTAMP(3),
    "parsedAmountCents" INTEGER,
    "parsedDescription" TEXT,
    "status" "CsvImportRowStatus" NOT NULL DEFAULT 'new',
    "errorMessage" TEXT,
    "approvedForImport" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,

    CONSTRAINT "csv_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "csv_import_rows_transactionId_key" ON "csv_import_rows"("transactionId");

-- AddForeignKey
ALTER TABLE "heads_up_notes" ADD CONSTRAINT "heads_up_notes_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_batches" ADD CONSTRAINT "csv_import_batches_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_batches" ADD CONSTRAINT "csv_import_batches_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_rows" ADD CONSTRAINT "csv_import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "csv_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_rows" ADD CONSTRAINT "csv_import_rows_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
