import { APP_CONFIG } from '../config/app.config';
import { RateLimitError } from '../errors';
import { appendLog } from '../ai/logger';

/**
 * Simple in-memory rate limiter using sliding window
 */
class InMemoryRateLimiter {
  private requests = new Map<string, number[]>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    const windowMs = APP_CONFIG.rateLimit.WINDOW_DURATION_SECONDS * 1000;

    const entries = Array.from(this.requests.entries());
    for (const [key, timestamps] of entries) {
      const validTimestamps = timestamps.filter((t: number) => now - t < windowMs);
      
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }

  async check(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    limit: number;
  }> {
    const now = Date.now();
    const windowMs = APP_CONFIG.rateLimit.WINDOW_DURATION_SECONDS * 1000;
    const limit = APP_CONFIG.rateLimit.MAX_REQUESTS_PER_WINDOW;

    // Get existing timestamps for this identifier
    const timestamps = this.requests.get(identifier) || [];

    // Filter to only include timestamps within the window
    const validTimestamps = timestamps.filter((t: number) => now - t < windowMs);

    // Calculate reset time (when oldest request expires)
    const resetTime = validTimestamps.length > 0
      ? validTimestamps[0] + windowMs
      : now + windowMs;

    // Check if limit exceeded
    const allowed = validTimestamps.length < limit;
    const remaining = Math.max(0, limit - validTimestamps.length);

    if (allowed) {
      // Add current timestamp
      validTimestamps.push(now);
      this.requests.set(identifier, validTimestamps);
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      resetTime,
      limit,
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

/**
 * Redis-based rate limiter (for production with multiple instances)
 */
class RedisRateLimiter {
  private redis: unknown = null;

  constructor(private redisUrl: string, private redisToken?: string) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      // Dynamic import to avoid errors if Redis is not configured
      if (!this.redisUrl) {
        throw new Error('Redis URL not configured');
      }

      // Try to require Redis (fail gracefully if not installed)
      try {
        const mod = (await import('@upstash/redis').catch(() => null)) as unknown | null;
        let RedisCtor: unknown | undefined = undefined;
        if (mod && typeof mod === 'object' && 'Redis' in mod) RedisCtor = (mod as Record<string, unknown>)['Redis'];
        if (!RedisCtor) throw new Error('@upstash/redis not installed');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // Narrow the Redis constructor to a generic "newable" to avoid broad `any`.
        const Ctor = RedisCtor as unknown as new (...args: unknown[]) => unknown;
        this.redis = this.redisToken
          ? new Ctor({ url: this.redisUrl, token: this.redisToken })
          : new Ctor(this.redisUrl);
      } catch {
        throw new Error('@upstash/redis not installed. Run: npm install @upstash/redis');
      }

      appendLog({
        phase: 'rate_limiter.redis_initialized',
        timestamp: Date.now(),
      });
    } catch (error) {
      appendLog({
        phase: 'rate_limiter.redis_init_failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      // Will fallback to in-memory
      this.redis = null;
    }
  }

  async check(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    limit: number;
  }> {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    const now = Date.now();
    const windowMs = APP_CONFIG.rateLimit.WINDOW_DURATION_SECONDS * 1000;
    const limit = APP_CONFIG.rateLimit.MAX_REQUESTS_PER_WINDOW;
    const key = `ratelimit:${identifier}`;

      try {
      // Narrow client to a minimal shape we actually use and guard each call.
      const r = this.redis as unknown as Record<string, unknown> | null;
      // Remove old timestamps outside the window
      if (r && typeof r.zremrangebyscore === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (r.zremrangebyscore as any)(key, 0, now - windowMs);
      }

      // Count requests in current window
      let count = 0;
      if (r && typeof r.zcard === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = await (r.zcard as any)(key);
        count = typeof c === 'number' ? c : Number(c || 0);
      }

      // Calculate reset time
      let resetTime = now + windowMs;
      if (r && typeof r.zrange === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oldestTimestamp = await (r.zrange as any)(key, 0, 0, { withScores: true });
        if (Array.isArray(oldestTimestamp) && oldestTimestamp.length > 1) {
          resetTime = Number(oldestTimestamp[1]) + windowMs;
        }
      }

      const allowed = count < limit;

      if (allowed && r) {
        if (typeof r.zadd === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (r.zadd as any)(key, { score: now, member: `${now}-${Math.random()}` });
        }
        if (typeof r.expire === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (r.expire as any)(key, Math.ceil(windowMs / 1000));
        }
      }

      return {
        allowed,
        remaining: Math.max(0, limit - count - (allowed ? 1 : 0)),
        resetTime,
        limit,
      };
    } catch (error) {
      // On Redis errors, fail open (allow the request)
      appendLog({
        phase: 'rate_limiter.redis_error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });

      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: now + windowMs,
        limit,
      };
    }
  }
}

// Singleton instances
let rateLimiter: InMemoryRateLimiter | RedisRateLimiter | null = null;

// Check if @upstash/redis is available
function isRedisAvailable(): boolean {
  try {
    require.resolve('@upstash/redis');
    return true;
  } catch {
    return false;
  }
}

function getRateLimiter(): InMemoryRateLimiter | RedisRateLimiter {
  if (!rateLimiter) {
    // Use Redis if configured AND package is installed, otherwise in-memory
    if (APP_CONFIG.cache.REDIS_URL && isRedisAvailable()) {
      try {
        rateLimiter = new RedisRateLimiter(
          APP_CONFIG.cache.REDIS_URL,
          APP_CONFIG.cache.REDIS_TOKEN
        );
        console.log('✓ Using Redis rate limiter');
      } catch (error) {
        console.warn('Redis rate limiter initialization failed, falling back to in-memory:', error);
        rateLimiter = new InMemoryRateLimiter();
      }
    } else {
      rateLimiter = new InMemoryRateLimiter();
      console.log('✓ Using in-memory rate limiter');
    }
  }
  return rateLimiter;
}

/**
 * Check rate limit for an identifier (IP, session, user ID, etc.)
 */
export async function checkRateLimit(identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}> {
  // Skip if rate limiting is disabled
  if (!APP_CONFIG.rateLimit.ENABLED) {
    return {
      allowed: true,
      remaining: 999,
      resetTime: Date.now() + 3600000,
      limit: 999,
    };
  }

  const limiter = getRateLimiter();
  const result = await limiter.check(identifier);

  // Log rate limit check
  appendLog({
    phase: 'rate_limit.check',
    identifier: identifier.substring(0, 8) + '...', // Truncate for privacy
    allowed: result.allowed,
    remaining: result.remaining,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Enforce rate limit, throwing error if exceeded
 */
export async function enforceRateLimit(identifier: string): Promise<void> {
  const result = await checkRateLimit(identifier);

  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded. Try again after ${new Date(result.resetTime).toISOString()}`,
      result.resetTime,
      result.limit
    );
  }
}

/**
 * Get identifier from request (IP address or session ID)
 */
export function getRequestIdentifier(req: Request): string {
  // Try to get IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');

  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0].trim() || 'unknown';

  // Also consider session ID if available
  const sessionId = req.headers.get('x-session-id');

  return sessionId || ip;
}
