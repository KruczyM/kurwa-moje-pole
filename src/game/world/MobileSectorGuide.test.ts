import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { MobileSectorGuide } from './MobileSectorGuide';

describe('mobile sector markings', () => {
  it('shows only nearby edges, hides during menus and releases its own resources', () => {
    const hint = { style: {}, hidden: false, textContent: '', setAttribute: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => hint, body: { append: vi.fn() } });
    try {
      const scene = new THREE.Scene();
      const guide = new MobileSectorGuide(scene);
      guide.update(0, 60, 'camp', true);
      expect(hint.hidden).toBe(false);
      expect(hint.textContent).toContain('ASP');
      expect(hint.textContent).toContain('4 m');
      const visible = guide.root.children.filter((o) => o.visible);
      expect(visible).toHaveLength(1);
      expect((visible[0] as THREE.LineSegments).geometry.drawRange.count).toBeLessThan(70);
      guide.update(0, 0, 'camp', true);
      expect(hint.hidden).toBe(true);
      guide.update(0, 60, 'camp', false);
      expect(guide.root.visible).toBe(false);
      expect(hint.hidden).toBe(true);
      const line = visible[0] as THREE.LineSegments;
      const geometryDispose = vi.spyOn(line.geometry, 'dispose');
      const materialDispose = vi.spyOn(line.material as THREE.Material, 'dispose');
      guide.dispose();
      expect(scene.children).toHaveLength(0);
      expect(geometryDispose).toHaveBeenCalledOnce();
      expect(materialDispose).toHaveBeenCalledOnce();
      expect(hint.remove).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
