import { APP_CONFIG } from './config/app.config';
import { CreditError } from './errors';
import { appendLog } from './ai/logger';

/**
 * CREDIT SYSTEM - Configurable for Integration
 * 
 * Current Setup (Testing):
 *   - COST_PER_ANALYSIS: 0 credits
 *   - COST_PER_GENERATION: 0 credits
 *   - ENFORCE_CREDITS: false
 * 
 * Production Setup (Update .env):
 *   - CREDIT_COST_ANALYSIS=0
 *   - CREDIT_COST_GENERATION=1
 *   - ENFORCE_CREDITS=true
 * 
 * When integrated with main platform, credits will be managed externally.
 * This module will validate credit availability before operations.
 */

// A simple in-memory store for user credits (for standalone testing only)
// When integrated with main platform, this will be replaced by API calls
const creditStore = new Map<string, number>();

/**
 * Get starting credits for a new session (only used in standalone mode)
 */
function getStartingCredits(): number {
  return APP_CONFIG.credits.STARTING_CREDITS;
}

/**
 * Checks the available credits for a given session.
 * If the session is new, it initializes it with starting credits.
 * 
 * NOTE: In production with main platform, this should call the platform's
 * credit API instead of using local storage.
 * 
 * @param sessionId The ID of the user's session.
 * @returns The number of available credits.
 */
export async function checkCredits(sessionId: string): Promise<number> {
  // TODO: When integrating with main platform, replace with API call:
  // const response = await fetch(`${PLATFORM_API}/credits/${sessionId}`);
  // return response.json().credits;
  
  if (!creditStore.has(sessionId)) {
    creditStore.set(sessionId, getStartingCredits());
  }
  
  return creditStore.get(sessionId)!;
}

/**
 * Consumes a specified number of credits for a given session.
 * 
 * NOTE: In production with main platform, this should call the platform's
 * credit consumption API.
 * 
 * @param sessionId The ID of the user's session.
 * @param cost The number of credits to consume.
 * @param operation Description of the operation for logging.
 * @returns An object indicating success or failure.
 */
export async function consumeCredits(
  sessionId: string,
  cost: number = 1,
  operation: string = 'unknown'
): Promise<{ ok: boolean; remaining?: number }> {
  // Skip credit consumption if not enforced
  if (!APP_CONFIG.credits.ENFORCE_CREDITS) {
    appendLog({
      phase: 'credits.skipped',
      sessionId,
      cost,
      operation,
      reason: 'Credits not enforced (testing mode)',
      timestamp: Date.now(),
    });
    
    return { ok: true, remaining: 999 };
  }

  // TODO: When integrating with main platform, replace with API call:
  // const response = await fetch(`${PLATFORM_API}/credits/consume`, {
  //   method: 'POST',
  //   body: JSON.stringify({ sessionId, cost, operation })
  // });
  // return response.json();
  
  const currentCredits = await checkCredits(sessionId);

  if (currentCredits < cost) {
    appendLog({
      phase: 'credits.insufficient',
      sessionId,
      cost,
      available: currentCredits,
      operation,
      timestamp: Date.now(),
    });
    
    return { ok: false, remaining: currentCredits };
  }

  const newCredits = currentCredits - cost;
  creditStore.set(sessionId, newCredits);

  appendLog({
    phase: 'credits.consumed',
    sessionId,
    cost,
    remaining: newCredits,
    operation,
    timestamp: Date.now(),
  });

  return { ok: true, remaining: newCredits };
}

/**
 * Gets the cost of a specific action.
 * 
 * Current costs (configurable via environment):
 *   - analyze: 0 credits (testing) → 0 credits in production
 *   - generate: 0 credits (testing) → 1 credit in production
 * 
 * To change costs, update .env file:
 *   CREDIT_COST_ANALYSIS=0
 *   CREDIT_COST_GENERATION=1
 * 
 * @param action The action being performed.
 * @returns The cost of the action in credits.
 */
export function getActionCost(action: 'analyze' | 'generate' | 'edit'): number {
  switch (action) {
    case 'analyze':
      return APP_CONFIG.credits.COST_PER_ANALYSIS;
    case 'generate':
      return APP_CONFIG.credits.COST_PER_GENERATION;
    case 'edit':
      // Edits are treated as generation actions for crediting purposes
      return APP_CONFIG.credits.COST_PER_GENERATION;
    default:
      return 0;
  }
}

/**
 * Enforce credit requirements before an operation
 * Throws CreditError if insufficient credits
 */
export async function enforceCredits(
  sessionId: string,
  action: 'analyze' | 'generate' | 'edit'
): Promise<void> {
  const cost = getActionCost(action);
  
  // Skip if cost is 0 or credits not enforced
  if (cost === 0 || !APP_CONFIG.credits.ENFORCE_CREDITS) {
    return;
  }

  const available = await checkCredits(sessionId);
  
  if (available < cost) {
    throw new CreditError(
      `Insufficient credits. Required: ${cost}, Available: ${available}`,
      cost,
      available
    );
  }
}

/**
 * Add credits to a session (for testing or rewards)
 */
export async function addCredits(
  sessionId: string,
  amount: number
): Promise<{ ok: boolean; newBalance: number }> {
  const current = await checkCredits(sessionId);
  const newBalance = current + amount;
  
  creditStore.set(sessionId, newBalance);

  appendLog({
    phase: 'credits.added',
    sessionId,
    amount,
    newBalance,
    timestamp: Date.now(),
  });

  return { ok: true, newBalance };
}