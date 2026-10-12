/** Menu-only illustrations. Combat atlases and other games keep their own assets. */
export function selectionArtUrl(base: string, id: string, size: 'thumb' | 'full'): string {
  return `${base.endsWith('/') ? base : `${base}/`}game-assets/2d/fighter/selection-v1/${encodeURIComponent(id)}-${size}.webp`;
}
