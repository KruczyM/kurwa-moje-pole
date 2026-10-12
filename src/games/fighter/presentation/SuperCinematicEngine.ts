import { SuperPropsRenderer } from './SuperPropsRenderer';
import { FighterAudio } from './FighterAudio';
import { CameraRig2D } from './CameraRig2D';
import { FighterState, MatchState } from '../simulation/CombatTypes';

export interface SuperCinematicState {
  attackerId: string;
  attackerName: string;
  attackerPortrait: HTMLImageElement;
  defenderId: string;
  moveId: string;
  moveName: string;
  themeColor: string;
  currentTick: number;
  totalTicks: number;
  phase: 'freeze' | 'action' | 'impact' | 'recovery';
  attackerX: number;
  attackerY: number;
  defenderX: number;
  defenderY: number;
  facing: 1 | -1;
  damageApplied: boolean;
}

export class SuperCinematicEngine {
  private activeState: SuperCinematicState | null = null;
  private propsRenderer = new SuperPropsRenderer();
  private followsCombat = false;
  private boundAttacker: FighterState | null = null;
  private boundDefender: FighterState | null = null;

  public isCinematicActive(): boolean {
    return this.activeState !== null;
  }

  public getActiveState(): SuperCinematicState | null {
    return this.activeState;
  }

  public startCinematic(
    attacker: FighterState,
    defender: FighterState,
    moveId: string,
    moveName: string,
    attackerName: string,
    attackerPortrait: HTMLImageElement,
    themeColor: string,
    audio?: FighterAudio,
  ): void {
    this.followsCombat = attacker.state === 'attack' && attacker.currentMove?.id === moveId;
    this.boundAttacker = this.followsCombat ? attacker : null;
    this.boundDefender = this.followsCombat ? defender : null;
    this.activeState = {
      attackerId: attacker.id,
      attackerName,
      attackerPortrait,
      defenderId: defender.id,
      moveId,
      moveName,
      themeColor,
      currentTick: 0,
      totalTicks: 105,
      phase: 'freeze',
      attackerX: attacker.x,
      attackerY: attacker.y,
      defenderX: defender.x,
      defenderY: defender.y,
      facing: attacker.facing,
      damageApplied: false,
    };

    if (audio) {
      audio.playSuperStartup();
    }
  }

  public update(
    match: MatchState,
    camera: CameraRig2D,
    audio: FighterAudio,
    onImpactCallback?: (hitX: number, hitY: number, damage: number, moveId: string) => void,
  ): void {
    if (!this.activeState) return;

    const s = this.activeState;
    const attacker = this.boundAttacker ?? (match.p1.id === s.attackerId ? match.p1 : match.p2);
    const defender = this.boundDefender ?? (match.p1.id === s.defenderId ? match.p1 : match.p2);
    if (this.followsCombat) {
      const move = attacker.currentMove;
      if (
        (attacker !== match.p1 && attacker !== match.p2) ||
        attacker.state !== 'attack' ||
        move?.id !== s.moveId
      ) {
        this.reset();
        return;
      }
      const tick = attacker.moveTick;
      s.currentTick =
        tick <= move.startup
          ? (75 * tick) / Math.max(1, move.startup)
          : tick <= move.startup + move.active
            ? 76 + (16 * (tick - move.startup - 1)) / Math.max(1, move.active - 1)
            : 93 + (12 * (tick - move.startup - move.active - 1)) / Math.max(1, move.recovery - 1);
      // Follow live positions and hitstop; presentation never moves a fighter.
      s.attackerX = attacker.x;
      s.attackerY = attacker.y;
      s.defenderX = defender.x;
      s.defenderY = defender.y;
      s.facing = attacker.facing;
    } else s.currentTick += 1;
    const t = s.currentTick;

    // Phase transitions
    if (t <= 35) {
      s.phase = 'freeze';
      // Freeze camera zoomed in slightly on attacker
      camera.shake(2, 0.05);
    } else if (t <= 75) {
      s.phase = 'action';
    } else if (t <= 92) {
      s.phase = 'impact';

      // Trigger impact effects and damage once at start of impact
      const confirmedHit =
        !this.followsCombat ||
        (attacker.hasHit && defender.state !== 'block_high' && defender.state !== 'block_low');
      if (!s.damageApplied && confirmedHit) {
        s.damageApplied = true;
        camera.shake(14, 0.35);

        // Apply dedicated audio effect based on character
        this.triggerSuperImpactAudio(s.attackerId, audio);

        if (onImpactCallback) {
          // Cosmetic only. All damage, guards and range checks belong to simulation.
          onImpactCallback(s.defenderX, s.defenderY + 60, 0, s.moveId);
        }
      }
    } else if (t <= s.totalTicks) {
      s.phase = 'recovery';
    } else {
      this.reset();
    }
  }

