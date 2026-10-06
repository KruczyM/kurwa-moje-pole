function bounded<T>(operation: Promise<T>, milliseconds = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Cache setup timeout')), milliseconds);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Configure before the first model request. Failure never prevents starting the game. */
export async function preparePersistentAssetCache(): Promise<boolean> {
  if (!isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) return false;
  try {
    const base = import.meta.env.BASE_URL;
    const response = await fetch(`${base}asset-cache-manifest.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return false;
    const manifest: unknown = await response.json();
    await bounded(navigator.serviceWorker.register(`${base}asset-cache-sw.js`, { scope: base }));
    await bounded(navigator.serviceWorker.ready);
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          navigator.serviceWorker.removeEventListener('controllerchange', done);
          resolve();
        };
        const timer = setTimeout(done, 4000);
        navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
      });
    }
    const controller = navigator.serviceWorker.controller;
    if (!controller) return false;
    return await new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      const done = (ready: boolean) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(ready);
      };
      const timer = setTimeout(() => done(false), 4000);
      channel.port1.onmessage = () => done(true);
      controller.postMessage({ type: 'configure-assets', manifest }, [channel.port2]);
    });
  } catch {
    return false;
  }
}
