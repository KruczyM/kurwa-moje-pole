import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  formatTentDimensions,
  interactionDebugEnabled,
  physicalScale,
  physicalSizeIsValid,
  terrainHeight,
  TOILET_HEIGHT_METERS,
} from './CampWorld';
import { campPosition } from './campLayout';

describe('CampWorld terrain placement', () => {
  it('places wcTron on the same procedural surface that is rendered below it', () => {
    const [x, , z] = campPosition(8, 18);
    const height = terrainHeight(x, z);

    expect(Number.isFinite(height)).toBe(true);
    expect(height).toBeGreaterThan(-0.3);
    expect(height).toBeLessThan(0.3);
  });

  it('keeps wcTron at least twice as tall as a nominal 1.8 m character', () => {
    expect(TOILET_HEIGHT_METERS).toBeGreaterThanOrEqual(1.8 * 2);
  });

  it('enables interaction hitboxes only through an explicit URL flag', () => {
    expect(interactionDebugEnabled('?debugInteractions=1')).toBe(true);
    expect(interactionDebugEnabled('?debugInteractions=0')).toBe(false);
    expect(interactionDebugEnabled('')).toBe(false);
  });

  it('uses uniform scale for correctly proportioned tents', () => {
    const scale = physicalScale(new THREE.Vector3(2, 1, 2), [2.5, 1.25, 2.5], 'uniform-height');
    expect(scale.toArray()).toEqual([1.25, 1.25, 1.25]);
  });

  it('corrects each axis only for a source model with incorrect proportions', () => {
    const scale = physicalScale(new THREE.Vector3(4, 3, 5), [3.65, 2.1, 5.6], 'exact-source-correction');
    expect(new THREE.Vector3(4, 3, 5).multiply(scale).toArray()).toEqual([3.65, 2.1, 5.6]);
    expect(formatTentDimensions('T01', new THREE.Vector3(3.65, 2.1, 5.6))).toBe(
      'T01: 3.65m × 5.60m, wysokość 2.10m',
    );
    expect(
      physicalSizeIsValid(new THREE.Vector3(3.65, 2.1, 5.6), [3.65, 2.1, 5.6], 'exact-source-correction'),
    ).toBe(true);
    expect(physicalSizeIsValid(new THREE.Vector3(30, 1.25, 30), [2, 1.25, 2], 'uniform-height')).toBe(true);
  });
});
