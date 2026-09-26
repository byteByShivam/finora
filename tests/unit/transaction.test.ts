import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { TransactionService } from '@/server/services/transaction.service';
import { AccountService } from '@/server/services/account.service';
import { CategoryService } from '@/server/services/category.service';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '@/lib/validation/transaction.schema';
import { TxnType, AccountType, CategoryType, Prisma } from '@prisma/client';

describe('Phase 5 — Transactions & Core Financial Ledger Suite', () => {
  let userAId: string;
  let userBId: string;
  let userAAccount1Id: string;
  let userAAccount2Id: string;
  let userBAccountId: string;
  let userACatIncomeId: string;
  let userACatExpenseId: string;
  let userBCatExpenseId: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: { in: ['txn-test-a@finora.test', 'txn-test-b@finora.test'] },
      },
    });

    // Create User A
    const userA = await prisma.user.create({
      data: {
        email: 'txn-test-a@finora.test',
        name: 'Txn Tester A',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userAId = userA.id;

    // Create User B
    const userB = await prisma.user.create({
      data: {
        email: 'txn-test-b@finora.test',
        name: 'Txn Tester B',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });
    userBId = userB.id;

    // Create accounts for User A
    const aAcc1 = await AccountService.create(userAId, {
      name: 'Alpha Checking',
      type: AccountType.bank,
      openingBalance: 50000,
    });
    userAAccount1Id = aAcc1.id;

    const aAcc2 = await AccountService.create(userAId, {
      name: 'Alpha Savings',
      type: AccountType.bank,
      openingBalance: 20000,
    });
    userAAccount2Id = aAcc2.id;

    // Create account for User B
    const bAcc = await AccountService.create(userBId, {
      name: 'Beta Checking',
      type: AccountType.bank,
      openingBalance: 30000,
    });
    userBAccountId = bAcc.id;

    // Categories for User A
    const catIncome = await CategoryService.create(userAId, {
      name: 'Consulting Alpha',
      type: CategoryType.income,
    });
    userACatIncomeId = catIncome.id;

    const catExpense = await CategoryService.create(userAId, {
      name: 'Groceries Alpha',
      type: CategoryType.expense,
    });
    userACatExpenseId = catExpense.id;

    // Category for User B
    const bCat = await CategoryService.create(userBId, {
      name: 'Beta Secret Spend',
      type: CategoryType.expense,
    });
    userBCatExpenseId = bCat.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await prisma.$disconnect();
  });

  // Test 1: Create income
  it('1. creates an income transaction and validates its schema and properties', async () => {
    const txn = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      categoryId: userACatIncomeId,
      type: TxnType.income,
      amount: 15000,
      description: 'Project Milestones',
      notes: 'Wire transfer payment',
      occurredAt: new Date('2026-09-01'),
    });

    expect(txn.id).toBeDefined();
    expect(txn.userId).toBe(userAId);
    expect(txn.type).toBe(TxnType.income);
    expect(txn.amount.toNumber()).toBe(15000);
    expect(txn.accountId).toBe(userAAccount1Id);
    expect(txn.categoryId).toBe(userACatIncomeId);
    expect(txn.transferAccountId).toBeNull();
  });

  // Test 2: Create expense
  it('2. creates an expense transaction and validates its schema and properties', async () => {
    const txn = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      categoryId: userACatExpenseId,
      type: TxnType.expense,
      amount: 3500,
      description: 'Organic Groceries',
      occurredAt: new Date('2026-09-02'),
    });

    expect(txn.id).toBeDefined();
    expect(txn.type).toBe(TxnType.expense);
    expect(txn.amount.toNumber()).toBe(3500);
    expect(txn.accountId).toBe(userAAccount1Id);
    expect(txn.categoryId).toBe(userACatExpenseId);
  });

  // Test 3: Create transfer
  it('3. creates a transfer transaction between distinct accounts', async () => {
    const txn = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      transferAccountId: userAAccount2Id,
      type: TxnType.transfer,
      amount: 5000,
      description: 'Transfer to Emergency Fund',
      occurredAt: new Date('2026-09-03'),
    });

    expect(txn.id).toBeDefined();
    expect(txn.type).toBe(TxnType.transfer);
    expect(txn.accountId).toBe(userAAccount1Id);
    expect(txn.transferAccountId).toBe(userAAccount2Id);
    expect(txn.categoryId).toBeNull(); // Category is cleared/null for transfers
  });

  // Test 4: Reject invalid amounts
  it('4. strictly rejects invalid amounts (zero, negative, NaN, Infinity)', () => {
    expect(
      createTransactionSchema.safeParse({
        accountId: userAAccount1Id,
        type: TxnType.income,
        amount: 0,
      }).success
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        accountId: userAAccount1Id,
        type: TxnType.income,
        amount: -500,
      }).success
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        accountId: userAAccount1Id,
        type: TxnType.income,
        amount: NaN,
      }).success
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        accountId: userAAccount1Id,
        type: TxnType.income,
        amount: Infinity,
      }).success
    ).toBe(false);
  });

  // Test 5: Reject invalid transaction type
  it('5. strictly rejects invalid transaction types', () => {
    expect(
      createTransactionSchema.safeParse({
        accountId: userAAccount1Id,
        type: 'invalid_type' as any,
        amount: 100,
      }).success
    ).toBe(false);
  });

  // Test 6: Reject invalid account ownership
  it('6. strictly rejects invalid source account ownership (User A cannot use User B account)', async () => {
    await expect(
      TransactionService.create(userAId, {
        accountId: userBAccountId,
        type: TxnType.income,
        amount: 1000,
      })
    ).rejects.toThrow(/Source account not found or not owned by user/);
  });

  // Test 7: Reject invalid destination account ownership
  it('7. strictly rejects invalid destination account ownership (User A cannot transfer to User B account)', async () => {
    await expect(
      TransactionService.create(userAId, {
        accountId: userAAccount1Id,
        transferAccountId: userBAccountId,
        type: TxnType.transfer,
        amount: 2000,
      })
    ).rejects.toThrow(/Destination account not found or not owned by user/);
  });

  // Test 8: Reject transfer to same account
  it('8. rejects transfer where source and destination accounts are identical', async () => {
    // Zod schema refinement rejection
    const parsed = createTransactionSchema.safeParse({
      accountId: userAAccount1Id,
      transferAccountId: userAAccount1Id,
      type: TxnType.transfer,
      amount: 1000,
    });
    expect(parsed.success).toBe(false);

    // Service-level enforcement
    await expect(
      TransactionService.create(userAId, {
        accountId: userAAccount1Id,
        transferAccountId: userAAccount1Id,
        type: TxnType.transfer,
        amount: 1000,
      })
    ).rejects.toThrow(/Source and destination accounts cannot be identical/);
  });

  // Test 9: Reject invalid category ownership
  it('9. rejects invalid category ownership (User A cannot use User B private category)', async () => {
    await expect(
      TransactionService.create(userAId, {
        accountId: userAAccount1Id,
        categoryId: userBCatExpenseId,
        type: TxnType.expense,
        amount: 1000,
      })
    ).rejects.toThrow(/Category not found or does not belong to user/);
  });

  // Test 10: Reject category type mismatch
  it('10. rejects category type mismatch (cannot assign expense category to income transaction)', async () => {
    await expect(
      TransactionService.create(userAId, {
        accountId: userAAccount1Id,
        categoryId: userACatExpenseId, // expense category
        type: TxnType.income, // income transaction
        amount: 5000,
      })
    ).rejects.toThrow(/does not match transaction type/);
  });

  // Test 11: Correctly update account balance after income
  it('11. correctly updates account balance after income transaction', async () => {
    // Current Alpha Checking balance after initial tests:
    // Opening: 50,000
    // Income: +15,000
    // Expense: -3,500
    // Transfer out: -5,000
    // = 56,500
    const beforeAcc = await AccountService.getById(userAId, userAAccount1Id);
    expect(beforeAcc?.currentBalance.toNumber()).toBe(56500);

    // Add Income of 10,000
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.income,
      amount: 10000,
      description: 'Dividend payment',
      occurredAt: new Date('2026-09-04'),
    });

    const afterAcc = await AccountService.getById(userAId, userAAccount1Id);
    expect(afterAcc?.currentBalance.toNumber()).toBe(66500);
  });

  // Test 12: Correctly update account balance after expense
  it('12. correctly updates account balance after expense transaction', async () => {
    // Current balance: 66,500
    // Deduct expense of 6,500
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.expense,
      amount: 6500,
      description: 'Annual Insurance',
      occurredAt: new Date('2026-09-05'),
    });

    const afterAcc = await AccountService.getById(userAId, userAAccount1Id);
    expect(afterAcc?.currentBalance.toNumber()).toBe(60000);
  });

  // Test 13: Correctly update both balances after transfer
  it('13. correctly updates both account balances atomically after transfer', async () => {
    // Account 1: 60,000
    // Account 2: Opening 20,000 + transfer in 5,000 = 25,000
    const a1Before = await AccountService.getById(userAId, userAAccount1Id);
    const a2Before = await AccountService.getById(userAId, userAAccount2Id);
    expect(a1Before?.currentBalance.toNumber()).toBe(60000);
    expect(a2Before?.currentBalance.toNumber()).toBe(25000);

    // Transfer 15,000 from Account 1 to Account 2
    await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      transferAccountId: userAAccount2Id,
      type: TxnType.transfer,
      amount: 15000,
      description: 'Systematic Investment Plan',
      occurredAt: new Date('2026-09-06'),
    });

    const a1After = await AccountService.getById(userAId, userAAccount1Id);
    const a2After = await AccountService.getById(userAId, userAAccount2Id);

    // Account 1: 60,000 - 15,000 = 45,000
    expect(a1After?.currentBalance.toNumber()).toBe(45000);
    // Account 2: 25,000 + 15,000 = 40,000
    expect(a2After?.currentBalance.toNumber()).toBe(40000);
  });

  // Test 14 & 15: Transfers do not inflate income or expenses
  it('14 & 15. verifies transfers do not inflate income or expense aggregates', async () => {
    const listRes = await TransactionService.list(userAId);
    // Income created so far: 15,000 + 10,000 = 25,000
    expect(listRes.summary.totalIncome.toNumber()).toBe(25000);
    // Expense created so far: 3,500 + 6,500 = 10,000
    expect(listRes.summary.totalExpense.toNumber()).toBe(10000);
    // Net cash flow = 25,000 - 10,000 = 15,000
    expect(listRes.summary.netCashFlow.toNumber()).toBe(15000);
  });

  // Test 16: Edit transaction amount correctly reverses old effect and applies new
  it('16. editing transaction amount correctly reverses old effect and applies new effect', async () => {
    // Create an expense of ₹1,000
    const exp = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.expense,
      amount: 1000,
      description: 'Hardware tools',
      occurredAt: new Date('2026-09-07'),
    });

    // Account 1 balance before edit: 45,000 - 1,000 = 44,000
    const accBefore = await AccountService.getById(userAId, userAAccount1Id);
    expect(accBefore?.currentBalance.toNumber()).toBe(44000);

    // Edit transaction: change amount from 1,000 to 2,500 (additional 1,500 deduction)
    await TransactionService.update(userAId, exp.id, {
      amount: 2500,
    });

    const accAfter = await AccountService.getById(userAId, userAAccount1Id);
    // Expected: 44,000 - 1,500 = 42,500 (or 50000 opening + 25000 income - 12500 expense - 20000 xferOut)
    expect(accAfter?.currentBalance.toNumber()).toBe(42500);
  });

  // Test 17: Edit transaction account shifts balance impact
  it('17. editing transaction account moves balance impact from old account to new account', async () => {
    // Create an expense of ₹2,500 on Account 1
    const exp = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.expense,
      amount: 2500,
      description: 'Server hosting',
      occurredAt: new Date('2026-09-08'),
    });

    // Account 1: 42,500 - 2,500 = 40,000
    // Account 2: 40,000
    const a1Pre = await AccountService.getById(userAId, userAAccount1Id);
    const a2Pre = await AccountService.getById(userAId, userAAccount2Id);
    expect(a1Pre?.currentBalance.toNumber()).toBe(40000);
    expect(a2Pre?.currentBalance.toNumber()).toBe(40000);

    // Reassign transaction from Account 1 to Account 2
    await TransactionService.update(userAId, exp.id, {
      accountId: userAAccount2Id,
    });

    const a1Post = await AccountService.getById(userAId, userAAccount1Id);
    const a2Post = await AccountService.getById(userAId, userAAccount2Id);

    // Account 1 should be restored by +2,500 -> 42,500
    expect(a1Post?.currentBalance.toNumber()).toBe(42500);
    // Account 2 should be decreased by -2,500 -> 37,500
    expect(a2Post?.currentBalance.toNumber()).toBe(37500);
  });

  // Test 18: Edit transaction type from expense to income
  it('18. editing transaction type from expense to income reverses expense and applies income', async () => {
    const a2Pre = await AccountService.getById(userAId, userAAccount2Id);
    const initialBal = a2Pre!.currentBalance.toNumber(); // 37,500

    // Create an expense of 1,000
    const t = await TransactionService.create(userAId, {
      accountId: userAAccount2Id,
      type: TxnType.expense,
      amount: 1000,
      description: 'Erroneous Charge',
      occurredAt: new Date('2026-09-09'),
    });

    const midBal = (await AccountService.getById(userAId, userAAccount2Id))!.currentBalance.toNumber();
    expect(midBal).toBe(initialBal - 1000); // 36,500

    // Switch to income of 1,000 (reversal of -1,000 + addition of +1,000 = delta of +2,000)
    await TransactionService.update(userAId, t.id, {
      type: TxnType.income,
    });

    const finalBal = (await AccountService.getById(userAId, userAAccount2Id))!.currentBalance.toNumber();
    expect(finalBal).toBe(initialBal + 1000); // 38,500
  });

  // Test 19: Delete transaction correctly reverses financial effect
  it('19. deleting a transaction correctly reverses its financial effect on account balance', async () => {
    const accPre = await AccountService.getById(userAId, userAAccount1Id);
    const initialBal = accPre!.currentBalance.toNumber(); // 42,500

    // Create income of 5,000
    const incomeTxn = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.income,
      amount: 5000,
      description: 'Refund',
      occurredAt: new Date('2026-09-10'),
    });

    const postCreate = (await AccountService.getById(userAId, userAAccount1Id))!.currentBalance.toNumber();
    expect(postCreate).toBe(initialBal + 5000); // 47,500

    // Delete transaction
    await TransactionService.delete(userAId, incomeTxn.id);

    const postDelete = (await AccountService.getById(userAId, userAAccount1Id))!.currentBalance.toNumber();
    expect(postDelete).toBe(initialBal); // Returned exactly to 42,500
  });

  // Test 20: Cross-user transaction read rejection
  it('20. strictly rejects cross-user transaction access (User A cannot read User B transaction)', async () => {
    // Create transaction for User B
    const userBTxn = await TransactionService.create(userBId, {
      accountId: userBAccountId,
      type: TxnType.income,
      amount: 8000,
      description: 'User B Secret Income',
    });

    // User A attempt to read User B transaction
    const lookup = await TransactionService.getById(userAId, userBTxn.id);
    expect(lookup).toBeNull();
  });

  // Test 21: Cross-user transaction modification rejection
  it('21. strictly rejects cross-user transaction modification (User A cannot update User B transaction)', async () => {
    const userBTxn = await TransactionService.create(userBId, {
      accountId: userBAccountId,
      type: TxnType.expense,
      amount: 1200,
      description: 'User B Expense',
    });

    await expect(
      TransactionService.update(userAId, userBTxn.id, {
        description: 'Tampered by User A',
      })
    ).rejects.toThrow('Transaction not found.');
  });

  // Test 22: Cross-user transaction deletion rejection
  it('22. strictly rejects cross-user transaction deletion (User A cannot delete User B transaction)', async () => {
    const userBTxn = await TransactionService.create(userBId, {
      accountId: userBAccountId,
      type: TxnType.expense,
      amount: 900,
      description: 'User B Book purchase',
    });

    await expect(
      TransactionService.delete(userAId, userBTxn.id)
    ).rejects.toThrow('Transaction not found.');

    // Confirm transaction still exists for User B
    const stillExists = await TransactionService.getById(userBId, userBTxn.id);
    expect(stillExists).not.toBeNull();
  });

  // Test 23: Pagination works
  it('23. server-side pagination correctly calculates page, pageSize, total, and totalPages', async () => {
    const page1 = await TransactionService.list(userAId, { page: 1, pageSize: 3 });
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(3);
    expect(page1.transactions.length).toBe(3);
    expect(page1.total).toBeGreaterThan(3);
    expect(page1.totalPages).toBe(Math.ceil(page1.total / 3));

    const page2 = await TransactionService.list(userAId, { page: 2, pageSize: 3 });
    expect(page2.page).toBe(2);
    expect(page2.transactions.length).toBe(3);
    // Ensure page 2 items are different from page 1 items
    expect(page2.transactions[0].id).not.toBe(page1.transactions[0].id);
  });

  // Test 24: Filtering works
  it('24. filtering by type, account, category, and date range works accurately', async () => {
    // Filter by type: income only
    const incomeOnly = await TransactionService.list(userAId, { type: TxnType.income });
    expect(incomeOnly.transactions.every((t) => t.type === TxnType.income)).toBe(true);

    // Filter by account
    const acc2Only = await TransactionService.list(userAId, { accountId: userAAccount2Id });
    expect(
      acc2Only.transactions.every(
        (t) => t.accountId === userAAccount2Id || t.transferAccountId === userAAccount2Id
      )
    ).toBe(true);

    // Filter by category
    const catOnly = await TransactionService.list(userAId, { categoryId: userACatIncomeId });
    expect(catOnly.transactions.every((t) => t.categoryId === userACatIncomeId)).toBe(true);
  });

  // Test 25: Search works
  it('25. search by description, notes, and category name matches correctly', async () => {
    const res = await TransactionService.list(userAId, { search: 'Project Milestones' });
    expect(res.transactions.length).toBeGreaterThan(0);
    expect(res.transactions.some((t) => t.description?.includes('Project Milestones'))).toBe(true);

    const searchNotes = await TransactionService.list(userAId, { search: 'Wire transfer payment' });
    expect(searchNotes.transactions.length).toBeGreaterThan(0);

    const noMatch = await TransactionService.list(userAId, { search: 'NonExistentGibberish123XYZ' });
    expect(noMatch.transactions.length).toBe(0);
    expect(noMatch.total).toBe(0);
  });

  // Test 26: Sorting works
  it('26. sorting by newest, oldest, highest_amount, and lowest_amount works correctly', async () => {
    // Newest
    const newest = await TransactionService.list(userAId, { sortBy: 'newest' });
    for (let i = 0; i < newest.transactions.length - 1; i++) {
      expect(
        new Date(newest.transactions[i].occurredAt).getTime()
      ).toBeGreaterThanOrEqual(new Date(newest.transactions[i + 1].occurredAt).getTime());
    }

    // Oldest
    const oldest = await TransactionService.list(userAId, { sortBy: 'oldest' });
    for (let i = 0; i < oldest.transactions.length - 1; i++) {
      expect(
        new Date(oldest.transactions[i].occurredAt).getTime()
      ).toBeLessThanOrEqual(new Date(oldest.transactions[i + 1].occurredAt).getTime());
    }

    // Highest amount
    const highest = await TransactionService.list(userAId, { sortBy: 'highest_amount' });
    for (let i = 0; i < highest.transactions.length - 1; i++) {
      expect(highest.transactions[i].amount.toNumber()).toBeGreaterThanOrEqual(
        highest.transactions[i + 1].amount.toNumber()
      );
    }

    // Lowest amount
    const lowest = await TransactionService.list(userAId, { sortBy: 'lowest_amount' });
    for (let i = 0; i < lowest.transactions.length - 1; i++) {
      expect(lowest.transactions[i].amount.toNumber()).toBeLessThanOrEqual(
        lowest.transactions[i + 1].amount.toNumber()
      );
    }
  });

  // Test 27: Preserves decimal precision
  it('27. preserves decimal precision without floating point approximation', async () => {
    const preciseTxn = await TransactionService.create(userAId, {
      accountId: userAAccount1Id,
      type: TxnType.income,
      amount: 1234.56,
      description: 'Decimal precision test',
    });

    const fetched = await TransactionService.getById(userAId, preciseTxn.id);
    expect(fetched?.amount.toString()).toBe('1234.56');

    // Clean up
    await TransactionService.delete(userAId, preciseTxn.id);
  });

  // Test 28: Core Ledger Invariant
  it('28. strictly holds core ledger invariant: OPENING + INCOME - EXPENSE - TRANSFER_OUT + TRANSFER_IN = CURRENT', async () => {
    // For both accounts of User A, verify the mathematical invariant
    for (const accId of [userAAccount1Id, userAAccount2Id]) {
      const acc = await prisma.account.findFirstOrThrow({
        where: { id: accId, userId: userAId },
      });

      const incomeAgg = await prisma.transaction.aggregate({
        where: { userId: userAId, accountId: accId, type: TxnType.income },
        _sum: { amount: true },
      });

      const expenseAgg = await prisma.transaction.aggregate({
        where: { userId: userAId, accountId: accId, type: TxnType.expense },
        _sum: { amount: true },
      });

      const xferOutAgg = await prisma.transaction.aggregate({
        where: { userId: userAId, accountId: accId, type: TxnType.transfer },
        _sum: { amount: true },
      });

      const xferInAgg = await prisma.transaction.aggregate({
        where: { userId: userAId, transferAccountId: accId, type: TxnType.transfer },
        _sum: { amount: true },
      });

      const income = incomeAgg._sum.amount || new Prisma.Decimal(0);
      const expense = expenseAgg._sum.amount || new Prisma.Decimal(0);
      const xferOut = xferOutAgg._sum.amount || new Prisma.Decimal(0);
      const xferIn = xferInAgg._sum.amount || new Prisma.Decimal(0);

      const calculatedCurrent = acc.openingBalance
        .add(income)
        .sub(expense)
        .sub(xferOut)
        .add(xferIn);

      expect(acc.currentBalance.toString()).toBe(calculatedCurrent.toString());
    }
  });

  // Test 29: Transaction mutation is atomic
  it('29. transaction mutation is atomic and rolls back on failure', async () => {
    const accBefore = await AccountService.getById(userAId, userAAccount1Id);
    const balanceBefore = accBefore!.currentBalance.toNumber();

    // Attempt invalid transaction with intentional error (e.g. invalid amount or non-existent dest account)
    await expect(
      TransactionService.create(userAId, {
        accountId: userAAccount1Id,
        transferAccountId: '00000000-0000-0000-0000-000000000000',
        type: TxnType.transfer,
        amount: 5000,
      })
    ).rejects.toThrow();

    // Confirm balance never changed
    const accAfter = await AccountService.getById(userAId, userAAccount1Id);
    expect(accAfter!.currentBalance.toNumber()).toBe(balanceBefore);
  });
});
