import type { EffectId } from '../effects/EffectManager';
import type { InspectableItemId } from './itemConfig';

export type ItemUseSequenceConfig = {
  duration: number;
  effectMarker: number;
  propId?: InspectableItemId;
  propSize: number;
  propPosition: readonly [number, number, number];
  propRotation: readonly [number, number, number];
  motionStrength: number;
  label: string;
};

/**
 * Dane krótkich sekwencji użycia. Ruch ręki jest generowany na wspólnym rigu
 * Mixamo; klip Idle pozostaje jawnym fallbackiem dla niepełnego modelu.
 */
export const itemUseSequenceConfig: Record<EffectId, ItemUseSequenceConfig> = {
  Piwo: {
    duration: 2.6,
    effectMarker: 1.35,
    propSize: 0.18,
    propPosition: [0.08, 0, 0],
    propRotation: [0, 0, 0],
    motionStrength: 0.85,
    label: 'Picie',
  },
  Papieros: {
    duration: 2.7,
    effectMarker: 1.45,
    propSize: 0.12,
    propPosition: [0.06, 0, 0],
    propRotation: [0, 0, 0],
    motionStrength: 0.9,
    label: 'Palenie',
  },
  Joint: {
    duration: 2.8,
    effectMarker: 1.5,
    propId: 'joint',
    propSize: 0.16,
    propPosition: [0.08, 0.01, 0],
    propRotation: [0, 0, Math.PI / 2],
    motionStrength: 0.92,
    label: 'Odpalanie blanta',
  },
  Kreska: {
    duration: 2.35,
    effectMarker: 1.15,
    propId: 'cocaine',
    propSize: 0.18,
    propPosition: [0.09, 0, 0],
    propRotation: [0, Math.PI / 2, 0],
    motionStrength: 1.08,
    label: 'Użycie kreski',
  },
  Grzyb: {
    duration: 2.6,
    effectMarker: 1.35,
    propId: 'mushrooms',
    propSize: 0.17,
    propPosition: [0.08, 0, 0],
    propRotation: [0, 0, 0],
    motionStrength: 0.88,
    label: 'Jedzenie grzybów',
  },
  MDMA: {
    duration: 2.3,
    effectMarker: 1.12,
    propId: 'mdma',
    propSize: 0.13,
    propPosition: [0.07, 0, 0],
    propRotation: [0, 0, 0],
    motionStrength: 1,
    label: 'Użycie MDMA',
  },
  LSD: {
    duration: 2.45,
    effectMarker: 1.22,
    propId: 'lsd',
    propSize: 0.14,
    propPosition: [0.075, 0, 0],
    propRotation: [0, Math.PI / 2, 0],
    motionStrength: 0.96,
    label: 'Użycie LSD',
  },
};

/** Sprawdza poprawność czasów konfiguracji jeszcze przed utworzeniem animacji. */
export function validUseSequenceTiming(config: ItemUseSequenceConfig) {
  return config.duration > 0.8 && config.effectMarker > 0.45 && config.effectMarker < config.duration - 0.35;
}
