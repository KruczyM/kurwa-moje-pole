import * as THREE from 'three';
import { Campfire } from '../world/Campfire';
import { AcousticGuitarSynth } from '../audio/AcousticGuitarSynth';
import type { Npc, NpcManager } from './NpcManager';

export interface NpcJamSessionOptions {
  campfire?: Campfire;
  guitarSynth?: AcousticGuitarSynth;
  autoNightTrigger?: boolean;
}

const PREFERRED_GUITARISTS = [
  '078_girl_with_guitar',
  '012_acoustic_songster',
  '054_striped_sweater_guitarist',
  '066_flower_power_guitarist',
  '011_leather_jacket_metalhead',
  '008_grunge_flannel_rocker',
];

/**
 * NpcJamSession — Koordynator ogniskowego jam session z gitarą akustyczną przy namiotach.
 * Po zmroku lub na żądanie:
 * 1. Wybiera postać z gitarą (lub innego wolnego bota obozowego) i sadza na kłodzie przy ognisku.
 * 2. Uruchamia syntetyzator akordów gitary akustycznej Karplus-Strong.
 * 3. Gromadzi pobliskie boty w kręgu przy ognisku (siadanie na pniakach, bujanie, oklaski).
 * 4. Płynnie kończy sesję, gdy wstaje dzień lub gdy gracz odchodzi.
 */
export class NpcJamSession {
  readonly campfire: Campfire;
  readonly guitarSynth: AcousticGuitarSynth;
  private autoNightTrigger: boolean;
  private isActive = false;
  private guitarist: Npc | null = null;
  private audience: Npc[] = [];
  private sessionCooldown = 0;

  constructor(
    private readonly npcManager: NpcManager,
    options: NpcJamSessionOptions = {},
  ) {
    this.campfire = options.campfire ?? new Campfire();
    this.guitarSynth =
      options.guitarSynth ??
      new AcousticGuitarSynth({
        campfirePosition: {
          x: this.campfire.position.x,
          y: this.campfire.position.y,
          z: this.campfire.position.z,
        },
      });
    this.autoNightTrigger = options.autoNightTrigger ?? true;
  }

  public get active(): boolean {
    return this.isActive;
  }

  public get guitaristNpc(): Npc | null {
    return this.guitarist;
  }

  public get audienceCount(): number {
    return this.audience.length;
  }

  /**
   * Rozpoczyna ogniskowy jam session z gitarą.
   */
  public startSession(preferredGuitaristName?: string): boolean {
    if (this.isActive) return true;

    // 1. Znajdź gitarzystę
    const candidate = this.findGuitarist(preferredGuitaristName);
    if (!candidate) return false;

    this.guitarist = candidate;
    this.isActive = true;

    // Usadź gitarzystę na głównym pniaku przy ognisku
    const primarySeat = this.campfire.logSeats[0];
    if (primarySeat) {
      if (this.guitarist.isSitting || this.guitarist.assignedSeatId) {
        this.npcManager.standUpNpc(this.guitarist);
      }
      this.guitarist.root.position.copy(primarySeat.position);
      this.guitarist.root.rotation.y = primarySeat.rotationY;
      this.guitarist.target.copy(primarySeat.position);
      this.guitarist.waypoints.length = 0;
      this.guitarist.speed = 0;
      this.guitarist.velocity.set(0, 0, 0);
      this.guitarist.stationary = true;
      this.guitarist.isSitting = true;

      if (this.guitarist.visual) {
        this.guitarist.visual.rotation.y = Math.PI;
        this.guitarist.visual.position.y = (this.guitarist.visualBaseY ?? 0) - 0.28;
        this.guitarist.visual.position.z = -0.35;
      }

      // Animacja grania / śpiewania
      const playClips = ['SittingIdle', 'SittingTalking', 'HappyHandGesture', 'Talking'];
      const available = playClips.filter((c) => this.guitarist?.animator?.hasClip(c));
      const clip = available.length > 0 ? available[0] : 'SittingIdle';
      if (this.guitarist.animator?.hasClip(clip)) {
        this.guitarist.animator.startActivity([{ name: clip, seconds: 120 }]);
      }
    }

    // 2. Zbierz publiczność (1–3 pobliskie wolne boty)
    this.gatherAudience();

    // 3. Uruchom dźwięk gitary
    this.guitarSynth.start();

    return true;
  }

  /**
   * Zatrzymuje jam session i przywraca naturalne zachowanie postaci.
   */
  public stopSession(): void {
    if (!this.isActive) return;
    this.isActive = false;

    this.guitarSynth.stop();

    if (this.guitarist) {
      this.npcManager.standUpNpc(this.guitarist);
      this.guitarist = null;
    }

    for (const member of this.audience) {
      this.npcManager.standUpNpc(member);
    }
    this.audience = [];
    this.sessionCooldown = 25.0; // Odczekaj przed kolejnym automatycznym rozpoczęciem
  }

