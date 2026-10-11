import './demo.css';
import { AnimationLoop } from '../../../game/lifecycle/AnimationLoop';
import { EventScope } from '../../../game/lifecycle/EventScope';
import { AfterCampaign } from '../AfterCampaign';
import { createPilotMap } from '../data/pilotMap';
import { PILOT_QUESTS } from '../data/pilotStory';
import { AfterPresentation } from '../presentation/AfterPresentation';
import { CameraRig } from '../presentation/CameraRig';
import type { SpriteMetadata } from '../presentation/SpriteAnimator';
import type { Point } from '../simulation/WorldState';

/** Looks up required demo markup once, failing visibly instead of drawing a blank page. */
function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing demo element: ${id}`);
  return node as T;
}

const BASE = `${import.meta.env.BASE_URL}game-assets/2d/after/`;
const SLOT = 'local';
const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Loads each lightweight 2D image once; no festival GLBs, motion bank or network connection. */
function loadImage(path: string): Promise<HTMLImageElement> {
  let request = imageCache.get(path);
  if (!request) {
    request = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Nie wczytano grafiki: ${path}`));
      image.src = BASE + path;
    });
    imageCache.set(path, request);
  }
  return request;
}

/** Isolated offline demo host; reuses AnimationLoop and never starts the festival game. */
class AfterDemo {
  private readonly events = new EventScope();
  private readonly canvas = element<HTMLCanvasElement>('after-canvas');
  private readonly context = this.canvas.getContext('2d');
  private readonly camera = new CameraRig({ width: 24, height: 18 });
  private readonly map = createPilotMap();
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly metadata = new Map<string, SpriteMetadata>();
  private readonly keys = new Set<string>();
  private readonly touchKeys = new Map<number, string>();
  private readonly loop = new AnimationLoop((time) => this.frame(time));
  private readonly presentation = new AfterPresentation(this.camera, (id) => {
    const meta = this.metadata.get(id);
    if (!meta) throw new Error(`Missing atlas: ${id}`);
    return meta;
  });
  private campaign?: AfterCampaign;
  private lastTime = 0;
  private sequence = 0;
  private choiceSequence = 0;
  private paused = false;
  private width = 1;
  private height = 1;
  private pixelsPerMeter = 48;
  private dialogueKey = '';
  private uiClock = 0;
  private disposed = false;
  private readonly observer = new ResizeObserver(() => this.resize());

  /** Loads only two pilot heroes and the small subset of existing art required by this map. */
  async start(): Promise<void> {
    if (!this.context) throw new Error('Przeglądarka nie udostępnia Canvas 2D.');
    const assets = [
      'tiles/grass.png',
      'tiles/dirt_path.png',
      'tiles/fence_barrier.png',
      'props/tent_large.png',
      'props/camp_flag.png',
      'props/cable_reel.png',
      'props/power_generator.png',
      'props/items/powerbank.png',
    ];
    for (const id of ['Amper', 'Chlebak']) {
      const path = `characters/${id.toLowerCase()}`;
      assets.push(`${path}/spritesheet.png`);
      const response = await fetch(`${BASE}${path}/meta.json`);
      if (!response.ok) throw new Error(`Nie wczytano atlasu: ${id}`);
      this.metadata.set(id, (await response.json()) as SpriteMetadata);
    }
    await Promise.all(assets.map(async (path) => this.images.set(path, await loadImage(path))));
    if (this.disposed) return;
    this.bind();
    this.observer.observe(element('after-app'));
    this.resize();
    element<HTMLButtonElement>('begin').disabled = false;
    element('begin').textContent = 'Wejdź w noc';
    element('status').textContent = 'Wersja demonstracyjna — bez zapisu. Trzy zadania i finał.';
    this.loop.start();
  }

  /** Starts a fresh local pilot and clears stale input/dialogue state. */
  private begin(): void {
    this.campaign = new AfterCampaign();
    this.campaign.addPlayer(
      SLOT,
      element<HTMLSelectElement>('hero').value === 'Chlebak' ? 'Chlebak' : 'Amper',
    );
    this.sequence = this.choiceSequence = 0;
    this.paused = false;
    this.clearInput();
    this.presentation.dispose();
    this.dialogueKey = '';
    for (const id of ['start', 'finish', 'pause-panel', 'dialogue']) element(id).hidden = true;
    this.refreshUI();
  }

