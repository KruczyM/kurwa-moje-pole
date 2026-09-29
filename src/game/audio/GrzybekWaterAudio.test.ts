import { describe, expect, it } from 'vitest';
import {
  calculateGrzybekSpatialGain,
  GRZYBEK_AUDIO_CONFIG,
  GrzybekWaterAudio,
} from './GrzybekWaterAudio';

describe('GrzybekWaterAudio', () => {
  it('computes full volume inside inner radius', () => {
    expect(calculateGrzybekSpatialGain(0.0)).toBe(1.0);
    expect(calculateGrzybekSpatialGain(2.0)).toBe(1.0);
    expect(calculateGrzybekSpatialGain(GRZYBEK_AUDIO_CONFIG.innerRadius)).toBe(1.0);
  });

  it('drops to zero volume at and beyond maximum radius', () => {
    expect(calculateGrzybekSpatialGain(GRZYBEK_AUDIO_CONFIG.maxRadius)).toBe(0.0);
    expect(calculateGrzybekSpatialGain(GRZYBEK_AUDIO_CONFIG.maxRadius + 10.0)).toBe(0.0);
  });

  it('interpolates smoothly with quadratic falloff between inner and max radius', () => {
    const mid = (GRZYBEK_AUDIO_CONFIG.innerRadius + GRZYBEK_AUDIO_CONFIG.maxRadius) / 2;
    const gainMid = calculateGrzybekSpatialGain(mid);
    expect(gainMid).toBeCloseTo(0.25);
  });

  it('can be instantiated and cleanly disposed without throwing', () => {
    const audio = new GrzybekWaterAudio();
    expect(audio).toBeDefined();
    audio.setMuted(true);
    audio.update(0, 0);
    audio.dispose();
  });
});
