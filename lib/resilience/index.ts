import { APP_CONFIG } from '../config/app.config';
import { TimeoutError, CircuitBreakerError, isRetryable } from '../errors';
import { appendLog } from '../ai/logger';

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests to failing services
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private successCount = 0;

  constructor(
    private serviceName: string,
    private threshold: number = APP_CONFIG.ai.CIRCUIT_BREAKER_THRESHOLD,
    private resetTimeout: number = APP_CONFIG.ai.CIRCUIT_BREAKER_RESET_MS
  ) {}

  private setState(newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN') {
    if (this.state !== newState) {
      appendLog({
        phase: 'circuit_breaker.state_change',
        service: this.serviceName,
        oldState: this.state,
        newState,
        failureCount: this.failureCount,
        timestamp: Date.now(),
      });
      this.state = newState;
    }
  }

  async execute<T>(
    fn: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceFailure >= this.resetTimeout) {
        // Try transitioning to half-open
        this.setState('HALF_OPEN');
        this.successCount = 0;
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.serviceName}`,
          this.serviceName,
          this.lastFailureTime + this.resetTimeout
        );
      }
    }

    try {
      // Execute with timeout
      const result = timeoutMs
        ? await this.withTimeout(fn, timeoutMs)
        : await fn();

      // Handle success
      this.onSuccess();
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure();
      throw error;
    }
  }

  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`, timeoutMs)),
          timeoutMs
        )
      ),
    ]);
  }

  private onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      // After a few successes in half-open state, close the circuit
      if (this.successCount >= 2) {
        this.setState('CLOSED');
        appendLog({
          phase: 'circuit_breaker.recovered',
          service: this.serviceName,
          timestamp: Date.now(),
        });
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Immediately reopen circuit on failure in half-open state
      this.setState('OPEN');
    } else if (this.failureCount >= this.threshold) {
      // Open circuit after threshold failures
      this.setState('OPEN');
      appendLog({
        phase: 'circuit_breaker.opened',
        service: this.serviceName,
        failureCount: this.failureCount,
        threshold: this.threshold,
        timestamp: Date.now(),
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    this.setState('CLOSED');
  }
}

/**
 * Retry logic with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = APP_CONFIG.ai.MAX_RETRIES,
    initialDelayMs = APP_CONFIG.ai.RETRY_DELAY_MS,
    maxDelayMs = 10000,
    onRetry,
    shouldRetry = isRetryable,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );

      // Log retry attempt
      appendLog({
        phase: 'retry.attempt',
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  appendLog({
    phase: 'retry.exhausted',
    maxRetries,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    timestamp: Date.now(),
  });

  throw lastError;
}

/**
 * Global circuit breakers for different services
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Execute with both circuit breaker and retry logic
 */
export async function executeWithResilience<T>(
  serviceName: string,
  fn: () => Promise<T>,
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const circuitBreaker = getCircuitBreaker(serviceName);
  
  return withRetry(
    () => circuitBreaker.execute(fn, options.timeoutMs),
    {
      maxRetries: options.maxRetries,
      onRetry: options.onRetry,
    }
  );
}
