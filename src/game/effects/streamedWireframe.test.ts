import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { MushroomWireframeEffect } from './MushroomWireframeEffect';
import { MatrixWireframeEffect } from './MatrixWireframeEffect';

describe.each(['matrix', 'mushroom'])('streamed %s wireframe', (kind) => {
  it('does not retain evicted sectors, touch collision proxies or hidden sectors', () => {
    const scene = new THREE.Scene(),
      sector = new THREE.Group(),
      hidden = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const proxy = mesh.clone();
    proxy.userData.fogProxy = true;
    const distant = mesh.clone();
    hidden.visible = false;
    hidden.add(distant);
    sector.add(mesh, proxy);
    scene.add(sector, hidden);
    const effect = kind === 'matrix' ? new MatrixWireframeEffect(scene) : new MushroomWireframeEffect(scene);
    if (effect instanceof MatrixWireframeEffect) effect.update(true, 1, false);
    else effect.update(true, 0.6, 1, false);
    expect(mesh.material).not.toBe(material);
    expect(proxy.material).toBe(material);
    expect(distant.material).toBe(material);
    const dispose = vi.fn();
    mesh.material.addEventListener('dispose', dispose);
    effect.releaseSubtree(sector);
    expect(mesh.material).toBe(material);
    expect(dispose).toHaveBeenCalledOnce();
    effect.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