  public reset(): void {
    this.activeState = null;
    this.followsCombat = false;
    this.boundAttacker = this.boundDefender = null;
  }

  private triggerSuperImpactAudio(charId: string, audio: FighterAudio): void {
    switch (charId.toLowerCase()) {
      case 'amper':
        audio.playGlassShatter();
        audio.playBonk();
        break;
      case 'korba':
        audio.playPropellerSpin();
        audio.playSlap();
        break;
      case 'kobra':
        audio.playSlideWhistle('down');
        audio.playSlap();
        break;
      case 'antena':
        audio.playLaserBeam();
        break;
      case 'gruczol':
        audio.playFlushToilet();
        audio.playFart();
        break;
      case 'klatwa':
        audio.playBonk();
        audio.playMegaphoneScreech();
        break;
      case 'krwiak':
        audio.playBonk();
        break;
      case 'pien':
        audio.playMegaphoneScreech();
        break;
      case 'pierscien':
        audio.playJBLBassDrop();
        break;
      case 'zawor':
        audio.playBoing();
        audio.playPop();
        break;
      case 'ambona':
        audio.playBonk();
        audio.playSlideWhistle('down');
        break;
      case 'chlebak':
        audio.playDJScratch();
        break;
      case 'dziaslo':
        audio.playKOGong();
        break;
      case 'hemoroid':
        audio.playEngineRoar();
        audio.playBonk();
        break;
      case 'jeczmien':
        audio.playLighterFlicks();
        audio.playPop();
        break;
      case 'szerszen':
        audio.playWhispers();
        audio.playBonk();
        break;
      default:
        audio.playBonk();
        break;
    }
  }

  public render(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
    void _width;
    void _height;
    if (!this.activeState) return;

    const s = this.activeState;
    const t = s.currentTick;

    ctx.save();

    // 1. Dim background during Super Freeze & Action
    if (s.phase === 'freeze' || s.phase === 'action') {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      ctx.fillRect(-1200, -900, 2400, 1500);

      // Speed lines cutting diagonally
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const lineOffset = ((t * 25 + i * 160) % 1800) - 900;
        ctx.beginPath();
        ctx.moveTo(lineOffset, -800);
        ctx.lineTo(lineOffset + 240, 400);
        ctx.stroke();
      }
    }

    // 2. Cinematic Portrait Slash Banner during Super Freeze
    if (s.phase === 'freeze') {
      const bannerProgress = Math.min(1, t / 14);
      const slideX = (1 - bannerProgress) * 450;

      // Diagonal colored banner
      ctx.save();
      ctx.fillStyle = s.themeColor || '#e11d48';
      ctx.beginPath();
      ctx.moveTo(-1000, -260);
      ctx.lineTo(1000, -260);
      ctx.lineTo(1000, -140);
      ctx.lineTo(-1000, -140);
      ctx.closePath();
      ctx.fill();

      // Golden accent stripe
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-1000, -140, 2000, 6);

