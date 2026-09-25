import { cookies } from 'next/headers';
import { AuthService, SessionUser } from './auth.service';

export const SESSION_COOKIE_NAME = 'finora_session_token';

/**
 * Resolves authenticated user from database session token stored in cookie.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await AuthService.validateSession(token);
  } catch {
    return null;
  }
}

/**
 * Ensures user is authenticated. Throws generic unauthorized error if absent.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/**
 * Sets session cookie on response.
 */
export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

/**
 * Clears session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await AuthService.invalidateSession(token).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}
