-- DropForeignKey
ALTER TABLE "goal_contributions" DROP CONSTRAINT "goal_contributions_transaction_id_fkey";

-- AlterTable
ALTER TABLE "financial_goals" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "goal_contributions" ADD COLUMN     "note" TEXT,
ALTER COLUMN "transaction_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "goal_contributions_goal_id_created_at_idx" ON "goal_contributions"("goal_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
