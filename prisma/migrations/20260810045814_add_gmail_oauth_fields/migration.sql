-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gmailConnectedAt" TIMESTAMP(3),
ADD COLUMN     "gmailEmail" TEXT,
ADD COLUMN     "gmailNeedsReconnect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gmailRefreshToken" TEXT;
