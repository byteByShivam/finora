'use server';

import { registerSchema, loginSchema, RegisterInput, LoginInput } from '@/lib/validation/auth.schema';
import { AuthService, SessionUser } from '@/server/auth/auth.service';
import { setSessionCookie, clearSessionCookie } from '@/server/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type ActionResult<T = unknown> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

export async function registerAction(rawInput: RegisterInput): Promise<ActionResult<{ user: SessionUser }>> {
  try {
    // 1. Validate with Zod .strict()
    const parsed = registerSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid registration data.' };
    }

    // 2. Rate limiting check
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = headerList.get('user-agent') || 'Unknown';

    const rateLimit = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return { success: false, error: 'Too many registration attempts. Please try again later.' };
    }

    // 3. Call AuthService
    const { user, sessionToken, expires } = await AuthService.register(parsed.data, ip, userAgent);

    // 4. Set session cookie
    await setSessionCookie(sessionToken, expires);

    return { success: true, data: { user } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
    return { success: false, error: message };
  }
}

export async function loginAction(rawInput: LoginInput): Promise<ActionResult<{ user: SessionUser }>> {
  try {
    // 1. Validate with Zod
    const parsed = loginSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid credentials.' };
    }

    // 2. Rate limiting check (e.g. 5 attempts / 15 min per IP)
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = headerList.get('user-agent') || 'Unknown';

    const rateLimit = checkRateLimit(`login:${ip}:${parsed.data.email}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return { success: false, error: 'Too many failed login attempts. Please wait 15 minutes before trying again.' };
    }

    // 3. Authenticate with AuthService
    const { user, sessionToken, expires } = await AuthService.login(parsed.data, ip, userAgent);

    // 4. Set session cookie
    await setSessionCookie(sessionToken, expires);

    return { success: true, data: { user } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid credentials.';
    return { success: false, error: message };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}
