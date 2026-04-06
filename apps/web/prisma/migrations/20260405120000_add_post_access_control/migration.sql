-- CreateEnum
CREATE TYPE "PostAccessMode" AS ENUM ('PUBLIC', 'ROLE', 'PASSWORD');

-- AlterTable
ALTER TABLE "Post"
ADD COLUMN "accessMode" "PostAccessMode" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "minRole" "Role",
ADD COLUMN "accessPasswords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "accessVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Post_accessMode_idx" ON "Post"("accessMode");

-- CreateIndex
CREATE INDEX "Post_status_accessMode_publishedAt_idx"
ON "Post"("status", "accessMode", "publishedAt");
