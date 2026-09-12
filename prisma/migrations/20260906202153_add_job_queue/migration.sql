-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('TRANSFER_DETECTION_SWEEP', 'CREDIT_CARD_CYCLE_ROLLOVER', 'RECURRING_TXN_DETECTION');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "userId" TEXT,
    "payload" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "runAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_scheduledFor_idx" ON "Job"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Job_type_idx" ON "Job"("type");
