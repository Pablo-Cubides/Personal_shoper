/**
 * Centralized Application Configuration
 * 
 * This file contains all configurable values for the application.
 * When integrating with the main platform, update these values.
 */

export const APP_CONFIG = {
  // ============================================
  // CREDITS SYSTEM
  // ============================================
  credits: {
    // Cost per operation (set to 0 for testing, change to 1 for production)
    COST_PER_ANALYSIS: parseInt(process.env.CREDIT_COST_ANALYSIS || '0', 10),
    COST_PER_GENERATION: parseInt(process.env.CREDIT_COST_GENERATION || '0', 10),
    
    // Starting credits for new sessions (only used in standalone mode)
    STARTING_CREDITS: parseInt(process.env.STARTING_CREDITS || '999', 10),
    
    // Enable credit validation (set false for testing)
    ENFORCE_CREDITS: process.env.ENFORCE_CREDITS === 'true',
  },

  // ============================================
  // AUTHENTICATION
  // ============================================
  auth: {
    // Set to true when integrated with main platform
    ENABLED: process.env.AUTH_ENABLED === 'true',
    
    // Header name where main platform sends user ID
    USER_ID_HEADER: process.env.AUTH_USER_HEADER || 'x-user-id',
    
    // Header for session token validation
    SESSION_TOKEN_HEADER: process.env.AUTH_SESSION_HEADER || 'x-session-token',
  },

  // ============================================
  // RATE LIMITING
  // ============================================
  rateLimit: {
    // Requests per window
    MAX_REQUESTS_PER_WINDOW: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
    
    // Window duration in seconds
    WINDOW_DURATION_SECONDS: parseInt(process.env.RATE_LIMIT_WINDOW || '3600', 10), // 1 hour
    
    // Enable rate limiting
    ENABLED: process.env.RATE_LIMIT_ENABLED !== 'false', // Default: enabled
  },

  // ============================================
  // AI SERVICES
  // ============================================
  ai: {
    // Timeouts in milliseconds
    ANALYSIS_TIMEOUT_MS: parseInt(process.env.AI_ANALYSIS_TIMEOUT || '45000', 10), // 45s
    GENERATION_TIMEOUT_MS: parseInt(process.env.AI_GENERATION_TIMEOUT || '60000', 10), // 60s
    
    // Retry configuration
    MAX_RETRIES: parseInt(process.env.AI_MAX_RETRIES || '2', 10),
    RETRY_DELAY_MS: parseInt(process.env.AI_RETRY_DELAY || '2000', 10),
    
    // Circuit breaker
    CIRCUIT_BREAKER_THRESHOLD: parseInt(process.env.AI_CIRCUIT_THRESHOLD || '5', 10),
    CIRCUIT_BREAKER_RESET_MS: parseInt(process.env.AI_CIRCUIT_RESET || '30000', 10), // 30s
  },

  // ============================================
  // IMAGE VALIDATION
  // ============================================
  images: {
    MAX_FILE_SIZE_MB: parseInt(process.env.MAX_IMAGE_SIZE_MB || '10', 10),
    MIN_WIDTH: parseInt(process.env.MIN_IMAGE_WIDTH || '512', 10),
    MIN_HEIGHT: parseInt(process.env.MIN_IMAGE_HEIGHT || '512', 10),
    MAX_WIDTH: parseInt(process.env.MAX_IMAGE_WIDTH || '4096', 10),
    MAX_HEIGHT: parseInt(process.env.MAX_IMAGE_HEIGHT || '4096', 10),
    ALLOWED_TYPES: (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(','),
  },

  // ============================================
  // CACHE
  // ============================================
  cache: {
    ENABLED: process.env.CACHE_ENABLED !== 'false', // Default: enabled
    TTL_SECONDS: parseInt(process.env.CACHE_TTL || '604800', 10), // 7 days
    
    // Redis connection (leave empty for in-memory cache)
    REDIS_URL: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    REDIS_TOKEN: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },

  // ============================================
  // MONITORING
  // ============================================
  monitoring: {
    ENABLED: process.env.MONITORING_ENABLED === 'true',
    SENTRY_DSN: process.env.SENTRY_DSN || '',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info', // 'debug' | 'info' | 'warn' | 'error'
  },

  // ============================================
  // COMPLIANCE
  // ============================================
  compliance: {
    // Auto-delete uploaded images after processing
    DELETE_AFTER_PROCESSING: process.env.DELETE_IMAGES_AFTER === 'true',
    
    // Retention period for generated images (days)
    RETENTION_DAYS: parseInt(process.env.IMAGE_RETENTION_DAYS || '30', 10),
    
    // Privacy mode (don't log image URLs)
    PRIVACY_MODE: process.env.PRIVACY_MODE === 'true',
  },

  // ============================================
  // FEATURE FLAGS
  // ============================================
  features: {
    MODERATION_ENABLED: process.env.MODERATION_ENABLED !== 'false', // Default: enabled
    WATERMARK_ENABLED: process.env.WATERMARK_ENABLED !== 'false', // Default: enabled
    ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED === 'true',
  },
} as const;

/**
 * Get a user-friendly environment name
 */
export function getEnvironment(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'test') return 'test';
  if (env === 'production') return 'production';
  return 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Validate required environment variables
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check critical env vars
  if (!process.env.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY is required');
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    errors.push('CLOUDINARY_CLOUD_NAME is required');
  }

  if (!process.env.CLOUDINARY_API_KEY) {
    errors.push('CLOUDINARY_API_KEY is required');
  }

  if (!process.env.CLOUDINARY_API_SECRET) {
    errors.push('CLOUDINARY_API_SECRET is required');
  }

  // Warn about optional features
  if (APP_CONFIG.cache.ENABLED && !APP_CONFIG.cache.REDIS_URL) {
    console.warn('⚠️  Cache enabled but no REDIS_URL configured. Using in-memory cache.');
  }

  if (APP_CONFIG.monitoring.ENABLED && !APP_CONFIG.monitoring.SENTRY_DSN) {
    console.warn('⚠️  Monitoring enabled but no SENTRY_DSN configured.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
