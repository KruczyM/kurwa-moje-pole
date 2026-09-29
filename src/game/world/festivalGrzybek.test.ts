import { describe, expect, it } from 'vitest';
import {
  distanceToGrzybek,
  GRZYBEK_SITE,
  GrzybekWaterParticles,
  isInGrzybekCoolingZone,
} from './festivalGrzybek';

describe('festivalGrzybek', () => {
  it('identifies points within the cooling zone correctly', () => {
    expect(isInGrzybekCoolingZone(GRZYBEK_SITE.x, GRZYBEK_SITE.z)).toBe(true);
    expect(isInGrzybekCoolingZone(GRZYBEK_SITE.x + 4.0, GRZYBEK_SITE.z)).toBe(true);
    expect(isInGrzybekCoolingZone(GRZYBEK_SITE.x, GRZYBEK_SITE.z + 5.0)).toBe(true);
    expect(isInGrzybekCoolingZone(GRZYBEK_SITE.x + 6.0, GRZYBEK_SITE.z)).toBe(false);
  });

  it('calculates Euclidean distance to grzybek mast', () => {
    expect(distanceToGrzybek(GRZYBEK_SITE.x, GRZYBEK_SITE.z)).toBe(0);
    expect(distanceToGrzybek(GRZYBEK_SITE.x + 3, GRZYBEK_SITE.z + 4)).toBeCloseTo(5.0);
  });

  it('creates particle system and updates positions over time', () => {
    const particles = new GrzybekWaterParticles(100);
    expect(particles.points).toBeDefined();
    expect(particles.points.position.x).toBe(GRZYBEK_SITE.x);
    expect(particles.points.position.z).toBe(GRZYBEK_SITE.z);

    const posAttr = particles.points.geometry.attributes.position;
    expect(posAttr.count).toBe(100);

    const initialY0 = posAttr.getY(0);
    particles.update(0.05);
    const updatedY0 = posAttr.getY(0);

    expect(updatedY0).not.toBe(initialY0);
    particles.dispose();
  });
});
