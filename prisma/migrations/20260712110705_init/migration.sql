-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('checking', 'savings', 'credit_card', 'cash', 'loan', 'investment');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('spend', 'income', 'transfer');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('manual', 'csv_import', 'plaid');

-- CreateEnum
CREATE TYPE "CategorizationSource" AS ENUM ('manual', 'rule', 'uncategorized');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete');

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "app_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "FinancialAccountType" NOT NULL,
    "institutionName" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buckets" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bucketGroup" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bucket_allocations" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "allocatedAmountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bucket_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_series" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "postedDate" TIMESTAMP(3),
    "transactionType" "TransactionType" NOT NULL,
    "linkedTransactionId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringSeriesId" TEXT,
    "bucketId" TEXT,
    "merchantNameRaw" TEXT,
    "description" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "categorizationSource" "CategorizationSource" NOT NULL DEFAULT 'uncategorized',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tags" (
    "transactionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transactionId","tagId")
);

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "matchConditions" JSONB NOT NULL,
    "targetBucketId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timesApplied" INTEGER NOT NULL DEFAULT 0,
    "lastAppliedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "costBasisCents" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balance_snapshots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "balanceCents" INTEGER NOT NULL,

    CONSTRAINT "account_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "diff" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_providerAccountId_key" ON "auth_accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_sessionToken_key" ON "auth_sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verification_tokens_token_key" ON "auth_verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verification_tokens_identifier_token_key" ON "auth_verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_householdId_userId_key" ON "household_members"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "bucket_allocations_bucketId_month_key" ON "bucket_allocations"("bucketId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_linkedTransactionId_key" ON "transactions"("linkedTransactionId");

-- CreateIndex
CREATE INDEX "transactions_householdId_transactionDate_idx" ON "transactions"("householdId", "transactionDate");

-- CreateIndex
CREATE INDEX "transactions_bucketId_idx" ON "transactions"("bucketId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_accountId_externalId_key" ON "transactions"("accountId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_householdId_name_key" ON "tags"("householdId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_accountId_ticker_key" ON "holdings"("accountId", "ticker");

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_snapshots_accountId_date_key" ON "account_balance_snapshots"("accountId", "date");

-- CreateIndex
CREATE INDEX "audit_log_householdId_entityType_entityId_idx" ON "audit_log"("householdId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buckets" ADD CONSTRAINT "buckets_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bucket_allocations" ADD CONSTRAINT "bucket_allocations_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "buckets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_series" ADD CONSTRAINT "recurring_series_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurringSeriesId_fkey" FOREIGN KEY ("recurringSeriesId") REFERENCES "recurring_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "buckets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_targetBucketId_fkey" FOREIGN KEY ("targetBucketId") REFERENCES "buckets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balance_snapshots" ADD CONSTRAINT "account_balance_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