  /**
   * Wyszukuje optymalną postać na gitarzystę.
   */
  private findGuitarist(explicitName?: string): Npc | null {
    const npcs = this.npcManager.npcs.filter((n) => !n.isHidden && !n.inConversation);
    if (npcs.length === 0) return null;

    if (explicitName) {
      const match = npcs.find((n) => n.name.toLowerCase() === explicitName.toLowerCase());
      if (match) return match;
    }

    for (const pref of PREFERRED_GUITARISTS) {
      const match = npcs.find(
        (n) => n.name.toLowerCase().includes(pref) || n.root.name.toLowerCase().includes(pref),
      );
      if (match) return match;
    }

    // Fallback: dowolny bot obozowy
    const campBot = npcs.find((n) => n.isCampMember);
    return campBot ?? npcs[0];
  }

  /**
   * Gromadzi pobliskie boty wokół ogniska na wolnych pniakach lub trawie.
   */
  private gatherAudience(): void {
    this.audience = [];
    const candidates = this.npcManager.npcs.filter(
      (n) => !n.isHidden && !n.inConversation && n !== this.guitarist,
    );

    const secondarySeats = this.campfire.logSeats.slice(1);
    let seatIndex = 0;

    for (const bot of candidates) {
      if (this.audience.length >= 3) break;
      const distToFire = bot.root.position.distanceTo(this.campfire.position);
      if (distToFire > 25.0) continue; // Tylko boty z terenu obozu

      if (seatIndex < secondarySeats.length) {
        const seat = secondarySeats[seatIndex++];
        if (bot.isSitting || bot.assignedSeatId) this.npcManager.standUpNpc(bot);

        bot.root.position.copy(seat.position);
        bot.root.rotation.y = seat.rotationY;
        bot.target.copy(seat.position);
        bot.waypoints.length = 0;
        bot.speed = 0;
        bot.velocity.set(0, 0, 0);
        bot.stationary = true;
        bot.isSitting = true;

        if (bot.visual) {
          bot.visual.rotation.y = Math.PI;
          bot.visual.position.y = (bot.visualBaseY ?? 0) - 0.28;
          bot.visual.position.z = -0.35;
        }

        const audienceClips = ['SittingIdle', 'HeadNodYes', 'Clapping', 'SittingTalking'];
        const available = audienceClips.filter((c) => bot.animator?.hasClip(c));
        const clip = available[0] ?? 'SittingIdle';
        if (bot.animator?.hasClip(clip)) {
          bot.animator.startActivity([{ name: clip, seconds: 120 }]);
        }
      } else {
        // Dodatkowy słuchacz stojący w kręgu
        const angle = 1.0 + this.audience.length * 1.2;
        const standingPos = new THREE.Vector3(
          this.campfire.position.x + Math.cos(angle) * 2.6,
          this.campfire.position.y,
          this.campfire.position.z + Math.sin(angle) * 2.6,
        );
        bot.root.position.copy(standingPos);
        const lookDir = this.campfire.position.clone().sub(standingPos).setY(0).normalize();
        bot.root.rotation.y = Math.atan2(lookDir.x, lookDir.z);
        bot.target.copy(standingPos);
        bot.waypoints.length = 0;
        bot.speed = 0;
        bot.velocity.set(0, 0, 0);
        bot.stationary = true;

        const standClips = ['Clapping', 'HappyHandGesture', 'HeadNodYes', 'LookAround'];
        const available = standClips.filter((c) => bot.animator?.hasClip(c));
        const clip = available[0] ?? 'LookAround';
        if (bot.animator?.hasClip(clip)) {
          bot.animator.startActivity([{ name: clip, seconds: 120 }]);
        }
      }

      this.audience.push(bot);
    }
  }

  /**
   * Główna aktualizacja pętli gry.
   */
  public update(
    dt: number,
    listenerPos?: { x: number; y: number; z: number },
    period?: 'day' | 'evening' | 'night',
  ): void {
    this.sessionCooldown = Math.max(0, this.sessionCooldown - dt);
    this.campfire.update(dt);

    if (this.autoNightTrigger && period) {
      const isNightTime = period === 'evening' || period === 'night';
      if (isNightTime && !this.isActive && this.sessionCooldown <= 0) {
        this.startSession();
      } else if (!isNightTime && this.isActive) {
        this.stopSession();
      }
    }

    if (this.isActive) {
      this.guitarSynth.update(dt, listenerPos);
    }
  }

  public dispose(): void {
    this.stopSession();
    this.guitarSynth.dispose();
    this.campfire.dispose();
  }
}
