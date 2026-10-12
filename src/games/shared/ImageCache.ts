const cache = new Map<string, Promise<HTMLImageElement>>();

/** Loads each resolved URL once across 2D hosts; evicts failures so retry can recover. */
export function loadCachedImage(url: string): Promise<HTMLImageElement> {
  let request = cache.get(url);
  if (!request) {
    request = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        cache.delete(url);
        reject(new Error(`Nie wczytano grafiki: ${url}`));
      };
      image.src = url;
    });
    cache.set(url, request);
  }
  return request;
}
