export const PAID_AI_ENV_KEYS = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'];

/** Przerywa start, jeśli konfiguracja dopuszcza płatny fallback lub kredyty AI. */
export function assertSubscriptionOnlyMode(config) {
  const cost = config?.cost;
  if (!cost?.subscriptionOnly || cost.allowPaidApi !== false || cost.allowAiCredits !== false) {
    throw new Error('PAID_AI_CONFIGURATION_DETECTED: wymagany jest tryb wyłącznie subskrypcyjny.');
  }
  if (config?.github?.autoMerge) {
    throw new Error('UNSAFE_CONFIGURATION: automatyczny merge musi pozostać wyłączony.');
  }
  return true;
}

/** Zwraca nazwy wykrytych zmiennych API bez odczytywania ani logowania ich wartości. */
export function detectPaidAiEnvironment(env = process.env) {
  return PAID_AI_ENV_KEYS.filter((key) => typeof env[key] === 'string' && env[key].length > 0);
}

/** Tworzy środowisko procesu potomnego bez kluczy mogących uruchomić płatne API. */
export function sanitizeAiEnvironment(env = process.env) {
  const sanitized = { ...env };
  for (const key of PAID_AI_ENV_KEYS) delete sanitized[key];
  sanitized.AI_PIPELINE_COST_MODE = 'SUBSCRIPTION_ONLY';
  sanitized.AI_PIPELINE_ALLOW_PAID_API = '0';
  sanitized.AI_PIPELINE_ALLOW_AI_CREDITS = '0';
  return sanitized;
}