      // Portrait badge
      const portX = -180 + slideX;
      const portY = -200;
      if (s.attackerPortrait && s.attackerPortrait.complete && s.attackerPortrait.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(portX, portY, 52, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(s.attackerPortrait, portX - 52, portY - 52, 104, 104);
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(portX, portY, 52, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Title & Super Move typography
      ctx.font = '900 36px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.fillText(s.attackerName.toUpperCase(), portX + 75, -215);

      ctx.font = 'italic bold 20px sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`SUPER: ${s.moveName}`, portX + 78, -178);

      ctx.restore();
    }

    // Keep authored projectile travel inside active ticks. Charge poses cannot
    // launch a projectile before the corresponding combat sprite makes contact.
    const propTick = !this.followsCombat
      ? t
      : s.phase === 'freeze'
        ? t
        : s.phase === 'action'
          ? 35 + (5 * (t - 35)) / 40
          : s.phase === 'impact'
            ? 42 + (50 * (t - 76)) / 16
            : t;
    if (this.followsCombat && s.phase === 'recovery') ctx.globalAlpha *= Math.max(0, (105 - t) / 12);
    this.renderCharacterSuperProps(ctx, s, propTick);

    ctx.restore();
  }

  private renderCharacterSuperProps(ctx: CanvasRenderingContext2D, s: SuperCinematicState, t: number): void {
    const p = this.propsRenderer;
    const progress = Math.min(1, Math.max(0, (t - 35) / 40)); // 0 to 1 during action
    const startX = s.attackerX;
    const startY = s.attackerY;
    const targetX = s.defenderX;
    const targetY = s.defenderY;
    const facing = s.facing;

    switch (s.attackerId.toLowerCase()) {
      case 'amper': {
        // Amper: Mirror appears, grooms mustache, throws spinning mirror
        if (t <= 50) {
          // Looking in mirror
          p.drawMirror(ctx, startX + facing * 35, -(startY + 85), facing * 0.2, false);
        } else {
          // Thrown spinning mirror flying along parabolic arc
          const mProgress = Math.min(1, (t - 50) / 25);
          const curX = startX + facing * 35 + (targetX - (startX + facing * 35)) * mProgress;
          const curY =
            startY + 85 + (targetY - (startY + 85)) * mProgress - Math.sin(mProgress * Math.PI) * 75;
          const angle = mProgress * Math.PI * 6;
          p.drawMirror(ctx, curX, -curY, angle, mProgress >= 0.95);
        }
        break;
      }

      case 'korba': {
        // Korba: Fast spin, braids turn into propeller blades
        const propX = startX + (targetX - startX) * progress;
        p.drawBraidPropeller(ctx, propX, -(startY + 70), t * 0.85);
        break;
      }

      case 'kobra': {
        // Kobra: Comic liquid stream arc
        if (t > 40) {
          const sProgress = Math.min(1, (t - 40) / 30);
          p.drawWaterStream(ctx, startX + facing * 25, -(startY + 45), targetX, -(targetY + 50), sProgress);
        }
        break;
      }

      case 'antena': {
        // Antena: Candy eaten then laser beam blast
        const candyY = t < 52 ? -(startY + 110 - (t - 35) * 4) : -999;
        const beamActive = t >= 52 && t <= 88;
        p.drawCandyAndBeam(
          ctx,
          startX + facing * 15,
          candyY,
          beamActive,
          startX + facing * 40,
          -(startY + 80),
          targetX,
        );
        break;
      }

      case 'gruczol': {
        // Gruczoł: White Toi-Toi throne & toilet paper barrage
        p.drawToiToi(ctx, startX, -(startY + 10), 1.0);
        if (t > 45) {
          for (let i = 0; i < 3; i++) {
            const rollP = Math.min(1, Math.max(0, (t - 45 - i * 8) / 20));
            const rx = startX + facing * 20 + (targetX - startX) * rollP;
            const ry = -(startY + 60 + Math.sin(rollP * Math.PI) * 45 - rollP * 20);
            p.drawToiletPaper(ctx, rx, ry, rollP * Math.PI * 4, rollP);
          }
        }
        break;
      }

      case 'klatwa': {
        // Klątwa: Neon 3D "KURWA MOJE POLE" shoots out
        if (t > 45) {
          const cryP = Math.min(1, (t - 45) / 28);
          const cx = startX + facing * 50 + (targetX - startX) * cryP;
          const cy = -(startY + 85);
          p.drawNeonBattleCry(ctx, cx, cy, 0.8 + cryP * 0.5, 1.0);
        }
        break;
      }

      case 'krwiak': {
        // Krwiak: Neon "SUMMER" signboard overhead strike
        const signAngle = facing * (-0.8 + progress * 2.2);
        p.drawSummerSign(ctx, startX + facing * 45, -(startY + 95), signAngle);
        break;
      }

      case 'pien': {
        // Pień: Metal Megaphone & sonic rings
        p.drawMegaphone(ctx, startX + facing * 35, -(startY + 80), facing, t * 5);
        break;
      }

      case 'pierscien': {
        // Pierścień: Giant JBL Boombox with pulsing bass
        p.drawJBLSpeaker(ctx, startX + facing * 45, -(startY + 2), t * 0.4);
        break;
      }

      case 'zawor': {
        // Zawór: Mushroom, Mandala background, Ninja cape
        if (t < 50) {
          p.drawMushroom(ctx, startX + facing * 25, -(startY + 10));
        } else {
          // Spinning colorful mandala background
          p.drawMandala(ctx, (startX + targetX) / 2, -180, t * 0.05, 0.65);
        }
        break;
      }

      case 'ambona': {
        // Ambona: Tote bag, wrench, and camping stove
        p.drawToteBag(ctx, startX - facing * 30, -(startY + 5));
        if (t > 48) {
          const stoveP = Math.min(1, (t - 48) / 24);
          const sx = startX + (targetX - startX) * stoveP;
          const sy = -(startY + 50 + Math.sin(stoveP * Math.PI) * 50);
          p.drawCampingStove(ctx, sx, sy, stoveP * Math.PI * 4);
        }
        break;
      }

      case 'chlebak': {
        // Chlebak: DJ deck turntable and scratch disc
        p.drawDJDeck(ctx, startX + facing * 35, -(startY + 20), t * 0.35);
        break;
      }

      case 'dziaslo': {
        // Dziąsło: Rocket jump & meteor dive drop
        if (t >= 65) {
          const diveP = Math.min(1, (t - 65) / 12);
          const meteorY = -600 + diveP * 540;
          p.drawMeteorAura(ctx, targetX, meteorY, 65);
        }
        break;
      }

      case 'hemoroid': {
        // Hemoroid: Muddy off-road 4x4 Jeep driving across screen
        const jeepX = startX - facing * 350 + facing * progress * 550;
        p.drawOffroadJeep(ctx, jeepX, -(startY + 12), facing);
        break;
      }

      case 'jeczmien': {
        // Jęczmień: Burning lighter projectiles
        if (t > 42) {
          for (let i = 0; i < 4; i++) {
            const ligP = Math.min(1, Math.max(0, (t - 42 - i * 6) / 20));
            const lx = startX + facing * 20 + (targetX - startX) * ligP;
            const ly = -(startY + 65 + Math.sin(ligP * Math.PI) * 35);
            p.drawBurningLighter(ctx, lx, ly, ligP * Math.PI * 3);
          }
        }
        break;
      }

      case 'szerszen': {
        // Szerszeń: Falling "HIPOKRYZJA" stone monolith
        if (t > 50) {
          const dropP = Math.min(1, (t - 50) / 24);
          const blockY = -450 + dropP * 380;
          p.drawHypocrisyBlock(ctx, targetX, blockY, 1.0);
        }
        break;
      }
    }
  }
}
