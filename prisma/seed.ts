import { PrismaClient, AccountType, TxnType, CategoryType, BudgetPeriod, GoalStatus, NotifType, RecurFrequency, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Pseudo-random deterministic number generator
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

async function main() {
  console.log('🌱 Starting Finora database seed...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed System Default Categories
  console.log('📁 Creating system default categories...');
  const systemCategoriesData = [
    // Income
    { name: 'Salary', type: CategoryType.income, icon: 'Briefcase', color: '#10b981' },
    { name: 'Freelance & Consulting', type: CategoryType.income, icon: 'Laptop', color: '#3b82f6' },
    { name: 'Investments & Dividends', type: CategoryType.income, icon: 'TrendingUp', color: '#8b5cf6' },
    { name: 'Bonus & Grants', type: CategoryType.income, icon: 'Gift', color: '#f59e0b' },
    { name: 'Other Income', type: CategoryType.income, icon: 'Coins', color: '#6b7280' },
    // Expenses
    { name: 'Housing & Rent', type: CategoryType.expense, icon: 'Home', color: '#ef4444' },
    { name: 'Groceries', type: CategoryType.expense, icon: 'ShoppingCart', color: '#f97316' },
    { name: 'Dining & Cafes', type: CategoryType.expense, icon: 'Coffee', color: '#eab308' },
    { name: 'Transportation', type: CategoryType.expense, icon: 'Car', color: '#06b6d4' },
    { name: 'Utilities & Bills', type: CategoryType.expense, icon: 'Zap', color: '#6366f1' },
    { name: 'Entertainment & Leisure', type: CategoryType.expense, icon: 'Film', color: '#ec4899' },
    { name: 'Health & Medical', type: CategoryType.expense, icon: 'HeartPulse', color: '#14b8a6' },
    { name: 'Shopping & Gear', type: CategoryType.expense, icon: 'ShoppingBag', color: '#a855f7' },
    { name: 'Subscriptions & Software', type: CategoryType.expense, icon: 'Layers', color: '#3b82f6' },
    { name: 'Education & Courses', type: CategoryType.expense, icon: 'GraduationCap', color: '#84cc16' },
    { name: 'Travel & Vacations', type: CategoryType.expense, icon: 'Plane', color: '#0ea5e9' },
    { name: 'Personal Care', type: CategoryType.expense, icon: 'Sparkles', color: '#f43f5e' },
    { name: 'Other Expense', type: CategoryType.expense, icon: 'HelpCircle', color: '#9ca3af' },
  ];

  const systemCategories: Record<string, string> = {};
  for (const cat of systemCategoriesData) {
    const existing = await prisma.category.findFirst({
      where: { name: cat.name, type: cat.type, userId: null },
    });
    if (existing) {
      systemCategories[cat.name] = existing.id;
    } else {
      const created = await prisma.category.create({
        data: {
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
          isSystem: true,
          userId: null,
        },
      });
      systemCategories[cat.name] = created.id;
    }
  }

  // 2. Seed Demo Users
  console.log('👤 Seeding demo users...');
  const usersData = [
    {
      email: 'alex@finora.test',
      name: 'Alex Rivera',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
    },
    {
      email: 'sarah@finora.test',
      name: 'Sarah Chen',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
    },
    {
      email: 'rahul@finora.test',
      name: 'Rahul Sharma',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
    },
  ];

  let userIndex = 0;
  for (const u of usersData) {
    userIndex++;
    console.log(`\n  👉 Seeding data for ${u.name} (${u.email})...`);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        currency: u.currency,
        timezone: u.timezone,
        locale: u.locale,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        currency: u.currency,
        timezone: u.timezone,
        locale: u.locale,
        status: 'active',
      },
    });

    const userId = user.id;

    // Custom categories per user
    const customCats = [
      { name: 'Fitness & Gym', type: CategoryType.expense, icon: 'Dumbbell', color: '#10b981' },
      { name: 'Pet Care', type: CategoryType.expense, icon: 'Dog', color: '#f59e0b' },
    ];
    for (const c of customCats) {
      await prisma.category.upsert({
        where: { id: `custom-${c.name.toLowerCase().replace(/\s+/g, '-')}-${userId}` },
        update: {},
        create: {
          id: `custom-${c.name.toLowerCase().replace(/\s+/g, '-')}-${userId}`,
          name: c.name,
          type: c.type,
          icon: c.icon,
          color: c.color,
          isSystem: false,
          userId,
        },
      });
    }

    // Accounts
    const accountsData = [
      { name: 'HDFC Salary Bank', type: AccountType.bank, opening: new Prisma.Decimal(25000), color: '#3b82f6', icon: 'Building' },
      { name: 'Cash Wallet', type: AccountType.cash, opening: new Prisma.Decimal(3000), color: '#10b981', icon: 'Wallet' },
      { name: 'ICICI Sapphiro Card', type: AccountType.credit_card, opening: new Prisma.Decimal(0), color: '#ef4444', icon: 'CreditCard', creditLimit: new Prisma.Decimal(200000) },
      { name: 'Zerodha Trading', type: AccountType.investment, opening: new Prisma.Decimal(50000), color: '#8b5cf6', icon: 'TrendingUp' },
    ];

    const accountIds: Record<string, string> = {};
    for (const acc of accountsData) {
      const existing = await prisma.account.findUnique({
        where: { userId_name: { userId, name: acc.name } },
      });
      if (existing) {
        accountIds[acc.name] = existing.id;
      } else {
        const created = await prisma.account.create({
          data: {
            userId,
            name: acc.name,
            type: acc.type,
            currency: 'INR',
            openingBalance: acc.opening,
            currentBalance: acc.opening,
            color: acc.color,
            icon: acc.icon,
            creditLimit: acc.creditLimit,
          },
        });
        accountIds[acc.name] = created.id;
      }
    }

    const salaryAccId = accountIds['HDFC Salary Bank'];
    const cashAccId = accountIds['Cash Wallet'];
    const cardAccId = accountIds['ICICI Sapphiro Card'];
    const investAccId = accountIds['Zerodha Trading'];

    // Generate Transactions over past 12 months
    const rand = seededRandom(42 + userIndex * 100);
    const now = new Date();
    const transactionsToInsert: Prisma.TransactionCreateManyInput[] = [];

    // Monthly regular salary and rent
    for (let m = 12; m >= 0; m--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      
      // Salary on 1st of month
      const salaryAmount = userIndex === 1 ? 95000 : userIndex === 2 ? 120000 : 35000;
      transactionsToInsert.push({
        userId,
        accountId: salaryAccId,
        categoryId: systemCategories['Salary'],
        type: TxnType.income,
        amount: new Prisma.Decimal(salaryAmount),
        currency: 'INR',
        description: 'Monthly Salary Credit',
        occurredAt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 9, 30),
      });

      // Rent on 3rd of month
      const rentAmount = userIndex === 1 ? 25000 : userIndex === 2 ? 32000 : 12000;
      transactionsToInsert.push({
        userId,
        accountId: salaryAccId,
        categoryId: systemCategories['Housing & Rent'],
        type: TxnType.expense,
        amount: new Prisma.Decimal(rentAmount),
        currency: 'INR',
        description: 'Apartment Rent Payment',
        occurredAt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 3, 11, 0),
      });

      // Utilities on 10th of month
      transactionsToInsert.push({
        userId,
        accountId: salaryAccId,
        categoryId: systemCategories['Utilities & Bills'],
        type: TxnType.expense,
        amount: new Prisma.Decimal(Math.round(2000 + rand() * 1500)),
        currency: 'INR',
        description: 'Electricity & High-speed Broadband',
        occurredAt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 10, 14, 0),
      });

      // Subscriptions on 15th of month
      transactionsToInsert.push({
        userId,
        accountId: cardAccId,
        categoryId: systemCategories['Subscriptions & Software'],
        type: TxnType.expense,
        amount: new Prisma.Decimal(1199),
        currency: 'INR',
        description: 'Cloud & Entertainment Subscriptions',
        occurredAt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 15, 10, 0),
      });

      // ATM cash withdrawal (transfer from salary to cash)
      transactionsToInsert.push({
        userId,
        accountId: salaryAccId,
        transferAccountId: cashAccId,
        type: TxnType.transfer,
        amount: new Prisma.Decimal(5000),
        currency: 'INR',
        description: 'ATM Cash Withdrawal',
        occurredAt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 5, 16, 0),
      });

      // Investment SIP (transfer from salary to investment)
      transactionsToInsert.push({
        userId,
        accountId: salaryAccId,
        transferAccountId: investAccId,
        type: TxnType.transfer,
        amount: new Prisma.Decimal(15000),
        currency: 'INR',
        description: 'Monthly Index Fund SIP',
        occurredAt: new Date(monthDate.getFullYear(), monthDate.getMonth(), 7, 10, 0),
      });

      // Daily/Weekly variable expenses
      const daysInMonth = 28;
      for (let d = 2; d <= daysInMonth; d += 2) {
        const dayDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), d, 12 + Math.floor(rand() * 8), Math.floor(rand() * 59));
        
        // Groceries
        if (d % 6 === 0) {
          transactionsToInsert.push({
            userId,
            accountId: cardAccId,
            categoryId: systemCategories['Groceries'],
            type: TxnType.expense,
            amount: new Prisma.Decimal(Math.round(800 + rand() * 2200)),
            currency: 'INR',
            description: 'Supermarket & Fresh Groceries',
            occurredAt: dayDate,
          });
        }

        // Dining & Cafes
        if (d % 4 === 0) {
          transactionsToInsert.push({
            userId,
            accountId: cardAccId,
            categoryId: systemCategories['Dining & Cafes'],
            type: TxnType.expense,
            amount: new Prisma.Decimal(Math.round(350 + rand() * 1200)),
            currency: 'INR',
            description: 'Cafe / Dinner Outing',
            occurredAt: dayDate,
          });
        }

        // Transportation (metro / cab / fuel)
        if (d % 3 === 0) {
          transactionsToInsert.push({
            userId,
            accountId: cashAccId,
            categoryId: systemCategories['Transportation'],
            type: TxnType.expense,
            amount: new Prisma.Decimal(Math.round(100 + rand() * 450)),
            currency: 'INR',
            description: 'Metro Recharge / Cab Ride',
            occurredAt: dayDate,
          });
        }

        // Occasional Shopping
        if (d === 18 && rand() > 0.4) {
          transactionsToInsert.push({
            userId,
            accountId: cardAccId,
            categoryId: systemCategories['Shopping & Gear'],
            type: TxnType.expense,
            amount: new Prisma.Decimal(Math.round(2500 + rand() * 6000)),
            currency: 'INR',
            description: 'Online Retail & Electronics',
            occurredAt: dayDate,
          });
        }
      }
    }

    console.log(`    Creating ${transactionsToInsert.length} realistic ledger entries...`);
    await prisma.transaction.createMany({
      data: transactionsToInsert,
    });

    // Recompute current balances for each account from ledger
    console.log('    Updating account current_balances from transaction ledger...');
    const allUserAccounts = await prisma.account.findMany({ where: { userId } });
    for (const acc of allUserAccounts) {
      // Income transactions
      const incomeSum = await prisma.transaction.aggregate({
        where: { accountId: acc.id, type: TxnType.income },
        _sum: { amount: true },
      });
      // Expense transactions
      const expenseSum = await prisma.transaction.aggregate({
        where: { accountId: acc.id, type: TxnType.expense },
        _sum: { amount: true },
      });
      // Transfer outbound
      const transferOutSum = await prisma.transaction.aggregate({
        where: { accountId: acc.id, type: TxnType.transfer },
        _sum: { amount: true },
      });
      // Transfer inbound
      const transferInSum = await prisma.transaction.aggregate({
        where: { transferAccountId: acc.id, type: TxnType.transfer },
        _sum: { amount: true },
      });

      const income = incomeSum._sum.amount || new Prisma.Decimal(0);
      const expense = expenseSum._sum.amount || new Prisma.Decimal(0);
      const xferOut = transferOutSum._sum.amount || new Prisma.Decimal(0);
      const xferIn = transferInSum._sum.amount || new Prisma.Decimal(0);

      const computedBalance = acc.openingBalance.add(income).sub(expense).sub(xferOut).add(xferIn);

      await prisma.account.update({
        where: { id: acc.id },
        data: { currentBalance: computedBalance },
      });
    }

    // 3. Seed Budgets for current month
    console.log('    Seeding monthly category budgets...');
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const budgetsData = [
      { catName: 'Groceries', amount: 12000, rollover: true, alertThreshold: 80 },
      { catName: 'Dining & Cafes', amount: 6000, rollover: false, alertThreshold: 85 },
      { catName: 'Transportation', amount: 4500, rollover: false, alertThreshold: 80 },
      { catName: 'Shopping & Gear', amount: 8000, rollover: true, alertThreshold: 75 },
      { catName: 'Entertainment & Leisure', amount: 4000, rollover: false, alertThreshold: 90 },
    ];

    for (const b of budgetsData) {
      const catId = systemCategories[b.catName];
      if (catId) {
        await prisma.budget.upsert({
          where: {
            userId_categoryId_period_periodStart: {
              userId,
              categoryId: catId,
              period: BudgetPeriod.monthly,
              periodStart: currentMonthStart,
            },
          },
          update: {},
          create: {
            userId,
            categoryId: catId,
            amount: new Prisma.Decimal(b.amount),
            period: BudgetPeriod.monthly,
            periodStart: currentMonthStart,
            rolloverEnabled: b.rollover,
            alertThresholdPct: b.alertThreshold,
          },
        });
      }
    }

    // 4. Seed Financial Goals
    console.log('    Seeding financial goals and contributions...');
    const goalsData = [
      {
        name: 'Emergency Fund (6 Months)',
        target: 300000,
        current: 185000,
        targetDate: new Date(now.getFullYear() + 1, 5, 30),
        accountId: salaryAccId,
        icon: 'Shield',
        color: '#10b981',
      },
      {
        name: 'Europe Summer Vacation',
        target: 150000,
        current: 65000,
        targetDate: new Date(now.getFullYear(), 11, 20),
        accountId: salaryAccId,
        icon: 'Palmtree',
        color: '#3b82f6',
      },
      {
        name: 'New MacBook Pro',
        target: 200000,
        current: 190000,
        targetDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
        accountId: salaryAccId,
        icon: 'Laptop',
        color: '#8b5cf6',
      },
    ];

    for (const g of goalsData) {
      await prisma.financialGoal.create({
        data: {
          userId,
          name: g.name,
          targetAmount: new Prisma.Decimal(g.target),
          currentAmount: new Prisma.Decimal(g.current),
          targetDate: g.targetDate,
          accountId: g.accountId,
          icon: g.icon,
          color: g.color,
          status: GoalStatus.active,
        },
      });
    }

    // 5. Seed Recurring Transactions
    console.log('    Seeding recurring schedules...');
    const recurringData = [
      {
        desc: 'Monthly Salary Deposit',
        type: TxnType.income,
        amount: 95000,
        freq: RecurFrequency.monthly,
        cat: systemCategories['Salary'],
        acc: salaryAccId,
        nextRun: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
      {
        desc: 'Apartment Rent Lease',
        type: TxnType.expense,
        amount: 25000,
        freq: RecurFrequency.monthly,
        cat: systemCategories['Housing & Rent'],
        acc: salaryAccId,
        nextRun: new Date(now.getFullYear(), now.getMonth() + 1, 3),
      },
      {
        desc: 'Netflix & Spotify Bundle',
        type: TxnType.expense,
        amount: 1199,
        freq: RecurFrequency.monthly,
        cat: systemCategories['Subscriptions & Software'],
        acc: cardAccId,
        nextRun: new Date(now.getFullYear(), now.getMonth() + 1, 15),
      },
      {
        desc: 'Health Insurance Premium',
        type: TxnType.expense,
        amount: 18500,
        freq: RecurFrequency.yearly,
        cat: systemCategories['Health & Medical'],
        acc: salaryAccId,
        nextRun: new Date(now.getFullYear() + 1, 2, 15),
      },
    ];

    for (const r of recurringData) {
      await prisma.recurringTransaction.create({
        data: {
          userId,
          accountId: r.acc,
          categoryId: r.cat,
          type: r.type,
          amount: new Prisma.Decimal(r.amount),
          description: r.desc,
          frequency: r.freq,
          interval: 1,
          startDate: new Date(now.getFullYear(), 0, 1),
          nextRunAt: r.nextRun,
          isActive: true,
        },
      });
    }

    // 6. Seed Notifications
    console.log('    Seeding in-app notifications...');
    await prisma.notification.createMany({
      data: [
        {
          userId,
          type: NotifType.budget_alert,
          title: 'Dining & Cafes budget reached 88%',
          body: 'You have spent Rs. 5,280 of your Rs. 6,000 monthly dining limit.',
          linkUrl: '/budgets',
          isRead: false,
          createdAt: new Date(now.getTime() - 2 * 3600 * 1000),
        },
        {
          userId,
          type: NotifType.goal_milestone,
          title: 'New MacBook Pro goal is 95% complete!',
          body: 'Just Rs. 10,000 remaining to reach your goal.',
          linkUrl: '/goals',
          isRead: false,
          createdAt: new Date(now.getTime() - 24 * 3600 * 1000),
        },
        {
          userId,
          type: NotifType.recurring_due,
          title: 'Recurring rent payment coming up',
          body: 'Rs. 25,000 for Apartment Rent is scheduled for the 3rd.',
          linkUrl: '/recurring',
          isRead: true,
          createdAt: new Date(now.getTime() - 72 * 3600 * 1000),
        },
      ],
    });
  }

  console.log('\n✅ Finora database seeded successfully with realistic fintech data!');
  console.log('👉 Demo Credentials:');
  console.log('   Email: alex@finora.test | Password: Password123!');
  console.log('   Email: sarah@finora.test | Password: Password123!');
  console.log('   Email: rahul@finora.test | Password: Password123!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
