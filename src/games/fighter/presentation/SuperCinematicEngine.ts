import { SuperPropsRenderer, ultimatePropPose } from './SuperPropsRenderer';
import { FighterAudio } from './FighterAudio';
import { CameraRig2D } from './CameraRig2D';
import { FighterState, MatchState } from '../simulation/CombatTypes';
import {
  cinematicTick,
  clamp01,
  djConsolePose,
  floatingCabin,
  projectilePoint,
  ultimateBodyPose,
  ultimateHand,
  ultimateProjectiles,
  vehicleStageX,
} from './ultimateChoreography';

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
  public reducedEffects = false;
  private activeState: SuperCinematicState | null = null;
  private propsRenderer = new SuperPropsRenderer();
  private followsCombat = false;
  private boundAttacker: FighterState | null = null;
  private boundDefender: FighterState | null = null;

  public retainFighters(ids: string[]): void {
    this.propsRenderer.retain(ids);
  }

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
      s.currentTick = cinematicTick(attacker, match);
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
      if (!this.reducedEffects) camera.shake(1, 0.05);
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
        if (!this.reducedEffects) camera.shake(12, 0.25);

        // Apply dedicated audio effect based on character
        // Live impacts are sounded from authoritative events, including trades.
        if (!this.followsCombat) this.triggerSuperImpactAudio(s.attackerId, audio);

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
    audio.playUltimateImpact(charId);
  }

  /** Large scenery belongs behind the fighters, never on top of their bodies. */
  public renderBehind(ctx: CanvasRenderingContext2D): void {
    const s = this.activeState;
    if (!s) return;
    ctx.save();
    if (s.phase === 'freeze' || s.phase === 'action') {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fillRect(-1200, -900, 2400, 1500);
    }
    const drawScenery = (
      id: string,
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      facing: number,
      t: number,
    ) => {
      if (t < 35) return;
      ctx.save();
      ctx.globalAlpha *= clamp01((t - 35) / 7) * clamp01((105 - t) / 8);
      if (id === 'gruczol') {
        const cabin = floatingCabin(t, x, y, facing);
        this.propsRenderer.drawProp(
          ctx,
          cabin.propId,
          cabin.x,
          cabin.y,
          160,
          220,
          0,
          cabin.facing,
          cabin.frame,
          4,
        );
      } else if (id === 'hemoroid' && t >= 43) {
        this.propsRenderer.drawProp(
          ctx,
          id,
          vehicleStageX(t, facing, targetX),
          -(y + 150),
          480,
          300,
          0,
          facing,
        );
      } else if (id === 'korba') {
        const braid = ultimatePropPose(t, x, y, targetX, targetY, id);
        this.propsRenderer.drawProp(
          ctx,
          id,
          braid.x,
          braid.y - 75,
          220,
          160,
          this.reducedEffects ? 0 : braid.angle,
          facing,
        );
      }
      ctx.restore();
    };
    if (s.moveId === 'ultimate')
      drawScenery(s.attackerId, s.attackerX, s.attackerY, s.defenderX, s.defenderY, s.facing, s.currentTick);
    if (this.boundDefender?.currentMove?.id === 'ultimate') {
      const f = this.boundDefender;
      drawScenery(
        f.id,
        f.x,
        f.y,
        s.attackerX,
        s.attackerY,
        f.facing,
        s.phase === 'freeze' ? s.currentTick : cinematicTick(f),
      );
    }
    ctx.restore();
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
      // Speed lines cutting diagonally
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      for (let i = 0; i < (this.reducedEffects ? 0 : 12); i++) {
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
        ctx.arc(portX, portY, 60, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(s.attackerPortrait, portX - 60, portY - 60, 120, 120);
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(portX, portY, 60, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Title & Super Move typography
      ctx.font = '900 42px Impact, "Arial Black", sans-serif';
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
    const propTick = t;
    if (this.followsCombat && s.phase === 'recovery') ctx.globalAlpha *= Math.max(0, (105 - t) / 12);
    this.renderCharacterSuperProps(ctx, s, propTick);
    const concurrent = this.boundDefender;
    if (s.moveId === 'ultimate' && concurrent?.currentMove?.id === 'ultimate') {
      this.renderCharacterSuperProps(
        ctx,
        {
          ...s,
          attackerId: concurrent.id,
          attackerX: concurrent.x,
          attackerY: concurrent.y,
          defenderX: s.attackerX,
          defenderY: s.attackerY,
          facing: concurrent.facing,
        },
        s.phase === 'freeze' ? propTick : cinematicTick(concurrent),
      );
      if (s.phase === 'freeze') {
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(`KONTRA: ${concurrent.currentMove.name}`, 0, -105);
      }
    }
    if (s.phase === 'impact' && s.damageApplied) {
      const progress = Math.max(0, (t - 76) / 16);
      ctx.save();
      ctx.translate(s.defenderX, -(s.defenderY + 65));
      ctx.globalAlpha *= 1 - progress;
      ctx.strokeStyle = s.themeColor;
      ctx.lineWidth = this.reducedEffects ? 2 : 5;
      if (s.attackerId !== 'chlebak') {
        ctx.beginPath();
        ctx.ellipse(0, 0, 25 + progress * 145, 20 + progress * 90, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const count = this.reducedEffects ? 6 : 24;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const distance = 18 + progress * (70 + (i % 5) * 15);
        ctx.fillStyle = i % 3 ? s.themeColor : '#fff3c4';
        ctx.fillRect(Math.cos(angle) * distance, Math.sin(angle) * distance, 4, 9);
      }
      ctx.restore();
    }
    if (s.phase === 'recovery' && !s.damageApplied) {
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(this.boundAttacker?.hasHit ? 'BLOK' : 'PUDŁO', s.defenderX, -(s.defenderY + 155));
    }

    ctx.restore();
  }

  private renderCharacterSuperProps(ctx: CanvasRenderingContext2D, s: SuperCinematicState, t: number): void {
    if (s.moveId !== 'ultimate') {
      this.renderSpecialProps(ctx, s, t);
      return;
    }
    const id = s.attackerId.toLowerCase();
    if (t < 35 || (id === 'szerszen' && t < 50)) return;
    const pose = ultimatePropPose(t, s.attackerX, s.attackerY, s.defenderX, s.defenderY, id);
    const p = this.propsRenderer;
    const angle = this.reducedEffects ? 0 : pose.angle;
    const body = ultimateBodyPose(id, t, s.attackerX, s.attackerY, s.defenderX, s.facing);
    const x = body.x,
      y = -body.y,
      f = s.facing;
    const handX = x + f * 32,
      handY = y - 80;
    const targetY = -(s.defenderY + 75);
    const flight = (release = 66, arrival = 76, fromX = handX, fromY = handY, arc = 16) =>
      projectilePoint(fromX, fromY, s.defenderX, targetY, (t - release) / (arrival - release), arc);
    const battleText = (text: string, tx: number, ty: number, size: number, color: string) => {
      ctx.save();
      ctx.translate(tx, ty);
      // Text uses world coordinates: facing never mirrors its letters.
      ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#15121b';
      ctx.lineWidth = 5;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    if (id === 'gruczol') {
      const cabin = floatingCabin(t, x, body.y, f);
      for (let roll = 0; roll < 8; roll++) {
        const release = 58 + roll * 2;
        if (t < release || t > release + 18) continue;
        const point = projectilePoint(
          cabin.outletX,
          cabin.outletY,
          s.defenderX,
          targetY + ((roll % 3) - 1) * 12,
          (t - release) / 18,
          20 + roll * 3,
        );
        p.drawProp(ctx, 'paper', point.x, point.y, 30, 33, (t - release) * 0.35 + roll);
      }
      for (let roll = 0; roll < 6; roll++) {
        const release = 62 + roll * 3;
        if (t < release || t > release + 14) continue;
        const point = flight(release, release + 14, handX, handY, 20 + roll * 5);
        p.drawProp(ctx, 'paper', point.x, point.y, 24, 26, angle + roll);
      }
    } else if (id === 'chlebak') {
      const deck = djConsolePose(x, body.y, f);
      p.drawProp(ctx, id, deck.x, deck.y, deck.width, deck.height, 0, deck.facing);
      const grip = ultimateHand(id, t);
      if (t >= 52 && t < 66) p.drawProp(ctx, 'vinyl', x + f * grip.x, y - grip.y, 28, 28);
      if (t >= 66 && t <= 82) {
        const releaseGrip = ultimateHand(id, 66);
        const point = flight(66, 76, x + f * releaseGrip.x, y - releaseGrip.y);
        p.drawProp(ctx, 'vinyl', point.x, point.y, 32, 32, (t - 66) * 0.7);
      }
    } else if (id === 'jeczmien' || id === 'ambona') {
      for (const projectile of ultimateProjectiles(id, t)) {
        const grip = ultimateHand(id, t < projectile.release ? t : projectile.release, projectile.hand);
        const hx = x + f * grip.x;
        const hy = y - grip.y;
        const fan = id === 'jeczmien' ? ((projectile.index % 3) - 1) * 26 : 0;
        if (t >= 52 && t < projectile.release) {
          // The remaining objects stay in the appropriate hand until release.
          p.drawProp(ctx, id, hx + f * fan * 0.3, hy + Math.abs(fan) * 0.06, 11, 18, fan * 0.03);
        } else if (projectile.flying) {
          const point = projectilePoint(
            hx,
            hy + fan * 0.4,
            s.defenderX,
            targetY + fan,
            projectile.progress,
            12,
          );
          p.drawProp(
            ctx,
            id,
            point.x,
            point.y,
            id === 'ambona' ? 18 : 13,
            21,
            projectile.progress * Math.PI * 4,
          );
        }
      }
      if (id === 'ambona' && t >= 60 && t < 96)
        battleText('KOSTRZYN', (x + s.defenderX) / 2, Math.min(y, -s.defenderY) - 190, 34, '#e7c990');
    } else if (id === 'klatwa') {
      if (t >= 63 && t <= 92) {
        const point = flight(63, 76, x + f * 35, y - 126, 0);
        battleText('KURWA MOJE POLE', point.x, point.y, 19 + clamp01((t - 63) / 13) * 7, '#f8e8a3');
      }
    } else if (id === 'kobra') {
      if (t >= 63 && t <= 92) this.drawLiquidStream(ctx, x + f * 23, y - 62, s.defenderX, targetY, t);
    } else if (id === 'antena') {
      // The embrace is performed by the authored arms, not by a giant prop.
      if (t >= 76 && t < 93 && s.damageApplied)
        battleText('ŚCISK!', s.defenderX, targetY - 90, 23, '#ffb5ce');
    } else if (id === 'zawor') {
      if (t >= 98 && t < 104) {
        const bite = clamp01((t - 98) / 4);
        ctx.save();
        ctx.globalAlpha = 1;
        p.drawProp(
          ctx,
          id,
          x + f * (28 - bite * 10),
          y - (140 - bite * 23),
          22 * (1 - bite * 0.45),
          28 * (1 - bite * 0.45),
        );
        ctx.restore();
      }
    } else if (id === 'pien') {
      if (t >= 52 && t < 99) {
        const megaphoneX = x + f * 60,
          mouthX = megaphoneX + f * 30,
          mouthY = y - 113;
        p.drawProp(ctx, id, megaphoneX, mouthY, 65, 44, 0, f);
        if (t >= 63 && t <= 92) {
          ctx.save();
          ctx.strokeStyle = '#ffd66b';
          ctx.lineWidth = 3;
          const distance = Math.abs(s.defenderX - mouthX);
          const reach = clamp01((t - 63) / 13) * distance;
          const rings = this.reducedEffects ? 4 : Math.min(12, Math.max(3, Math.ceil(reach / 36)));
          for (let i = 0; i < rings; i++) {
            // The first arc stays at the physical outlet; the train grows outward.
            const d = (reach * i) / Math.max(1, rings - 1);
            ctx.beginPath();
            ctx.ellipse(
              mouthX + f * d,
              mouthY,
              4 + d * 0.07,
              9 + d * 0.13,
              0,
              -Math.PI / 2,
              Math.PI / 2,
              f < 0,
            );
            ctx.strokeStyle = '#e6a825';
            ctx.lineWidth = this.reducedEffects ? 3 : 6;
            ctx.stroke();
            ctx.strokeStyle = '#fff1a8';
            ctx.lineWidth = this.reducedEffects ? 1 : 2;
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    } else if (id === 'pierscien') {
      const speakerX = x + f * 130,
        speakerY = y - 58;
      p.drawProp(ctx, id, speakerX, speakerY, 175, 125, 0, f);
      if (t >= 63 && t <= 92) {
        const point = flight(63, 76, speakerX + f * 20, speakerY, 5);
        battleText('dobrze dobrze', point.x, point.y, 24, '#b7e6ff');
      }
    } else if (id === 'krwiak') {
      if (t < 97) {
        for (const [offsetX, height] of [
          [-105, 190],
          [0, 270],
          [105, 190],
        ])
          battleText('summer', x + offsetX, y - height + Math.sin(t * 0.12 + offsetX) * 9, 23, '#f2dfaa');
      }
      const point = t < 66 ? { x: x + f * 15, y: y - 190 } : flight(66, 76, x + f * 15, y - 190, 12);
      p.drawProp(ctx, id, point.x, point.y, 110, 72, 0, 1);
    } else if (id === 'hemoroid' || id === 'korba') {
      // Their large moving props are rendered behind bodies in renderBehind().
      return;
    } else {
      const size = id === 'szerszen' ? 105 : id === 'dziaslo' ? 100 : 65;
      p.drawProp(
        ctx,
        id,
        pose.x + (t < 55 ? f * 65 : 0),
        pose.y,
        size,
        size,
        angle,
        id === 'szerszen' ? 1 : f,
      );
    }
  }

  /** Specials retain their existing art and choreography; this task changes ultimates. */
  private renderSpecialProps(ctx: CanvasRenderingContext2D, s: SuperCinematicState, t: number): void {
    const id = s.attackerId.toLowerCase();
    if (id === 'szerszen' && t < 50) return;
    const pose = ultimatePropPose(t, s.attackerX, s.attackerY, s.defenderX, s.defenderY, id);
    const p = this.propsRenderer;
    const angle = this.reducedEffects ? 0 : pose.angle;
    const asset = `legacy_${id}`;
    if (id === 'gruczol') {
      p.drawProp(ctx, asset, s.attackerX - s.facing * 65, -(s.attackerY + 115), 175, 230);
      for (let roll = 0; roll < 6; roll++) {
        const offset = Math.sin(roll * 2.4) * (1 - pose.progress) * 65;
        p.drawProp(ctx, 'paper', pose.x + offset, pose.y - Math.sin(roll * 1.5) * 35, 70, 80, angle + roll);
      }
    } else if (['pierscien', 'pien', 'chlebak'].includes(id)) {
      p.drawProp(ctx, asset, s.attackerX + s.facing * 65, -(s.attackerY + 60), 135, 120, 0, s.facing);
      p.drawProp(ctx, 'soundwave', pose.x, pose.y, 155, 180, 0, s.facing);
    } else if (id === 'hemoroid') {
      p.drawProp(ctx, asset, pose.x, -(s.attackerY + 65), 245, 150, 0, s.facing);
    } else {
      const size = id === 'szerszen' ? 135 : id === 'dziaslo' ? 195 : 145;
      p.drawProp(ctx, asset, pose.x, pose.y, size, size, angle, id === 'szerszen' ? 1 : s.facing);
    }
  }

  private drawLiquidStream(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    t: number,
  ): void {
    ctx.save();
    const reach = clamp01((t - 63) / 13);
    // A narrow parabolic jet, never a detached wave sprite. No randomness: hitstop freezes it.
    for (const [width, color] of [
      [7, '#c69d29'],
      [4, '#f8db60'],
      [1.5, '#fff5b6'],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const p = (i / 32) * reach;
        const point = projectilePoint(x, y, targetX, targetY, p, 40);
        if (!i) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }
    const count = this.reducedEffects ? 5 : 12;
    ctx.fillStyle = '#ffe68a';
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.045 + i / count) % 1) * reach;
      const point = projectilePoint(x, y, targetX, targetY, p, 40);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + 5 + Math.sin(i * 2.4) * 4, 2, 3, p, 0, Math.PI * 2);
      ctx.fill();
    }
    if (reach === 1) {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + t * 0.13;
        ctx.beginPath();
        ctx.arc(targetX + Math.cos(a) * 13, targetY + Math.sin(a) * 17, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
