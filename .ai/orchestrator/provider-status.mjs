export const ProviderStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  TEMPORARILY_RATE_LIMITED: 'TEMPORARILY_RATE_LIMITED',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  AUTH_ERROR: 'AUTH_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  PAID_API_REQUIRED: 'PAID_API_REQUIRED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
});

/** Klasyfikuje rzeczywisty komunikat CLI bez zgadywania liczby pozostałych tokenów. */
export function classifyProviderFailure(text = '') {
  const message = text.toLowerCase();
  if (/api.?key|vertex|billing|credit|pay.?as.?you.?go/.test(message))
    return ProviderStatus.PAID_API_REQUIRED;
  if (/quota.*(exhaust|exceed)|usage limit|limit.*reached/.test(message))
    return ProviderStatus.QUOTA_EXHAUSTED;
  if (/rate.?limit|too many requests|try again later/.test(message))
    return ProviderStatus.TEMPORARILY_RATE_LIMITED;
  if (/not logged|login required|unauthori[sz]ed|authentication/.test(message))
    return ProviderStatus.AUTH_ERROR;
  return message.trim() ? ProviderStatus.FAILED : ProviderStatus.UNKNOWN;
}
