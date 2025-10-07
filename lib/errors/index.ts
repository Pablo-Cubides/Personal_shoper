/**
 * Custom Error Classes for the Application
 */

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
  public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

export class AIServiceError extends AppError {
  constructor(
    message: string,
    public provider: string,
    public retryable: boolean = true,
    statusCode: number = 503,
    details?: Record<string, unknown>
  ) {
    super(message, statusCode, 'AI_SERVICE_ERROR', { provider, retryable, ...details });
    this.name = 'AIServiceError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', { field, ...details });
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    public resetTime: number,
    public limit: number
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { resetTime, limit });
    this.name = 'RateLimitError';
  }
}

export class CreditError extends AppError {
  constructor(
    message: string = 'Insufficient credits',
    public required: number,
    public available: number
  ) {
    super(message, 402, 'INSUFFICIENT_CREDITS', { required, available });
    this.name = 'CreditError';
  }
}

export class ModerationError extends AppError {
  constructor(message: string, public reason?: string) {
    super(message, 403, 'MODERATION_BLOCKED', { reason });
    this.name = 'ModerationError';
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = 'Operation timed out', public timeoutMs: number) {
    super(message, 408, 'TIMEOUT', { timeoutMs });
    this.name = 'TimeoutError';
  }
}

export class CircuitBreakerError extends AppError {
  constructor(
    message: string = 'Service temporarily unavailable',
    public service: string,
    public resetTime: number
  ) {
    super(message, 503, 'CIRCUIT_BREAKER_OPEN', { service, resetTime });
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AIServiceError) {
    return error.retryable;
  }
  
  if (error instanceof AppError) {
    return error.statusCode >= 500 && error.statusCode < 600;
  }

  // Network errors are generally retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }

  return false;
}

/**
 * Extract error information safely
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      details: { name: error.name },
    };
  }

  return {
    message: String(error),
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  };
}
