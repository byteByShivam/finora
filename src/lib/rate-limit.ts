/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 * Keyed by identifier (e.g. IP, email, or composite key).
 */

interface RateLimitRecord {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 15 * 60 * 1000);
      if (record.timestamps.length === 0) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Checks and records an attempt against a sliding window rate limit.
 * @param key unique identifier (e.g. `login:${ip}:${email}`)
 * @param maxAttempts maximum allowed attempts within the window
 * @param windowMs window duration in milliseconds (default 15 minutes)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = memoryStore.get(key) || { timestamps: [] };

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxAttempts) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  // Record this attempt
  record.timestamps.push(now);
  memoryStore.set(key, record);

  return {
    allowed: true,
    remaining: maxAttempts - record.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Resets rate limit for a key (e.g. after successful login)
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}
