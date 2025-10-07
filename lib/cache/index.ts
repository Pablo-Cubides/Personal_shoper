import { APP_CONFIG } from '../config/app.config';
import crypto from 'crypto';
import { appendLog } from '../ai/logger';

/**
 * In-memory cache implementation
 */
class InMemoryCache {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    for (const [key, entry] of entries) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || APP_CONFIG.cache.TTL_SECONDS;
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

/**
 * Redis cache implementation
 */
class RedisCache {
  private redis: unknown = null;
  private connected = false;

  constructor(private redisUrl: string, private redisToken?: string) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      if (!this.redisUrl) {
        throw new Error('Redis URL not configured');
      }

      // Try to require Redis (fail gracefully if not installed)
      try {
        // Try dynamic import so environments without @upstash/redis won't fail at parse time
        const mod = (await import('@upstash/redis').catch(() => null)) as unknown | null;
        let Redis: unknown = undefined;
        if (mod && typeof mod === 'object') {
          const asObj = mod as Record<string, unknown>;
          if ('Redis' in asObj) Redis = asObj['Redis'];
        }
        if (!Redis) throw new Error('@upstash/redis not installed');

        // Redis is a runtime-loaded constructor; cast to a narrow constructor shape
        const RedisCtor = Redis as unknown as { new (opts?: unknown): unknown; new (url: unknown): unknown };
        this.redis = this.redisToken
          ? new RedisCtor({ url: this.redisUrl, token: this.redisToken })
          : new RedisCtor(this.redisUrl);
      } catch {
        throw new Error('@upstash/redis not installed. Run: npm install @upstash/redis');
      }

      this.connected = true;

      appendLog({
        phase: 'cache.redis_initialized',
        timestamp: Date.now(),
      });
    } catch (error) {
      appendLog({
        phase: 'cache.redis_init_failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      this.redis = null;
      this.connected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.redis) {
      return null;
    }

    try {
      // redis client may return strings or parsed objects depending on driver
      // narrow to a minimal client shape we expect (get method)
      const r = this.redis as unknown as { get?: (k: string) => Promise<unknown> };
      if (!r.get) return null;
      const value = await r.get(key);
      return value as T | null;
    } catch (error) {
      appendLog({
        phase: 'cache.redis_get_error',
        key: key.substring(0, 20) + '...',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.connected || !this.redis) {
      return;
    }

    try {
      const ttl = ttlSeconds || APP_CONFIG.cache.TTL_SECONDS;
      const r = this.redis as unknown as { setex?: (k: string, ttl: number, v: string) => Promise<unknown> };
      if (!r.setex) return;
      await r.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      appendLog({
        phase: 'cache.redis_set_error',
        key: key.substring(0, 20) + '...',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected || !this.redis) {
      return;
    }

    try {
      const r = this.redis as unknown as { del?: (k: string) => Promise<unknown> };
      if (!r.del) return;
      await r.del(key);
    } catch (error) {
      appendLog({
        phase: 'cache.redis_delete_error',
        key: key.substring(0, 20) + '...',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }
  }

  async clear(): Promise<void> {
    // Not implemented for Redis (dangerous operation)
    appendLog({
      phase: 'cache.redis_clear_not_implemented',
      timestamp: Date.now(),
    });
  }
}

// Singleton cache instance
let cacheInstance: InMemoryCache | RedisCache | null = null;

// Check if @upstash/redis is available
function isRedisAvailable(): boolean {
  try {
    require.resolve('@upstash/redis');
    return true;
  } catch {
    return false;
  }
}

function getCache(): InMemoryCache | RedisCache {
  if (!cacheInstance) {
    // Use Redis if configured AND package is installed, otherwise in-memory
    if (APP_CONFIG.cache.ENABLED && APP_CONFIG.cache.REDIS_URL && isRedisAvailable()) {
      try {
        cacheInstance = new RedisCache(
          APP_CONFIG.cache.REDIS_URL,
          APP_CONFIG.cache.REDIS_TOKEN
        );
        console.log('✓ Using Redis cache');
      } catch (error) {
        console.warn('Redis cache initialization failed, falling back to in-memory:', error);
        cacheInstance = new InMemoryCache();
      }
    } else {
      cacheInstance = new InMemoryCache();
      console.log('✓ Using in-memory cache');
    }
  }
  return cacheInstance;
}

/**
 * Get value from cache
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!APP_CONFIG.cache.ENABLED) {
    return null;
  }

  const startTime = Date.now();
  const cache = getCache();
  const value = await cache.get<T>(key);

  appendLog({
    phase: value ? 'cache.hit' : 'cache.miss',
    key: key.substring(0, 20) + '...',
    durationMs: Date.now() - startTime,
    timestamp: Date.now(),
  });

  return value;
}

/**
 * Set value in cache
 */
export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  if (!APP_CONFIG.cache.ENABLED) {
    return;
  }

  const cache = getCache();
  await cache.set(key, value, ttlSeconds);

  appendLog({
    phase: 'cache.set',
    key: key.substring(0, 20) + '...',
    ttl: ttlSeconds || APP_CONFIG.cache.TTL_SECONDS,
    timestamp: Date.now(),
  });
}

/**
 * Delete value from cache
 */
export async function deleteCached(key: string): Promise<void> {
  if (!APP_CONFIG.cache.ENABLED) {
    return;
  }

  const cache = getCache();
  await cache.delete(key);

  appendLog({
    phase: 'cache.delete',
    key: key.substring(0, 20) + '...',
    timestamp: Date.now(),
  });
}

/**
 * Clear entire cache (use with caution)
 */
export async function clearCache(): Promise<void> {
  const cache = getCache();
  await cache.clear();

  appendLog({
    phase: 'cache.cleared',
    timestamp: Date.now(),
  });
}

/**
 * Generate cache key for image analysis
 */
export function generateAnalysisCacheKey(imageHash: string, locale: string): string {
  return `analysis:${imageHash}:${locale}`;
}

/**
 * Generate cache key for image generation
 */
export function generateGenerationCacheKey(
  imageHash: string,
  instruction: string
): string {
  // Use the built-in crypto module imported at top
  const instructionHash = crypto
    .createHash('md5')
    .update(instruction)
    .digest('hex')
    .substring(0, 8);
  
  return `generation:${imageHash}:${instructionHash}`;
}

/**
 * Get cache statistics (only for in-memory cache)
 */
export function getCacheStats(): { size?: number; type: string } {
  const cache = getCache();
  
  if (cache instanceof InMemoryCache) {
    return {
      type: 'in-memory',
      size: cache.getSize(),
    };
  }

  return {
    type: 'redis',
  };
}
