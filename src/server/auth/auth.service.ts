import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/server/db/prisma';
import { RegisterInput, LoginInput } from '@/lib/validation/auth.schema';
import { AccountType, Prisma } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  currency: string;
  timezone: string;
  locale: string;
  avatarUrl: string | null;
}

export class AuthService {
  /**
   * Hashes a plaintext password using bcrypt with cost factor 12.
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compares plaintext password against a bcrypt hash.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Creates a revocable database session row in the `sessions` table.
   */
  static async createSession(userId: string): Promise<{ sessionToken: string; expires: Date }> {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        sessionToken,
        userId,
        expires,
      },
    });

    return { sessionToken, expires };
  }

  /**
   * Validates a session token from the database.
   * Revocable server-side immediately if deleted from `sessions`.
   */
  static async validateSession(sessionToken: string): Promise<SessionUser | null> {
    if (!sessionToken) return null;

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            currency: true,
            timezone: true,
            locale: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    if (!session) return null;

    // Check expiry
    if (session.expires < new Date()) {
      await prisma.session.delete({ where: { sessionToken } }).catch(() => {});
      return null;
    }

    if (session.user.status !== 'active') {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      currency: session.user.currency,
      timezone: session.user.timezone,
      locale: session.user.locale,
      avatarUrl: session.user.avatarUrl,
    };
  }

  /**
   * Revokes a single session (e.g. logout).
   */
  static async invalidateSession(sessionToken: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { sessionToken },
    });
  }

  /**
   * Revokes all active sessions for a user (e.g. on password change or security event).
   */
  static async invalidateAllUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  /**
   * Registers a new user with password hashing, default starter accounts,
   * and audit logging.
   */
  static async register(
    input: RegisterInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: SessionUser; sessionToken: string; expires: Date }> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const passwordHash = await this.hashPassword(input.password);

    // Create user and default starter accounts inside a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          currency: input.currency || 'INR',
          timezone: input.timezone || 'Asia/Kolkata',
          locale: input.locale || 'en-IN',
          status: 'active',
        },
      });

      // Starter accounts
      await tx.account.create({
        data: {
          userId: user.id,
          name: 'Primary Bank',
          type: AccountType.bank,
          currency: user.currency,
          openingBalance: new Prisma.Decimal(0),
          currentBalance: new Prisma.Decimal(0),
          color: '#3b82f6',
          icon: 'Building',
        },
      });

      await tx.account.create({
        data: {
          userId: user.id,
          name: 'Cash Wallet',
          type: AccountType.cash,
          currency: user.currency,
          openingBalance: new Prisma.Decimal(0),
          currentBalance: new Prisma.Decimal(0),
          color: '#10b981',
          icon: 'Wallet',
        },
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'user.register',
          entityType: 'User',
          entityId: user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: { email: user.email },
        },
      });

      return user;
    });

    const { sessionToken, expires } = await this.createSession(newUser.id);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        currency: newUser.currency,
        timezone: newUser.timezone,
        locale: newUser.locale,
        avatarUrl: newUser.avatarUrl,
      },
      sessionToken,
      expires,
    };
  }

  /**
   * Authenticates user credentials, writes audit log, and creates a DB session.
   */
  static async login(
    input: LoginInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: SessionUser; sessionToken: string; expires: Date }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Generic error to prevent email enumeration
    const invalidCredentialsError = new Error('Invalid email or password.');

    if (!user || !user.passwordHash || user.status !== 'active') {
      // Audit failed attempt
      await prisma.auditLog.create({
        data: {
          userId: user?.id || null,
          action: 'login.failed',
          entityType: 'User',
          entityId: user?.id || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: { email: input.email, reason: !user ? 'user_not_found' : 'inactive_or_no_pw' },
        },
      }).catch(() => {});

      throw invalidCredentialsError;
    }

    const isValid = await this.verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'login.failed',
          entityType: 'User',
          entityId: user.id,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: { email: input.email, reason: 'invalid_password' },
        },
      }).catch(() => {});

      throw invalidCredentialsError;
    }

    // Success: create session and log
    const { sessionToken, expires } = await this.createSession(user.id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login.success',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        timezone: user.timezone,
        locale: user.locale,
        avatarUrl: user.avatarUrl,
      },
      sessionToken,
      expires,
    };
  }
}
