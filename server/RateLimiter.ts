/**
 * RateLimiter — Algorytm Token Bucket do zabezpieczenia serwera Socket.io
 * przed floodingiem pakietów ruchu, akcji i zapytań o rezerwację postaci.
 */

export type RateLimitCategory = 'movement' | 'action' | 'event';

export interface BucketConfig {
  capacity: number;
  refillRatePerSec: number;
}

export const DEFAULT_RATE_LIMITS: Record<RateLimitCategory, BucketConfig> = {
  // Aktualizacje pozycji gracza (nominalnie 20 Hz ze strony klienta):
  movement: { capacity: 45, refillRatePerSec: 25 },
  // Akcje jednorazowe (picie, palenie, taniec, gesty):
  action: { capacity: 8, refillRatePerSec: 3 },
  // Rezerwacje, potwierdzenia i zwolnienia slotów:
  event: { capacity: 10, refillRatePerSec: 3 },
};

interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

export class RateLimiter {
  private buckets = new Map<string, Map<RateLimitCategory, TokenBucket>>();
  private limits: Record<RateLimitCategory, BucketConfig>;

  constructor(customLimits: Partial<Record<RateLimitCategory, BucketConfig>> = {}) {
    this.limits = {
      movement: customLimits.movement ?? DEFAULT_RATE_LIMITS.movement,
      action: customLimits.action ?? DEFAULT_RATE_LIMITS.action,
      event: customLimits.event ?? DEFAULT_RATE_LIMITS.event,
    };
  }

  /**
   * Sprawdza i pobiera żądaną liczbę tokenów dla danego klienta i kategorii.
   * Zwraca true jeśli zapytanie mieści się w limicie, false jeśli przekroczono limit.
   */
  consume(clientId: string, category: RateLimitCategory, cost = 1, nowMs = Date.now()): boolean {
    let clientBuckets = this.buckets.get(clientId);
    if (!clientBuckets) {
      clientBuckets = new Map();
      this.buckets.set(clientId, clientBuckets);
    }

    const config = this.limits[category];
    let bucket = clientBuckets.get(category);

    if (!bucket) {
      bucket = {
        tokens: config.capacity - cost,
        lastRefillMs: nowMs,
      };
      clientBuckets.set(category, bucket);
      return bucket.tokens >= 0;
    }

    // Uzupełnij tokeny na podstawie upływu czasu:
    const elapsedSec = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
    const addedTokens = elapsedSec * config.refillRatePerSec;
    bucket.tokens = Math.min(config.capacity, bucket.tokens + addedTokens);
    bucket.lastRefillMs = nowMs;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }

    return false;
  }

  /**
   * Usuwa rekordy rozłączonego klienta, aby zapobiec wyciekowi pamięci.
   */
  remove(clientId: string): void {
    this.buckets.delete(clientId);
  }

  /**
   * Czyści wszystkie zasoby rate limitera.
   */
  clear(): void {
    this.buckets.clear();
  }
}
