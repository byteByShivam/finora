-- AlterTable
ALTER TABLE "recurring_transactions" ADD COLUMN "transfer_account_id" TEXT,
ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_recurring_transaction_id_occurred_at_key" ON "transactions"("recurring_transaction_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_transfer_account_id_fkey" FOREIGN KEY ("transfer_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
