import { EventScope } from '../lifecycle/EventScope';

const ROTATION_SPEED = 0.008;
const MIN_PITCH = -0.55;
const MAX_PITCH = 0.55;
// Bazowy kadr ma 16% zapasu, dlatego minimalne zbliżenie nadal obejmuje całą sferę modelu.
const MIN_DISTANCE_SCALE = 0.88;
const MAX_DISTANCE_SCALE = 1.65;

type InspectControlTarget = EventTarget & {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
};

/** Ogranicza wartość do bezpiecznego zakresu. */
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Obsługuje obracanie oraz przybliżanie modelu inspekcji bez uruchamiania
 * dodatkowej pętli renderowania. Jeden kontroler może obsłużyć dowolną liczbę
 * kolejno otwieranych przedmiotów.
 */
export class InspectControls {
  yaw = 0;
  pitch = 0;
  distanceScale = 1;
  private pointerId?: number;
  private lastX = 0;
  private lastY = 0;
  private events = new EventScope();

  constructor(private target: InspectControlTarget) {
    this.events.listen(target, 'pointerdown', (event) => this.pointerDown(event as PointerEvent));
    this.events.listen(target, 'pointermove', (event) => this.pointerMove(event as PointerEvent));
    this.events.listen(target, 'pointerup', (event) => this.pointerUp(event as PointerEvent));
    this.events.listen(target, 'pointercancel', (event) => this.pointerUp(event as PointerEvent));
    this.events.listen(target, 'wheel', (event) => this.wheel(event as WheelEvent), { passive: false });
  }

  /** Przywraca początkowy kadr dla nowo otwartego przedmiotu. */
  reset() {
    this.yaw = 0;
    this.pitch = 0;
    this.distanceScale = 1;
    this.pointerId = undefined;
  }

  /** Dodaje łagodny automatyczny obrót tylko wtedy, gdy użytkownik nie przeciąga modelu. */
  update(deltaSeconds: number) {
    if (this.pointerId === undefined) this.yaw += deltaSeconds * 0.75;
  }

  /** Usuwa wszystkie listenery kontrolera. */
  dispose() {
    this.events.dispose();
    this.pointerId = undefined;
  }

  /** Rozpoczyna obracanie jednym aktywnym wskaźnikiem. */
  private pointerDown(event: PointerEvent) {
    if (this.pointerId !== undefined) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.target.setPointerCapture?.(event.pointerId);
  }

  /** Przelicza ruch wskaźnika na obrót wokół środka modelu. */
  private pointerMove(event: PointerEvent) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.yaw += (event.clientX - this.lastX) * ROTATION_SPEED;
    this.pitch = clamp(this.pitch + (event.clientY - this.lastY) * ROTATION_SPEED, MIN_PITCH, MAX_PITCH);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  /** Kończy przeciąganie i ponownie pozwala na automatyczny obrót. */
  private pointerUp(event: PointerEvent) {
    if (event.pointerId !== this.pointerId) return;
    this.target.releasePointerCapture?.(event.pointerId);
    this.pointerId = undefined;
  }

  /** Pozwala zmienić zbliżenie kółkiem bez ryzyka zgubienia modelu poza kadrem. */
  private wheel(event: WheelEvent) {
    event.preventDefault();
    this.distanceScale = clamp(
      this.distanceScale * Math.exp(event.deltaY * 0.001),
      MIN_DISTANCE_SCALE,
      MAX_DISTANCE_SCALE,
    );
  }
}