  /** Binds scoped keyboard, multitouch, lifecycle and accessible button actions. */
  private bind(): void {
    this.events.listen(element('begin'), 'click', () => this.begin());
    this.events.listen(element('restart'), 'click', () => this.begin());
    this.events.listen(element('interact'), 'click', () => this.interact());
    this.events.listen(element('pause'), 'click', () => this.back());
    this.events.listen(element('resume'), 'click', () => this.setPaused(false));
    this.events.listen(element('close-dialogue'), 'click', () => this.closeDialogue());
    this.events.listen(window, 'keydown', (event) => {
      const key = event as KeyboardEvent;
      if (!element('start').hidden || (key.target as HTMLElement)?.matches('select')) return;
      const value = key.key.length === 1 ? key.key.toLowerCase() : key.key;
      if (
        [
          'w',
          'a',
          's',
          'd',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Shift',
          'e',
          'Escape',
        ].includes(value)
      )
        key.preventDefault();
      if (value === 'Escape' && !key.repeat) this.back();
      else if (value === 'e' && !key.repeat) this.interact();
      else this.keys.add(value);
    });
    this.events.listen(window, 'keyup', (event) => {
      const key = (event as KeyboardEvent).key;
      this.keys.delete(key.length === 1 ? key.toLowerCase() : key);
    });
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-key]'))) {
      this.events.listen(button, 'pointerdown', (event) => {
        const pointer = event as PointerEvent;
        pointer.preventDefault();
        button.setPointerCapture(pointer.pointerId);
        this.touchKeys.set(pointer.pointerId, button.dataset.key!);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
        this.events.listen(button, type, (event) => this.touchKeys.delete((event as PointerEvent).pointerId));
    }
    this.events.listen(window, 'blur', () => {
      this.clearInput();
      if (this.campaign) this.setPaused(true);
    });
    this.events.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.clearInput();
        if (this.campaign) this.setPaused(true);
      }
      this.lastTime = 0;
    });
    this.events.listen(window, 'pagehide', (event) => {
      if ((event as PageTransitionEvent).persisted) this.setPaused(true);
      else this.dispose();
    });
  }

  /** Removes all held keyboard and pointer directions at overlay/lifecycle boundaries. */
  private clearInput(): void {
    this.keys.clear();
    this.touchKeys.clear();
    this.campaign?.setInput(SLOT, { moveX: 0, moveY: 0, sprint: false });
  }

  /** Escape/back closes only the top conversation, otherwise toggles the local pause panel. */
  private back(): void {
    if (!this.campaign || this.campaign.snapshot().finished) return;
    if (this.campaign.dialogue(SLOT)) this.closeDialogue();
    else this.setPaused(!this.paused);
  }

  /** Freezes simulation without stopping the host's only animation loop. */
  private setPaused(value: boolean): void {
    this.paused = value;
    this.clearInput();
    this.campaign?.setPaused(value);
    element('pause-panel').hidden = !value || !!this.campaign?.snapshot().finished;
    this.refreshUI();
  }

  /** Closes dialogue without opening pause or applying another choice effect. */
  private closeDialogue(): void {
    this.campaign?.closeDialogue(SLOT);
    this.clearInput();
    this.refreshUI();
  }

  /** Sends a fresh legal command through the same story-aware selector as the prompt. */
  private interact(): void {
    if (!this.campaign || this.paused) return;
    const target = this.campaign.prompt(SLOT);
    if (!target) return;
    this.campaign.interact({
      sessionId: 'after-pilot',
      slotId: SLOT,
      sequence: ++this.sequence,
      targetId: target.id,
    });
    this.clearInput();
    this.refreshUI();
  }

  /** Sizes only the existing canvas; caps backing-store DPR to limit phone memory. */
  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.pixelsPerMeter = this.width < 600 ? 42 : 56;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize({ width: this.width, height: this.height, pixelsPerMeter: this.pixelsPerMeter });
  }

  /** Runs input, fixed-tick campaign and interpolation from the reused single host loop. */
  private frame(time: number): void {
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.25) : 0;
    this.lastTime = time;
    const held = (key: string) => this.keys.has(key) || [...this.touchKeys.values()].includes(key);
    this.campaign?.setInput(SLOT, {
      moveX: Number(held('d') || held('ArrowRight')) - Number(held('a') || held('ArrowLeft')),
      moveY: Number(held('s') || held('ArrowDown')) - Number(held('w') || held('ArrowUp')),
      sprint: held('Shift'),
    });
    const alpha = this.campaign?.advance(dt) ?? 1;
    this.draw(alpha, dt);
    this.uiClock += dt;
    if (this.uiClock >= 0.1) {
      this.uiClock = 0;
      this.refreshUI();
    }
  }

  /** Draws the authored pilot with foot anchors; no GLB, Three.js renderer or hidden world. */
  private draw(alpha: number, dt: number): void {
    const ctx = this.context!;
    const state = this.campaign?.snapshot();
    const players = state
      ? this.presentation.update(state.world, alpha, dt, SLOT, this.paused || state.finished)
      : [];
    if (!state) this.camera.follow({ x: 9, y: 10 }, 0);
    ctx.fillStyle = '#101c23';
    ctx.fillRect(0, 0, this.width, this.height);
    const unit = this.pixelsPerMeter;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < this.map.height; y++)
      for (let x = 0; x < this.map.width; x++) {
        const p = this.camera.project({ x, y });
        if (p.x < -unit || p.y < -unit || p.x > this.width || p.y > this.height) continue;
        const boundary = x === 0 || y === 0 || x === this.map.width - 1 || y === this.map.height - 1;
        const path = boundary
          ? 'tiles/fence_barrier.png'
          : y === 10 || x === 5
            ? 'tiles/dirt_path.png'
            : 'tiles/grass.png';
        ctx.drawImage(this.images.get(path)!, p.x, p.y, unit + 0.5, unit + 0.5);
      }
    const objects: { depth: number; draw: () => void }[] = [];
    objects.push({ depth: 8, draw: () => this.prop('props/tent_large.png', { x: 11, y: 8 }, 4, 3) });
    const flags = state?.world.flags ?? [];
    const labels: Record<string, string> = {
      witness: 'Świadek',
      flag: 'Flaga',
      radio: 'Radio',
      tracks: 'Ślady',
      friend: 'Znajomy',
      cable: 'Kabel',
      power: 'Zasilanie',
      'camp-return': 'Obóz',
      technician: 'Techniczny',
    };
    const props: Record<string, string> = {
      flag: 'props/camp_flag.png',
      cable: 'props/cable_reel.png',
      power: 'props/power_generator.png',
      radio: 'props/items/powerbank.png',
    };
    for (const target of this.map.interactions) {
      if (target.once && flags.includes(`interaction:${target.id}`)) continue;
      objects.push({
        depth: target.position.y,
        draw: () => {
          const p = this.camera.project(target.position);
          if (['witness', 'friend', 'technician'].includes(target.id)) {
            ctx.drawImage(
              this.images.get('characters/chlebak/spritesheet.png')!,
              0,
              0,
              64,
              64,
              p.x - unit * 0.7,
              p.y - unit * 1.4,
              unit * 1.4,
              unit * 1.4,
            );
          } else if (props[target.id]) this.prop(props[target.id], target.position, 1.1, 1.1);
          else {
            ctx.fillStyle = '#ffda6b';
            ctx.beginPath();
            ctx.arc(p.x, p.y - 8, 6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.font = '12px system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#101c23dd';
          const label = labels[target.id];
          const width = ctx.measureText(label).width + 12;
          ctx.fillRect(p.x - width / 2, p.y + 3, width, 20);
          ctx.fillStyle = '#fff6cf';
          ctx.fillText(label, p.x, p.y + 17);
        },
      });
    }
    for (const player of players)
      objects.push({
        depth: player.feet.y,
        draw: () => {
          const p = player.screenFeet,
            f = player.frame;
          ctx.fillStyle = '#0005';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 4, unit * 0.3, unit * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(
            this.images.get(`characters/${player.characterId.toLowerCase()}/spritesheet.png`)!,
            f.x,
            f.y,
            f.width,
            f.height,
            p.x - unit * 0.75,
            p.y - unit * 1.5,
            unit * 1.5,
            unit * 1.5,
          );
        },
      });
    objects.sort((a, b) => a.depth - b.depth).forEach((object) => object.draw());
    ctx.fillStyle = state?.world.nightPhase === 'before-dawn' ? '#343d6418' : '#10204032';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Draws a cached prop centered horizontally and anchored at its feet. */
  private prop(path: string, feet: Point, width: number, height: number): void {
    const p = this.camera.project(feet),
      unit = this.pixelsPerMeter;
    this.context!.drawImage(
      this.images.get(path)!,
      p.x - (width * unit) / 2,
      p.y - height * unit,
      width * unit,
      height * unit,
    );
  }

  /** Updates plain-text HUD and rebuilds dialogue buttons only when its revision changes. */
  private refreshUI(): void {
    if (!this.campaign) return;
    const state = this.campaign.snapshot();
    const completed = state.story.completedQuestIds;
    element('goals').textContent = PILOT_QUESTS.map(
      (quest) => `${completed.includes(quest.id) ? '✓' : '○'} ${quest.title}`,
    ).join(' · ');
    element('status').textContent = state.finished
      ? 'Pilot ukończony.'
      : `Kondycja: ${Math.round(state.world.players[0].stamina)}% · ${completed.length === 3 ? 'Wróć do obozu!' : 'Szukaj podpisanych punktów. Włącz światło po podłączeniu kabla.'}`;
    element('finish').hidden = !state.finished;
    const dialogue = this.campaign.dialogue(SLOT);
    element('dialogue').hidden = !dialogue || this.paused;
    const key = dialogue ? `${dialogue.conversationId}:${dialogue.revision}` : '';
    if (key !== this.dialogueKey) {
      this.dialogueKey = key;
      element('choices').replaceChildren();
      if (dialogue) {
        element('speaker').textContent = dialogue.speaker;
        element('speech').textContent = dialogue.text;
        for (const choice of dialogue.choices) {
          const button = document.createElement('button');
          button.textContent = choice.text;
          button.onclick = () => {
            this.campaign?.chooseDialogue({
              sessionId: 'after-pilot',
              slotId: SLOT,
              conversationId: dialogue.conversationId,
              revision: dialogue.revision,
              sequence: ++this.choiceSequence,
              choiceId: choice.id,
            });
            this.refreshUI();
          };
          element('choices').append(button);
        }
      }
    }
    const prompt = this.campaign.prompt(SLOT);
    const action = element<HTMLButtonElement>('interact');
    action.disabled = !prompt || this.paused || state.finished;
    action.textContent = prompt ? `E · ${prompt.prompt}` : 'Podejdź do celu';
    element('controls').hidden = this.paused || !!dialogue || state.finished;
  }

  /** Stops the one RAF and releases scoped listeners, canvas backing store and cached images. */
  dispose(): void {
    this.disposed = true;
    this.loop.stop();
    this.events.dispose();
    this.observer.disconnect();
    this.presentation.dispose();
    this.images.clear();
    imageCache.clear();
    this.metadata.clear();
    this.clearInput();
    this.canvas.width = this.canvas.height = 1;
  }
}

const demo = new AfterDemo();
// Local browser verification only; never included in the production demo API.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('verify'))
  Object.assign(window, { __afterDemo: demo });
void demo.start().catch((error: unknown) => {
  demo.dispose();
  element('status').textContent = error instanceof Error ? error.message : 'Nie udało się uruchomić demo.';
  element('begin').textContent = 'Odśwież stronę, aby spróbować ponownie';
});
if (import.meta.hot) import.meta.hot.dispose(() => demo.dispose());
