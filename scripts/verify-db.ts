import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function runVerification() {
  console.log('🔍 Starting Phase 1 Database Architecture Verification...\n');

  // 1. Connectivity Check
  console.log('1️⃣ Checking Database Connectivity...');
  const ping = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now;`;
  if (!ping || ping.length === 0) {
    throw new Error('Database ping query returned empty result.');
  }
  console.log(`   ✅ Connected to PostgreSQL. Server timestamp: ${ping[0].now.toISOString()}`);

  // 2. Count records across all 13 models
  console.log('\n2️⃣ Verifying All 13 Models & Seed Data Presence...');
  const userCount = await prisma.user.count();
  const accountCount = await prisma.account.count();
  const categoryCount = await prisma.category.count();
  const transactionCount = await prisma.transaction.count();
  const budgetCount = await prisma.budget.count();
  const goalCount = await prisma.financialGoal.count();
  const contributionCount = await prisma.goalContribution.count();
  const recurringCount = await prisma.recurringTransaction.count();
  const notificationCount = await prisma.notification.count();
  const sessionCount = await prisma.session.count();
  const oauthCount = await prisma.oAuthAccount.count();
  const verificationCount = await prisma.verificationToken.count();
  const auditCount = await prisma.auditLog.count();

  console.log(`   - Users: ${userCount}`);
  console.log(`   - Accounts: ${accountCount}`);
  console.log(`   - Categories: ${categoryCount}`);
  console.log(`   - Transactions: ${transactionCount}`);
  console.log(`   - Budgets: ${budgetCount}`);
  console.log(`   - Financial Goals: ${goalCount}`);
  console.log(`   - Goal Contributions: ${contributionCount}`);
  console.log(`   - Recurring Transactions: ${recurringCount}`);
  console.log(`   - Notifications: ${notificationCount}`);
  console.log(`   - Sessions: ${sessionCount}`);
  console.log(`   - OAuth Accounts: ${oauthCount}`);
  console.log(`   - Verification Tokens: ${verificationCount}`);
  console.log(`   - Audit Logs: ${auditCount}`);

  if (userCount === 0 || accountCount === 0 || transactionCount === 0) {
    throw new Error('Seed data missing from core models.');
  }
  console.log('   ✅ All 13 models are defined and accessible via Prisma client.');

  // 3. Primary Key UUID Format Verification
  console.log('\n3️⃣ Verifying Primary Key Formats (UUID)...');
  const sampleUser = await prisma.user.findFirst();
  const sampleAccount = await prisma.account.findFirst();
  const sampleTxn = await prisma.transaction.findFirst();
  const sampleGoal = await prisma.financialGoal.findFirst();

  if (!sampleUser || !UUID_REGEX.test(sampleUser.id)) {
    throw new Error(`User ID is not a valid UUID: ${sampleUser?.id}`);
  }
  if (!sampleAccount || !UUID_REGEX.test(sampleAccount.id)) {
    throw new Error(`Account ID is not a valid UUID: ${sampleAccount?.id}`);
  }
  if (!sampleTxn || !UUID_REGEX.test(sampleTxn.id)) {
    throw new Error(`Transaction ID is not a valid UUID: ${sampleTxn?.id}`);
  }
  if (!sampleGoal || !UUID_REGEX.test(sampleGoal.id)) {
    throw new Error(`FinancialGoal ID is not a valid UUID: ${sampleGoal?.id}`);
  }
  console.log('   ✅ Primary keys conform to RFC 4122 UUID format.');

  // 4. Decimal Monetary Precision Verification
  console.log('\n4️⃣ Verifying Monetary Fields are Decimal...');
  if (!(sampleAccount.currentBalance instanceof Prisma.Decimal)) {
    throw new Error('Account currentBalance is not a Prisma.Decimal instance.');
  }
  if (!(sampleTxn.amount instanceof Prisma.Decimal)) {
    throw new Error('Transaction amount is not a Prisma.Decimal instance.');
  }
  if (!(sampleGoal.targetAmount instanceof Prisma.Decimal)) {
    throw new Error('FinancialGoal targetAmount is not a Prisma.Decimal instance.');
  }
  console.log(`   ✅ Account balance: ${sampleAccount.currentBalance.toFixed(2)} (Decimal)`);
  console.log(`   ✅ Transaction amount: ${sampleTxn.amount.toFixed(2)} (Decimal)`);
  console.log(`   ✅ Financial Goal target: ${sampleGoal.targetAmount.toFixed(2)} (Decimal)`);

  // 5. Relational Graph Traversal Check
  console.log('\n5️⃣ Verifying Relationships & Foreign Keys...');
  const userGraph = await prisma.user.findFirst({
    where: { email: 'alex@finora.test' },
    include: {
      accounts: {
        include: {
          transactions: {
            take: 3,
            include: {
              category: true,
              goalContribution: {
                include: {
                  goal: true,
                },
              },
            },
          },
        },
      },
      budgets: {
        include: {
          category: true,
        },
      },
      goals: {
        include: {
          contributions: true,
        },
      },
      recurring: true,
      notifications: true,
    },
  });

  if (!userGraph) throw new Error('Could not find Alex Rivera user graph.');
  console.log(`   ✅ Found User: ${userGraph.name} (${userGraph.id})`);
  console.log(`      - Accounts linked: ${userGraph.accounts.length}`);
  console.log(`      - Budgets linked: ${userGraph.budgets.length}`);
  console.log(`      - Goals linked: ${userGraph.goals.length}`);
  console.log(`      - Recurring linked: ${userGraph.recurring.length}`);
  console.log(`      - Notifications linked: ${userGraph.notifications.length}`);

  // Test contribution link
  const sampleContrib = await prisma.goalContribution.findFirst({
    include: {
      goal: true,
      transaction: true,
    },
  });
  if (sampleContrib) {
    console.log(`   ✅ Verified GoalContribution links:`);
    console.log(`      Goal: "${sampleContrib.goal.name}" ← Amount: ${sampleContrib.amount} → Txn: "${sampleContrib.transaction?.description || sampleContrib.transaction?.id || 'Direct Entry'}"`);
  }

  // 6. Restrict & Cascade Constraints Verification
  console.log('\n6️⃣ Verifying Foreign Key Delete Constraints (Cascade & Restrict)...');
  
  // Create a temporary isolated user to test deletion behaviors
  const testUser = await prisma.user.create({
    data: {
      email: `test_constraints_${Date.now()}@finora.test`,
      name: 'Constraint Tester',
      currency: 'INR',
    },
  });

  const testAccount = await prisma.account.create({
    data: {
      userId: testUser.id,
      name: 'Constraint Checking Acc',
      type: 'bank',
      currency: 'INR',
      openingBalance: new Prisma.Decimal(500),
      currentBalance: new Prisma.Decimal(500),
    },
  });

  const testTxn = await prisma.transaction.create({
    data: {
      userId: testUser.id,
      accountId: testAccount.id,
      type: 'expense',
      amount: new Prisma.Decimal(100),
      currency: 'INR',
      occurredAt: new Date(),
    },
  });

  // Test RESTRICT on Account deletion when transactions exist
  let restrictCaught = false;
  try {
    const res = await prisma.account.delete({
      where: { id: testAccount.id },
    });
    console.log('UNEXPECTED: Account delete succeeded:', res);
  } catch (err: any) {
    if (
      err.code === 'P2003' ||
      err.code === '23001' ||
      err.message?.includes('violates RESTRICT setting') ||
      err.message?.includes('Foreign key constraint failed') ||
      err.message?.includes('violates foreign key constraint')
    ) {
      restrictCaught = true;
    }
  }

  if (!restrictCaught) {
    throw new Error('FAIL: Deleting account with transactions did not trigger RESTRICT constraint!');
  }
  console.log('   ✅ Account → Transaction RESTRICT constraint verified (cannot delete account with history).');

  // Test CASCADE on User deletion
  await prisma.user.delete({
    where: { id: testUser.id },
  });

  const orphanedTxn = await prisma.transaction.findUnique({
    where: { id: testTxn.id },
  });
  const orphanedAcc = await prisma.account.findUnique({
    where: { id: testAccount.id },
  });

  if (orphanedTxn !== null || orphanedAcc !== null) {
    throw new Error('FAIL: Deleting user did not CASCADE delete accounts and transactions!');
  }
  console.log('   ✅ User CASCADE delete verified (deleting user safely and completely cleans up owned data).');

  console.log('\n🎉 ALL PHASE 1 DATABASE VERIFICATIONS PASSED SUCCESSFULLY!');
}

runVerification()
  .catch((err) => {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
