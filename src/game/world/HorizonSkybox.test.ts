import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { skyboxPeriodForHour, skyboxVariantForPeriod } from './HorizonSkybox';

describe('skyboxPeriodForHour', () => {
  it.each([
    [0, 'night'],
    [5, 'night'],
    [6, 'day'],
    [17, 'day'],
    [18, 'evening'],
    [21, 'evening'],
    [22, 'night'],
    [23, 'night'],
  ] as const)('dla godziny %i wybiera %s', (hour, expected) => {
    expect(skyboxPeriodForHour(hour)).toBe(expected);
  });
});

describe('skyboxVariantForPeriod', () => {
  it('nie zmienia wariantu dziennego ani wieczornego', () => {
    expect(skyboxVariantForPeriod('day', 0.9)).toBe('day');
    expect(skyboxVariantForPeriod('evening', 0.1)).toBe('evening');
  });

  it('losuje noc i nebulę z dwóch równych połówek zakresu', () => {
    expect(skyboxVariantForPeriod('night', 0)).toBe('night');
    expect(skyboxVariantForPeriod('night', 0.4999)).toBe('night');
    expect(skyboxVariantForPeriod('night', 0.5)).toBe('nebula');
    expect(skyboxVariantForPeriod('night', 0.9999)).toBe('nebula');
  });
});

describe('HorizonPanorama', () => {
  it('tworzy cylindryczną panoramę z materiałem shaderowym i przezroczystością', async () => {
    const { HorizonPanorama } = await import('./HorizonSkybox');
    const panorama = new HorizonPanorama();

    expect(panorama.mesh).toBeDefined();
    expect(panorama.mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(panorama.mesh.material).toBeInstanceOf(THREE.ShaderMaterial);
    const material = panorama.mesh.material as THREE.ShaderMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.BackSide);

    panorama.dispose();
  });

  it('aktualizuje pozycję X i Z za ruchem kamery gracza', async () => {
    const { HorizonPanorama } = await import('./HorizonSkybox');
    const panorama = new HorizonPanorama();

    panorama.update(new THREE.Vector3(25, 3, -40));
    expect(panorama.mesh.position.x).toBe(25);
    expect(panorama.mesh.position.z).toBe(-40);

    panorama.dispose();
  });

  it('pozwala na podmianę tekstury i zwalnia zasoby', async () => {
    const { HorizonPanorama } = await import('./HorizonSkybox');
    const panorama = new HorizonPanorama();
    const texture = new THREE.Texture();

    panorama.setTexture(texture);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);

    expect(() => panorama.dispose()).not.toThrow();
  });
});
