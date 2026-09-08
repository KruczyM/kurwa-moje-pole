import { LocomotionClip } from '../animation/animationContract';
import calibration from './locomotionCalibration.json';

export const LOCOMOTION_CYCLE_METERS = Object.freeze(calibration.cycleMeters);

export const NPC_MOTION = Object.freeze(calibration.motion);

/** Mierzy referencyjną prędkość klipu przy timeScale=1 na podstawie czasu pełnego cyklu kroku. */
export function referenceSpeedForCycle(name: 'Walk' | 'Run', clipDuration: number) {
  if (!Number.isFinite(clipDuration) || clipDuration <= 0) return 0;
  return LOCOMOTION_CYCLE_METERS[name] / clipDuration;
}

/** Wylicza timeScale wiążący rytm kroków z rzeczywistą prędkością transformacji w świecie. */
export function timeScaleForWorldSpeed(name: 'Walk' | 'Run', worldSpeed: number, clipDuration: number) {
  const referenceSpeed = referenceSpeedForCycle(name, clipDuration);
  if (referenceSpeed <= 0) return 1;
  const minimum = name === 'Walk' ? 0.2 : 0.35;
  return Math.min(1.65, Math.max(minimum, Math.max(0, worldSpeed) / referenceSpeed));
}

/** Zbliża prędkość do celu z ograniczonym przyspieszeniem albo hamowaniem. */
export function approachSpeed(
  current: number,
  target: number,
  deltaTime: number,
  acceleration: number = NPC_MOTION.acceleration,
  deceleration: number = NPC_MOTION.deceleration,
) {
  const safeDelta = Math.max(0, deltaTime);
  const rate = target > current ? acceleration : deceleration;
  const step = Math.max(0, rate) * safeDelta;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/** Ogranicza prędkość przed celem tak, aby NPC mógł wyhamować bez nagłego zatrzymania. */
export function brakingSpeed(distance: number, maximumSpeed: number) {
  const brakingDistance = Math.max(0, distance - NPC_MOTION.arrivalRadius);
  return Math.min(maximumSpeed, Math.sqrt(2 * NPC_MOTION.deceleration * brakingDistance));
}

/** Wybiera klip na podstawie rzeczywistej prędkości, zachowując Run wyłącznie podczas powrotu. */
export function locomotionForSpeed(speed: number, returning: boolean): LocomotionClip {
  if (speed < NPC_MOTION.idleSpeedThreshold) return 'Idle';
  if (returning && speed >= NPC_MOTION.runSpeedThreshold) return 'Run';
  return 'Walk';
}
