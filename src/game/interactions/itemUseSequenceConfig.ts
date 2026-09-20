import type { EffectId } from '../effects/EffectManager';
import type { InspectableItemId } from './itemConfig';

export type ItemUseSequenceConfig = {
  gesture: 'smoke' | 'sniff' | 'eat' | 'drink';
  duration: number;
  effectMarker: number;
  propId?: InspectableItemId;
  propSize: number;
  propPosition: readonly [number, number, number];
  propRotation: readonly [number, number, number];
  consumeProp: boolean;
  label: string;
};

/**
 * Dane krótkich sekwencji użycia. Ruch ręki jest generowany na wspólnym rigu
 * Mixamo; klip Idle pozostaje jawnym fallbackiem dla niepełnego modelu.
 */
export const itemUseSequenceConfig: Record<EffectId, ItemUseSequenceConfig> = {
  Piwo: {
    gesture: 'drink',
    duration: 2.6,
    effectMarker: 1.35,
    propSize: 0.24,
    propPosition: [0, 0, 0],
    propRotation: [0, 0, 0],
    consumeProp: false,
    label: 'Picie',
  },
  Papieros: {
    gesture: 'smoke',
    propId: 'cigarette',
    duration: 3.6,
    effectMarker: 1.8,
    propSize: 0.12,
    propPosition: [0, 0, 0],
    propRotation: [0, 0, 0],
    consumeProp: false,
    label: 'Palenie',
  },
  Joint: {
    gesture: 'smoke',
    duration: 3.6,
    effectMarker: 1.8,
    propId: 'joint',
    propSize: 0.16,
    propPosition: [0, 0, 0],
    propRotation: [0, 0, 0],
    consumeProp: false,
    label: 'Odpalanie blanta',
  },
  Kreska: {
    gesture: 'sniff',
    duration: 3.1,
    effectMarker: 1.65,
    propId: 'cocaine',
    propSize: 0.18,
    propPosition: [0, 0, 0],
    propRotation: [0, Math.PI / 2, 0],
    consumeProp: false,
    label: 'Wciąganie kreski',
  },
  Grzyb: {
    gesture: 'eat',
    duration: 2.6,
    effectMarker: 1.35,
    propId: 'mushrooms',
    propSize: 0.17,
    propPosition: [0, 0, 0],
    propRotation: [0, 0, 0],
    consumeProp: true,
    label: 'Jedzenie grzybów',
  },
  MDMA: {
    gesture: 'eat',
    duration: 2.3,
    effectMarker: 1.12,
    propId: 'mdma',
    propSize: 0.045,
    propPosition: [0, 0, 0],
    propRotation: [0, 0, 0],
    consumeProp: true,
    label: 'Użycie MDMA',
  },
  LSD: {
    gesture: 'eat',
    duration: 2.45,
    effectMarker: 1.22,
    propId: 'lsd',
    propSize: 0.04,
    propPosition: [0, 0, 0],
    propRotation: [0, Math.PI / 2, 0],
    consumeProp: true,
    label: 'Użycie LSD',
  },
};

/** Sprawdza poprawność czasów konfiguracji jeszcze przed utworzeniem animacji. */
export function validUseSequenceTiming(config: ItemUseSequenceConfig) {
  return config.duration > 0.8 && config.effectMarker > 0.45 && config.effectMarker < config.duration - 0.35;
}
