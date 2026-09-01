import type { AppState } from '../lifecycle/AppStateMachine';
import { EventScope } from '../lifecycle/EventScope';

export type MobileControlActions = {
  move: (forward: number, right: number, run: boolean) => void;
  look: (deltaX: number, deltaY: number) => void;
  interact: () => void;
  menu: () => void;
  inventory: () => void;
};

export type JoystickInput = {
  forward: number;
  right: number;
  run: boolean;
  knobX: number;
  knobY: number;
};

/** Zamienia przesunięcie palca na ograniczony wektor ruchu i pozycję gałki. */
export function joystickInput(deltaX: number, deltaY: number, radius: number): JoystickInput {
  const safeRadius = Math.max(1, radius);
  const distance = Math.hypot(deltaX, deltaY);
  const clampScale = distance > safeRadius ? safeRadius / distance : 1;
  const knobX = deltaX * clampScale;
  const knobY = deltaY * clampScale;
  const strength = Math.min(1, distance / safeRadius);
  return {
    forward: -knobY / safeRadius,
    right: knobX / safeRadius,
    run: strength >= 0.88,
    knobX,
    knobY,
  };
}

/** Rozpoznaje urządzenie, na którym podstawowym wejściem jest dotyk. */
export function shouldUseMobileControls(coarsePointer: boolean, maxTouchPoints: number) {
  return coarsePointer || maxTouchPoints > 0;
}

/** Odczytuje możliwości dotykowe aktualnej przeglądarki. */
export function isMobileInputDevice() {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints;
  return shouldUseMobileControls(coarsePointer, maxTouchPoints);
}

/** Łączy joystick, gest rozglądania i kontekstowe przyciski z akcjami gry. */
export class MobileControls {
  private readonly events = new EventScope();
  private readonly movement: HTMLElement;
  private readonly lookZone: HTMLElement;
  private readonly pad: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly menuButton: HTMLButtonElement;
  private readonly inventoryButton: HTMLButtonElement;
  private readonly interactButton: HTMLButtonElement;
  private movePointerId?: number;
  private lookPointerId?: number;
  private lookX = 0;
  private lookY = 0;
  private playing = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: MobileControlActions,
  ) {
    this.movement = this.requireElement('.mobile-movement');
    this.lookZone = this.requireElement('.mobile-look-zone');
    this.pad = this.requireElement('.mobile-joystick');
    this.knob = this.requireElement('.mobile-joystick-knob');
    this.menuButton = this.requireElement('#mobile-menu');
    this.inventoryButton = this.requireElement('#mobile-inventory');
    this.interactButton = this.requireElement('#mobile-interact');

    this.events.listen(this.pad, 'pointerdown', (event) => this.startMove(event as PointerEvent));
    this.events.listen(this.pad, 'pointermove', (event) => this.updateMove(event as PointerEvent));
    this.events.listen(this.pad, 'pointerup', (event) => this.finishMove(event as PointerEvent));
    this.events.listen(this.pad, 'pointercancel', (event) => this.finishMove(event as PointerEvent));
    this.events.listen(this.lookZone, 'pointerdown', (event) => this.startLook(event as PointerEvent));
    this.events.listen(this.lookZone, 'pointermove', (event) => this.updateLook(event as PointerEvent));
    this.events.listen(this.lookZone, 'pointerup', (event) => this.finishLook(event as PointerEvent));
    this.events.listen(this.lookZone, 'pointercancel', (event) => this.finishLook(event as PointerEvent));
    this.events.listen(this.menuButton, 'click', () => this.actions.menu());
    this.events.listen(this.inventoryButton, 'click', () => this.actions.inventory());
    this.events.listen(this.interactButton, 'click', () => this.actions.interact());
    document.body.classList.add('mobile-input');
  }

  /** Wymaga elementu należącego do warstwy mobilnej i zachowuje jego typ. */
  private requireElement<T extends HTMLElement>(selector: string) {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Brak kontrolki mobilnej: ${selector}`);
    return element;
  }

  /** Pokazuje tylko te przyciski, które mają sens w aktualnym stanie aplikacji. */
  setState(state: AppState) {
    this.playing = state === 'playing';
    const inventoryOpen = state === 'inventory';
    this.root.hidden = !this.playing && !inventoryOpen;
    this.movement.hidden = !this.playing;
    this.menuButton.hidden = !this.playing;
    this.interactButton.hidden = !this.playing;
    this.lookZone.hidden = !this.playing;
    this.inventoryButton.textContent = inventoryOpen ? 'ZAMKNIJ' : 'EKWIPUNEK';
    this.inventoryButton.setAttribute('aria-pressed', String(inventoryOpen));
    if (!this.playing) {
      this.resetMove();
      this.resetLook();
    }
  }

  /** Przejmuje palec joysticka bez wpływania na gest kamery. */
  private startMove(event: PointerEvent) {
    if (!this.playing || this.movePointerId !== undefined) return;
    event.preventDefault();
    event.stopPropagation();
    this.movePointerId = event.pointerId;
    this.pad.setPointerCapture?.(event.pointerId);
    this.updateMove(event);
  }

  /** Aktualizuje ruch względem środka joysticka. */
  private updateMove(event: PointerEvent) {
    if (event.pointerId !== this.movePointerId) return;
    event.preventDefault();
    const bounds = this.pad.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.36);
    const input = joystickInput(
      event.clientX - (bounds.left + bounds.width / 2),
      event.clientY - (bounds.top + bounds.height / 2),
      radius,
    );
    this.knob.style.transform = `translate(${input.knobX}px, ${input.knobY}px)`;
    this.actions.move(input.forward, input.right, input.run);
  }

  /** Zwalnia joystick i natychmiast zatrzymuje ruch dotykowy. */
  private finishMove(event: PointerEvent) {
    if (event.pointerId !== this.movePointerId) return;
    event.preventDefault();
    this.movePointerId = undefined;
    this.resetMove();
  }

  /** Rozpoczyna rozglądanie jednym palcem przesuwanym po scenie. */
  private startLook(event: PointerEvent) {
    if (!this.playing || event.pointerType === 'mouse' || this.lookPointerId !== undefined) return;
    event.preventDefault();
    this.lookPointerId = event.pointerId;
    this.lookX = event.clientX;
    this.lookY = event.clientY;
    this.lookZone.setPointerCapture?.(event.pointerId);
  }

  /** Przekazuje ograniczoną deltę gestu do kontrolera kamery. */
  private updateLook(event: PointerEvent) {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();
    const deltaX = Math.max(-80, Math.min(80, event.clientX - this.lookX));
    const deltaY = Math.max(-80, Math.min(80, event.clientY - this.lookY));
    this.lookX = event.clientX;
    this.lookY = event.clientY;
    this.actions.look(deltaX, deltaY);
  }

  /** Kończy gest kamery przypisany do danego palca. */
  private finishLook(event: PointerEvent) {
    if (event.pointerId !== this.lookPointerId) return;
    event.preventDefault();
    this.lookPointerId = undefined;
  }

  /** Porzuca poprzedni gest, aby pierwszy dotyk po zmianie ekranu zawsze działał. */
  private resetLook() {
    this.lookPointerId = undefined;
    this.lookX = 0;
    this.lookY = 0;
  }

  /** Zeruje wizualną i logiczną pozycję joysticka. */
  private resetMove() {
    this.movePointerId = undefined;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.actions.move(0, 0, false);
  }

  /** Usuwa listenery i przywraca neutralny stan interfejsu. */
  dispose() {
    this.resetMove();
    this.resetLook();
    this.events.dispose();
    this.root.hidden = true;
    document.body.classList.remove('mobile-input');
  }
}
