/**
 * Harmonogram obrotu i faz Młyna Diabelskiego (Ferris Wheel Schedule — A1)
 *
 * Czysty moduł matematyczny bez zależności od Three.js, Date.now ani operacji I/O.
 * Cykl: dół 12 s -> wjazd 36 s -> góra 5 s -> zjazd 36 s = 89 s.
 * Płynne przyspieszanie i hamowanie wielomianem Perlin quintic smootherstep: 6u^5 - 15u^4 + 10u^3.
 */

export type WheelSchedulePhase = 'bottom' | 'ascending' | 'top' | 'descending';

export interface WheelScheduleSample {
  /** Kąt obrotu rotora w radianach [0, 2π) */
  angle: number;
  /** Aktualna faza cyklu */
  phase: WheelSchedulePhase;
  /** Czy koło stoi w miejscu (postój na dole lub widokowy na górze) */
  stopped: boolean;
  /** Liczba sekund do zakończenia bieżącej fazy */
  secondsToPhaseEnd: number;
}

export const WHEEL_SCHEDULE_DURATIONS = {
  bottom: 12,
  ascending: 36,
  top: 5,
  descending: 36,
} as const;

export const WHEEL_CYCLE_SECONDS =
  WHEEL_SCHEDULE_DURATIONS.bottom +
  WHEEL_SCHEDULE_DURATIONS.ascending +
  WHEEL_SCHEDULE_DURATIONS.top +
  WHEEL_SCHEDULE_DURATIONS.descending; // 89 s

/**
 * Wielomian quintic smootherstep: 6u^5 - 15u^4 + 10u^3 dla u in [0, 1].
 * Zapewnia zerową prędkość oraz zerowe przyspieszenie na początku i końcu ruchu (C2 continuity).
 */
export function smootherstep(u: number): number {
  const clamped = Math.max(0, Math.min(1, u));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/**
 * Próbkuje harmonogram koła dla zadanego czasu w sekundach `timeSeconds`.
 * - Niepoprawny, NaN, nieskończony lub ujemny czas zwraca stan zerowy (początek fazy dolnej).
 * - Czas jest liczony modulo WHEEL_CYCLE_SECONDS (89s), zapewniając powtarzalność cykli.
 */
export function sampleWheelSchedule(timeSeconds: number): WheelScheduleSample {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    return {
      angle: 0,
      phase: 'bottom',
      stopped: true,
      secondsToPhaseEnd: WHEEL_SCHEDULE_DURATIONS.bottom,
    };
  }

  const cycleTime = timeSeconds % WHEEL_CYCLE_SECONDS;

  const tBottomEnd = WHEEL_SCHEDULE_DURATIONS.bottom; // 12
  const tAscEnd = tBottomEnd + WHEEL_SCHEDULE_DURATIONS.ascending; // 48
  const tTopEnd = tAscEnd + WHEEL_SCHEDULE_DURATIONS.top; // 53
  const TWO_PI = Math.PI * 2;

  // Faza 1: Postój dolny (wsiadanie / wysiadanie)
  if (cycleTime < tBottomEnd) {
    return {
      angle: 0,
      phase: 'bottom',
      stopped: true,
      secondsToPhaseEnd: tBottomEnd - cycleTime,
    };
  }

  // Faza 2: Wjazd na górę (od kąta 0 do Pi)
  if (cycleTime < tAscEnd) {
    const elapsed = cycleTime - tBottomEnd;
    const u = elapsed / WHEEL_SCHEDULE_DURATIONS.ascending;
    const angle = Math.PI * smootherstep(u);
    return {
      angle,
      phase: 'ascending',
      stopped: false,
      secondsToPhaseEnd: tAscEnd - cycleTime,
    };
  }

  // Faza 3: Postój na szczycie (podziwianie panoramy festiwalu)
  // UWAGA: stopped na górze NIE oznacza zgody na wysiadanie!
  if (cycleTime < tTopEnd) {
    return {
      angle: Math.PI,
      phase: 'top',
      stopped: true,
      secondsToPhaseEnd: tTopEnd - cycleTime,
    };
  }

  // Faza 4: Zjazd na dół (od kąta Pi do 2*Pi)
  const elapsed = cycleTime - tTopEnd;
  const u = elapsed / WHEEL_SCHEDULE_DURATIONS.descending;
  const angle = (Math.PI + Math.PI * smootherstep(u)) % TWO_PI;

  return {
    angle,
    phase: 'descending',
    stopped: false,
    secondsToPhaseEnd: WHEEL_CYCLE_SECONDS - cycleTime,
  };
}
