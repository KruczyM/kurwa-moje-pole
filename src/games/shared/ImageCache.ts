const cache = new Map<string, Promise<HTMLImageElement>>();
const decoded = new Map<string, HTMLImageElement>();

/** Waits for every started image/metadata request before a caller releases failed or stale batches. */
export async function settleImageBatch<const T extends readonly unknown[]>(
  requests: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const results = await Promise.allSettled(requests);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return results.map((result) => (result as PromiseFulfilledResult<unknown>).value) as {
    -readonly [K in keyof T]: Awaited<T[K]>;
  };
}

/** Loads each resolved URL once across 2D hosts; evicts failures so retry can recover. */
export function loadCachedImage(url: string): Promise<HTMLImageElement> {
  let request = cache.get(url);
  if (!request) {
    request = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (cache.get(url) === request) decoded.set(url, image);
        resolve(image);
      };
      image.onerror = () => {
        if (cache.get(url) === request) {
          cache.delete(url);
          decoded.delete(url);
        }
        reject(new Error(`Nie wczytano grafiki: ${url}`));
      };
      image.src = url;
    });
    cache.set(url, request);
  }
  return request;
}

/** Drop only resolved cache references. Existing users keep valid images; in-flight loads stay deduplicated. */
export function releaseCachedImages(predicate: (url: string) => boolean): void {
  for (const url of decoded.keys())
    if (predicate(url)) {
      decoded.delete(url);
      cache.delete(url);
    }
}

/** Decoded CPU image estimate, scoped by the caller to its own asset namespace. */
export function cachedImageDiagnostics(predicate: (url: string) => boolean = () => true) {
  const images = [...decoded].filter(([url]) => predicate(url));
  return {
    images: images.length,
    decodedBytes: images.reduce((sum, [, image]) => sum + image.naturalWidth * image.naturalHeight * 4, 0),
    urls: images.map(([url]) => url),
  };
}
