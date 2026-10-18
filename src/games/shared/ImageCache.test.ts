import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedImageDiagnostics, loadCachedImage, releaseCachedImages, settleImageBatch } from './ImageCache';
class FakeImage {
  static instances: FakeImage[] = [];
  onload?: () => void;
  onerror?: () => void;
  src = '';
  naturalWidth = 128;
  naturalHeight = 128;
  constructor() {
    FakeImage.instances.push(this);
  }
}
afterEach(() => {
  releaseCachedImages(() => true);
  FakeImage.instances = [];
  vi.unstubAllGlobals();
});
describe('shared image cache lifecycle', () => {
  it('cleans a rejected batch only after late image loads settle, including disposal', async () => {
    vi.stubGlobal('Image', FakeImage);
    let cleaned = false;
    const batch = settleImageBatch([
      Promise.reject(new Error('Broken metadata')),
      loadCachedImage('/bongo/late-image'),
    ]).finally(() => {
      releaseCachedImages((url) => url.startsWith('/bongo/'));
      cleaned = true;
    });
    const rejection = expect(batch).rejects.toThrow('Broken metadata');
    await Promise.resolve();
    await Promise.resolve();
    expect(cleaned).toBe(false);
    FakeImage.instances[0].onload!();
    await rejection;
    expect(cleaned).toBe(true);
    expect(cachedImageDiagnostics().images).toBe(0);
  });
  it('deduplicates pending loads, preserves them during eviction, and releases decoded references', async () => {
    vi.stubGlobal('Image', FakeImage);
    const first = loadCachedImage('/bongo/hero.png');
    releaseCachedImages(() => true);
    expect(loadCachedImage('/bongo/hero.png')).toBe(first);
    expect(FakeImage.instances).toHaveLength(1);
    FakeImage.instances[0].onload!();
    await first;
    expect(cachedImageDiagnostics()).toMatchObject({ images: 1, decodedBytes: 128 * 128 * 4 });
    releaseCachedImages((url) => url.startsWith('/bongo/'));
    expect(cachedImageDiagnostics().images).toBe(0);
    const next = loadCachedImage('/bongo/hero.png');
    expect(next).not.toBe(first);
    FakeImage.instances[1].onload!();
    await next;
  });
  it('does not evict another host namespace', async () => {
    vi.stubGlobal('Image', FakeImage);
    const a = loadCachedImage('/bongo/a'),
      b = loadCachedImage('/after/b');
    FakeImage.instances.forEach((image) => image.onload!());
    await Promise.all([a, b]);
    releaseCachedImages((url) => url.startsWith('/bongo/'));
    expect(loadCachedImage('/after/b')).toBe(b);
    expect(cachedImageDiagnostics().urls).toEqual(['/after/b']);
  });
  it('retries a failed image without keeping a broken promise', async () => {
    vi.stubGlobal('Image', FakeImage);
    const failed = loadCachedImage('/bongo/failure');
    const rejection = expect(failed).rejects.toThrow();
    FakeImage.instances[0].onerror!();
    await rejection;
    const retry = loadCachedImage('/bongo/failure');
    expect(retry).not.toBe(failed);
    FakeImage.instances[1].onload!();
    await retry;
  });
});
