import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/server/db/prisma';
import { AuthService } from '@/server/auth/auth.service';
import { registerSchema, loginSchema } from '@/lib/validation/auth.schema';
import { AccountService } from '@/server/services/account.service';
import { TransactionService } from '@/server/services/transaction.service';
import { BudgetService } from '@/server/services/budget.service';
import { GoalService } from '@/server/services/goal.service';
import { NotificationService } from '@/server/services/notification.service';
import { TxnType, AccountType, BudgetPeriod } from '@prisma/client';

describe('Phase 3 — Authentication & Authorization Suite', () => {
  const userAEmail = `test_user_a_${Date.now()}@finora.test`;
  const userBEmail = `test_user_b_${Date.now()}@finora.test`;
  let userAId: string;
  let userBId: string;
  let userASessionToken: string;

  let userAAccountId: string;
  let userBAccountId: string;
  let userATxnId: string;
  let userBTxnId: string;
  let userABudgetId: string;
  let userBBudgetId: string;
  let userAGoalId: string;
  let userBGoalId: string;
  let userANotifId: string;
  let userBNotifId: string;

  beforeAll(async () => {
    // Ensure clean state for test run
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
  });

  afterAll(async () => {
    // Cascade delete test users and their data
    if (userAId) {
      await prisma.user.deleteMany({ where: { id: userAId } });
    }
    if (userBId) {
      await prisma.user.deleteMany({ where: { id: userBId } });
    }
    await prisma.$disconnect();
  });

  // 1. Valid Registration
  it('1. performs valid registration with secure password hashing and default accounts', async () => {
    const regResult = await AuthService.register({
      name: 'User Alpha',
      email: userAEmail,
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
    });

    expect(regResult.user).toBeDefined();
    expect(regResult.user.email).toBe(userAEmail.toLowerCase().trim());
    expect(regResult.sessionToken).toBeDefined();

    userAId = regResult.user.id;
    userASessionToken = regResult.sessionToken;

    // Verify password is NOT stored as plaintext in DB
    const dbUser = await prisma.user.findUnique({
      where: { id: userAId },
    });
    expect(dbUser?.passwordHash).toBeDefined();
    expect(dbUser?.passwordHash).not.toBe('SecurePassword123!');
    expect(dbUser?.passwordHash?.startsWith('$2')).toBe(true); // bcrypt hash prefix

    // Verify starter accounts were created
    const starterAccounts = await prisma.account.findMany({
      where: { userId: userAId },
    });
    expect(starterAccounts.length).toBeGreaterThanOrEqual(2);
    userAAccountId = starterAccounts[0].id;
  });

  // 2. Duplicate Email Registration
  it('2. rejects registration with duplicate email address', async () => {
    await expect(
      AuthService.register({
        name: 'Imposter Alpha',
        email: userAEmail, // Duplicate
        password: 'AnotherPassword123!',
        confirmPassword: 'AnotherPassword123!',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        locale: 'en-IN',
      })
    ).rejects.toThrow('An account with this email already exists.');
  });

  // 3. Invalid Email Format Validation
  it('3. rejects registration with invalid email formats via Zod schema', () => {
    const invalidEmails = ['not-an-email', 'missingatsign.com', '@nodomain.com', 'spaces in@email.com'];
    for (const email of invalidEmails) {
      const res = registerSchema.safeParse({
        name: 'Test Name',
        email,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      expect(res.success).toBe(false);
    }
  });

  // 4. Weak Password Rejection
  it('4. rejects weak passwords that fail minimum complexity criteria', () => {
    const weakPasswords = [
      'short', // < 8 chars
      'alllowercase123!', // No uppercase
      'ALLUPPERCASE123!', // No lowercase
      'NoNumbersHere!', // No numbers
      'NoSpecialChar123', // No special character
    ];

    for (const password of weakPasswords) {
      const res = registerSchema.safeParse({
        name: 'Test Name',
        email: 'test@example.com',
        password,
        confirmPassword: password,
      });
      expect(res.success).toBe(false);
    }
  });

  // 5. Password Mismatch Rejection
  it('5. rejects registration when password and confirmation mismatch', () => {
    const res = registerSchema.safeParse({
      name: 'Test Name',
      email: 'test@example.com',
      password: 'StrongPassword123!',
      confirmPassword: 'DifferentPassword123!',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe('Passwords do not match');
    }
  });

  // 6. Valid Login & Session Creation
  it('6. validates valid credentials and creates an active database session', async () => {
    const loginResult = await AuthService.login({
      email: userAEmail,
      password: 'SecurePassword123!',
    });

    expect(loginResult.user.id).toBe(userAId);
    expect(loginResult.sessionToken).toBeDefined();

    // Verify session row exists in `sessions` table
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: loginResult.sessionToken },
    });
    expect(dbSession).toBeDefined();
    expect(dbSession?.userId).toBe(userAId);
    expect(dbSession?.expires.getTime()).toBeGreaterThan(Date.now());
  });

  // 7. Invalid Login (Wrong Password & Non-existent Email)
  it('7. returns generic authentication error without email enumeration risk', async () => {
    // Wrong password for existing user
    await expect(
      AuthService.login({
        email: userAEmail,
        password: 'WrongPassword999!',
      })
    ).rejects.toThrow('Invalid email or password.');

    // Non-existent email
    await expect(
      AuthService.login({
        email: 'does_not_exist_404@finora.test',
        password: 'SomePassword123!',
      })
    ).rejects.toThrow('Invalid email or password.');
  });

  // 8. Logout & Session Invalidation
  it('8. invalidates session on logout so token can no longer be used', async () => {
    // Verify session is valid before logout
    const validUserBefore = await AuthService.validateSession(userASessionToken);
    expect(validUserBefore).not.toBeNull();
    expect(validUserBefore?.id).toBe(userAId);

    // Invalidate session
    await AuthService.invalidateSession(userASessionToken);

    // Verify session is now invalid/null
    const validUserAfter = await AuthService.validateSession(userASessionToken);
    expect(validUserAfter).toBeNull();
  });

  // 9. Protected Route Simulation: Missing Session
  it('9. denies access when session token is missing or invalid', async () => {
    const invalidToken = 'non-existent-fake-session-token-12345';
    const user = await AuthService.validateSession(invalidToken);
    expect(user).toBeNull();

    const emptyToken = '';
    const userEmpty = await AuthService.validateSession(emptyToken);
    expect(userEmpty).toBeNull();
  });

  // 10. Authenticated Protected Route: Active Session
  it('10. resolves user identity directly from active session token', async () => {
    // Create fresh session for User A
    const { sessionToken } = await AuthService.createSession(userAId);
    const resolved = await AuthService.validateSession(sessionToken);

    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(userAId);
    expect(resolved?.email).toBe(userAEmail);
  });

  // 11. User A CANNOT Access User B Data (Critical Security Isolation)
  it('11. strictly prevents User A from reading, editing, or deleting User B data', async () => {
    // Register User B
    const userBReg = await AuthService.register({
      name: 'User Beta',
      email: userBEmail,
      password: 'BetaPassword123!',
      confirmPassword: 'BetaPassword123!',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
    });
    userBId = userBReg.user.id;

    const userBAccounts = await prisma.account.findMany({ where: { userId: userBId } });
    userBAccountId = userBAccounts[0].id;

    // Create User B Transaction
    const bTxn = await TransactionService.create(userBId, {
      accountId: userBAccountId,
      type: TxnType.income,
      amount: 15000,
      currency: 'INR',
      description: 'User B Confidential Paycheck',
      occurredAt: new Date(),
    });
    userBTxnId = bTxn.id;

    // Create User B Category & Budget
    const bCat = await prisma.category.create({
      data: {
        userId: userBId,
        name: 'User B Secret Category',
        type: 'expense',
      },
    });

    const bBudget = await BudgetService.upsert(userBId, {
      categoryId: bCat.id,
      amount: 5000,
      period: BudgetPeriod.monthly,
      periodStart: new Date(),
      rolloverEnabled: false,
      alertThresholdPct: 80,
    });
    userBBudgetId = bBudget.id;

    // Create User B Goal
    const bGoal = await GoalService.create(userBId, {
      name: 'User B Private Goal',
      targetAmount: 50000,
    });
    userBGoalId = bGoal.id;

    // Create User B Notification
    const bNotif = await prisma.notification.create({
      data: {
        userId: userBId,
        type: 'system',
        title: 'User B Private Alert',
      },
    });
    userBNotifId = bNotif.id;

    // --- VERIFY USER A CANNOT READ USER B DATA ---
    const readAccount = await AccountService.getById(userAId, userBAccountId);
    expect(readAccount).toBeNull();

    const readTxn = await TransactionService.getById(userAId, userBTxnId);
    expect(readTxn).toBeNull();

    const readGoal = await GoalService.getById(userAId, userBGoalId);
    expect(readGoal).toBeNull();

    const userANotifs = await NotificationService.list(userAId);
    expect(userANotifs.some((n) => n.id === userBNotifId)).toBe(false);

    // --- VERIFY USER A CANNOT EDIT USER B DATA ---
    await expect(
      AccountService.update(userAId, userBAccountId, { name: 'Hacked Name' })
    ).rejects.toThrow('Account not found');

    await expect(
      TransactionService.update(userAId, userBTxnId, { description: 'Hacked Description' })
    ).rejects.toThrow('Transaction not found.');

    await expect(
      GoalService.update(userAId, userBGoalId, { name: 'Hacked Goal' })
    ).rejects.toThrow('Goal not found.');

    // --- VERIFY USER A CANNOT DELETE USER B DATA ---
    await expect(
      AccountService.delete(userAId, userBAccountId)
    ).rejects.toThrow('Account not found');

    await expect(
      TransactionService.delete(userAId, userBTxnId)
    ).rejects.toThrow('Transaction not found.');

    await expect(
      BudgetService.delete(userAId, userBBudgetId)
    ).rejects.toThrow('Budget not found.');

    await expect(
      GoalService.delete(userAId, userBGoalId)
    ).rejects.toThrow('Goal not found.');

    // Notification delete uses deleteMany with userId scope
    await NotificationService.delete(userAId, userBNotifId);
    const stillExistsNotif = await prisma.notification.findUnique({ where: { id: userBNotifId } });
    expect(stillExistsNotif).not.toBeNull();
  });

  // 12. User B CANNOT Access User A Data (Reverse Isolation)
  it('12. strictly prevents User B from reading, editing, or deleting User A data', async () => {
    // Create User A Transaction
    const aTxn = await TransactionService.create(userAId, {
      accountId: userAAccountId,
      type: TxnType.expense,
      amount: 2500,
      currency: 'INR',
      description: 'User A Private Grocery Bill',
      occurredAt: new Date(),
    });
    userATxnId = aTxn.id;

    // Create User A Category & Budget
    const aCat = await prisma.category.create({
      data: {
        userId: userAId,
        name: 'User A Secret Category',
        type: 'expense',
      },
    });

    const aBudget = await BudgetService.upsert(userAId, {
      categoryId: aCat.id,
      amount: 10000,
      period: BudgetPeriod.monthly,
      periodStart: new Date(),
      rolloverEnabled: false,
      alertThresholdPct: 80,
    });
    userABudgetId = aBudget.id;

    // Create User A Goal
    const aGoal = await GoalService.create(userAId, {
      name: 'User A Private Goal',
      targetAmount: 80000,
    });
    userAGoalId = aGoal.id;

    // Create User A Notification
    const aNotif = await prisma.notification.create({
      data: {
        userId: userAId,
        type: 'system',
        title: 'User A Private Alert',
      },
    });
    userANotifId = aNotif.id;

    // --- VERIFY USER B CANNOT READ USER A DATA ---
    const readAccount = await AccountService.getById(userBId, userAAccountId);
    expect(readAccount).toBeNull();

    const readTxn = await TransactionService.getById(userBId, userATxnId);
    expect(readTxn).toBeNull();

    const readGoal = await GoalService.getById(userBId, userAGoalId);
    expect(readGoal).toBeNull();

    const userBNotifs = await NotificationService.list(userBId);
    expect(userBNotifs.some((n) => n.id === userANotifId)).toBe(false);

    // --- VERIFY USER B CANNOT EDIT USER A DATA ---
    await expect(
      AccountService.update(userBId, userAAccountId, { name: 'User B Hacked Acc' })
    ).rejects.toThrow('Account not found');

    await expect(
      TransactionService.update(userBId, userATxnId, { description: 'User B Hacked Txn' })
    ).rejects.toThrow('Transaction not found.');

    await expect(
      GoalService.update(userBId, userAGoalId, { name: 'User B Hacked Goal' })
    ).rejects.toThrow('Goal not found.');

    // --- VERIFY USER B CANNOT DELETE USER A DATA ---
    await expect(
      AccountService.delete(userBId, userAAccountId)
    ).rejects.toThrow('Account not found');

    await expect(
      TransactionService.delete(userBId, userATxnId)
    ).rejects.toThrow('Transaction not found.');

    await expect(
      BudgetService.delete(userBId, userABudgetId)
    ).rejects.toThrow('Budget not found.');

    await expect(
      GoalService.delete(userBId, userAGoalId)
    ).rejects.toThrow('Goal not found.');

    // User B attempts to delete User A notification
    await NotificationService.delete(userBId, userANotifId);
    const stillExistsNotif = await prisma.notification.findUnique({ where: { id: userANotifId } });
    expect(stillExistsNotif).not.toBeNull();
  });
});
