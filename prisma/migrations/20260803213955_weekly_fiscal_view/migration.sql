-- CreateEnum
CREATE TYPE "RollupDateSource" AS ENUM ('recorded', 'as_purchased');

-- AlterTable
ALTER TABLE "households" ADD COLUMN     "rollupDateSource" "RollupDateSource" NOT NULL DEFAULT 'recorded';

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "postedDate",
ADD COLUMN     "asPurchasedDate" TIMESTAMP(3);
