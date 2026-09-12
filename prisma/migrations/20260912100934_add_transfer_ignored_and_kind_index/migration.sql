-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "transferIgnored" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Transaction_userId_kind_idx" ON "Transaction"("userId", "kind");
