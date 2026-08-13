-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('EXPENSE', 'TRANSFER');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "kind" "TransactionKind" NOT NULL DEFAULT 'EXPENSE',
ADD COLUMN     "transferAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_transferAccountId_idx" ON "Transaction"("transferAccountId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
