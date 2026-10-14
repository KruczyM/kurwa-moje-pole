import { FighterDefinition, FighterState, MatchState } from '../simulation/CombatTypes';
import { CameraRig2D } from './CameraRig2D';
import { SimulationEvent } from '../simulation/FighterSimulation';
import { STAGES, StageDefinition } from '../data/stages';
import { SuperCinematicEngine } from './SuperCinematicEngine';
import { GROUND_SCREEN_RATIO, stageLayout } from './stageLayout';
import { CombatSpriteBank } from './CombatSpriteBank';
import { cinematicTick, ultimateBodyPose } from './ultimateChoreography';

interface VisualEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  type: 'spark' | 'block' | 'shockwave';
}

interface ComicTextEffect {
  x: number;
  y: number;
  text: string;
  color: string;
  outlineColor: string;
  rotation: number;
  life: number;
  maxLife: number;
}

export interface FighterSprites {
  idle: HTMLImageElement;
  walk: HTMLImageElement;
  punch: HTMLImageElement;
  kick: HTMLImageElement;
  crouch: HTMLImageElement;
  hit: HTMLImageElement;
  portrait: HTMLImageElement;
}

export class FighterView {
  private combatSprites = new CombatSpriteBank();

  public retainFighters(ids: string[]): void {
    this.combatSprites.retain(ids);
    this.superCinematic.retainFighters(ids);
    for (const id of this.spritesMap.keys()) {
      if (!ids.includes(id)) this.spritesMap.delete(id);
    }
  }
  public reset(): void {
    this.effects = [];
    this.comicTexts = [];
    this.superCinematic.reset();
    this.combatSprites.resetMotion();
  }

  /** Presentation advances with fixed game ticks, never with display refresh rate. */
  public update(): void {
    this.frameCount++;
    this.effects = this.effects.filter((effect) => --effect.life > 0);
    this.comicTexts = this.comicTexts.filter((effect) => --effect.life > 0);
  }
  public showHitboxes = false;
  public superCinematic = new SuperCinematicEngine();
  private effects: VisualEffect[] = [];
  private comicTexts: ComicTextEffect[] = [];
  private spritesMap = new Map<string, FighterSprites>();
  private stageImages = new Map<string, HTMLImageElement>();
  private activeStageId = 'main_stage';
  private frameCount = 0;

  public setStage(stageId: string): void {
    if (STAGES[stageId]) {
      this.activeStageId = stageId;
    }
  }

  public getActiveStage(): StageDefinition {
    return STAGES[this.activeStageId] ?? STAGES['main_stage']!;
  }

  public getStageImage(stageId: string): HTMLImageElement {
    let img = this.stageImages.get(stageId);
    if (!img) {
      const def = STAGES[stageId] ?? STAGES['main_stage']!;
      const rawBase = import.meta.env.BASE_URL || '/';
      const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
      img = new Image();
      img.src = `${base}${def.imagePath}`;
      this.stageImages.set(stageId, img);
    }
    return img;
  }

  public getFighterSprites(charId: string): FighterSprites {
    let entry = this.spritesMap.get(charId);
    if (!entry) {
      const rawBase = import.meta.env.BASE_URL || '/';
      const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
      const load = (subpath: string) => {
        const img = new Image();
        img.src = `${base}${subpath}`;
        return img;
      };

      entry = {
        idle: load(`game-assets/2d/fighter/sprites/${charId}/idle.png`),
        walk: load(`game-assets/2d/fighter/sprites/${charId}/walk.png`),
        punch: load(`game-assets/2d/fighter/sprites/${charId}/punch.png`),
        kick: load(`game-assets/2d/fighter/sprites/${charId}/kick.png`),
        crouch: load(`game-assets/2d/fighter/sprites/${charId}/crouch.png`),
        hit: load(`game-assets/2d/fighter/sprites/${charId}/hit.png`),
        portrait: load(`game-assets/2d/after/portraits/${charId}.png`),
      };
      this.spritesMap.set(charId, entry);
    }
    return entry;
  }

  addEvents(events: SimulationEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'hit' && ev.data) {
        this.createHitSparks(ev.data.point.x, ev.data.point.y, '#f59e0b');
        this.createComicHitPopup(ev.data);
      } else if (ev.type === 'launch' && ev.data) {
        this.createLaunchShockwave(ev.data.point.x, ev.data.point.y);
        this.createComicHitPopup(ev.data, 'W GÓRĘ!');
      } else if (ev.type === 'block' && ev.data) {
        this.createBlockRipples(ev.data.point.x, ev.data.point.y);
        this.createComicHitPopup(ev.data, 'BLOK!');
      }
    }
  }

  private createComicHitPopup(hitData: any, overrideText?: string): void {
    let text = overrideText;
    let color = '#fef08a';
    let outlineColor = '#b45309';

    if (!text) {
      if (hitData.isLauncher) {
        text = Math.random() < 0.5 ? 'W GÓRĘ!' : 'W GÓRĘ!';
        color = '#fef08a';
        outlineColor = '#d97706';
      } else if (hitData.isAirJuggle) {
        text = Math.random() < 0.5 ? 'COMBO!' : 'TRAFIONY!';
        color = '#38bdf8';
        outlineColor = '#0284c7';
      } else if (hitData.causesKnockdown || hitData.hitHeight === 'low') {
        text = Math.random() < 0.5 ? 'BĘC!' : 'GLEBA!';
        color = '#fb923c';
        outlineColor = '#c2410c';
      } else if (hitData.hitHeight === 'high') {
        text = Math.random() < 0.5 ? 'PLASK!' : 'BONK!';
        color = '#f472b6';
        outlineColor = '#db2777';
      } else if (hitData.damage > 75) {
        text = Math.random() < 0.5 ? 'AŁA!' : 'JEB!';
        color = '#f87171';
        outlineColor = '#b91c1c';
      } else {
        text = Math.random() < 0.5 ? 'PAC!' : 'ŁUP!';
        color = '#facc15';
        outlineColor = '#a16207';
      }
    }

    this.comicTexts.push({
      x: hitData.point.x + (Math.random() - 0.5) * 20,
      y: hitData.point.y + (Math.random() - 0.5) * 15,
      text,
      color,
      outlineColor,
      rotation: (Math.random() - 0.5) * 0.35,
      life: 24,
      maxLife: 24,
    });
  }

  addComicPopup(x: number, y: number, text: string, color: string, outlineColor = '#020617'): void {
    this.comicTexts.push({
      x,
      y,
      text,
      color,
      outlineColor,
      rotation: (Math.random() - 0.5) * 0.2,
      life: 28,
      maxLife: 28,
    });
  }

  private createLaunchShockwave(x: number, y: number): void {
    for (let i = 0; i < 14; i++) {
      this.effects.push({
        x: x + (Math.random() - 0.5) * 35,
        y: y + (Math.random() - 0.5) * 25,
        life: 18,
        maxLife: 18,
        color: '#ffd700',
        type: 'spark',
      });
    }
  }

  private createHitSparks(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      this.effects.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        life: 12,
        maxLife: 12,
        color,
        type: 'spark',
      });
    }
  }

  private createBlockRipples(x: number, y: number): void {
    this.effects.push({
      x,
      y,
      life: 14,
      maxLife: 14,
      color: '#38bdf8',
      type: 'block',
    });
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    match: MatchState,
    def1: FighterDefinition,
    def2: FighterDefinition,
    camera: CameraRig2D,
    p1Color = '#0284c7',
    p1Glow = '#38bdf8',
    p2Color = '#be123c',
    p2Glow = '#f43f5e',
  ): void {
    // 1. Clear background
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // 2. Camera transform
    const shake = camera.getShakeOffset();
    const screenCenterX = width / 2 + shake.x;
    const screenGroundY = height * GROUND_SCREEN_RATIO + shake.y;

    ctx.translate(screenCenterX, screenGroundY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, 0);

    // Background and feet share the same transform and world ground.
    this.drawStageBackground(ctx, width, height, camera.zoom);

    // 4. Render Fighters
    this.superCinematic.renderBehind(ctx);
    const hugging = (fighter: FighterState, other: FighterState): boolean =>
      fighter.id === 'antena' &&
      fighter.state === 'attack' &&
      fighter.currentMove?.id === 'ultimate' &&
      !!fighter.hasHit &&
      other.state === 'hit_stun' &&
      cinematicTick(fighter, match) >= 76 &&
      cinematicTick(fighter, match) < 93;
    const visualFighter = (fighter: FighterState, other: FighterState): FighterState => {
      if (hugging(other, fighter)) return { ...fighter, y: 0, isAirJuggle: false, lastHitHeight: 'mid' };
      if (fighter.state !== 'attack' || fighter.currentMove?.id !== 'ultimate') return fighter;
      const pose = ultimateBodyPose(
        fighter.id,
        cinematicTick(fighter, match),
        fighter.x,
        fighter.y,
        other.x,
        fighter.facing,
      );
      return { ...fighter, ...pose };
    };
    const draw1 = () =>
      this.drawFighter(
        ctx,
        visualFighter(match.p1, match.p2),
        def1,
        p1Glow,
        p1Color,
        match.tick,
        1,
        (match.superFreezeTicks ?? 0) > 0,
        hugging(match.p2, match.p1),
      );
    const draw2 = () =>
      this.drawFighter(
        ctx,
        visualFighter(match.p2, match.p1),
        def2,
        p2Glow,
        p2Color,
        match.tick,
        2,
        (match.superFreezeTicks ?? 0) > 0,
        hugging(match.p1, match.p2),
      );
    // Forearms of the embracing fighter remain visible over the opponent.
    if (hugging(match.p1, match.p2)) {
      draw2();
      draw1();
    } else {
      draw1();
      draw2();
    }

    // 5. Render VFX
    this.drawEffects(ctx);

    // 6. Render Super Cinematic Props & Effects
    this.superCinematic.render(ctx, width, height);

    ctx.restore();
  }

  private drawStageBackground(ctx: CanvasRenderingContext2D, width: number, height: number, zoom: number): void {
    const stage = this.getActiveStage();
    const img = this.getStageImage(stage.id);

    const aspect = img && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 9 / 16;
    const layout = stageLayout(width, height, zoom, aspect, stage.groundOffsetRatio);

    if (img && img.complete && img.naturalWidth > 0) {
      // 1. Draw detailed stage background graphic
      // Extend only the illustrated foreground on tall screens; retain the stage
      // composition above the calibrated ground instead of zooming the stage away.
      const sourceGround = img.naturalHeight * stage.groundOffsetRatio;
      ctx.drawImage(
        img,
        0,
        0,
        img.naturalWidth,
        sourceGround,
        layout.x,
        layout.y,
        layout.width,
        layout.aboveGround,
      );
      ctx.drawImage(
        img,
        0,
        sourceGround,
        img.naturalWidth,
        img.naturalHeight - sourceGround,
        layout.x,
        0,
        layout.width,
        layout.belowGround,
      );

      // 2. Animated lighting and atmospheric stage effects
      this.drawStageAtmosphere(ctx, stage);
    } else {
      // Fallback gradient while loading
      const sky = ctx.createLinearGradient(0, -600, 0, 0);
      sky.addColorStop(0, '#020617');
      sky.addColorStop(0.6, '#0f172a');
      sky.addColorStop(1, '#1e293b');
      ctx.fillStyle = sky;
      ctx.fillRect(-1000, -700, 2000, 700);

      ctx.fillStyle = '#166534';
      ctx.fillRect(-700, 0, 1400, 300);
    }

    // 3. Stage ground platform integration & surface lighting
    this.drawStagePlatformSurface(ctx, stage);

    // 4. Subtle atmospheric depth wash for character silhouette separation
    this.drawArenaDepthSeparation(ctx, stage);

    // Existing illustrated fencing and vegetation form the scenery; no synthetic posts.
  }

  private drawStageAtmosphere(ctx: CanvasRenderingContext2D, stage: StageDefinition): void {
    ctx.save();
    const t = this.frameCount;

    if (stage.id === 'main_stage') {
      // Dynamic concert laser beams cutting through night sky
      ctx.save();
      const laserPulse = Math.sin(t * 0.08) * 0.15 + 0.35;
      ctx.globalAlpha = laserPulse;

      // Cyan laser left
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-150, -420);
      ctx.lineTo(-650 + Math.sin(t * 0.04) * 80, -700);
      ctx.stroke();

      // Pink/magenta laser right
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(150, -420);
      ctx.lineTo(650 + Math.cos(t * 0.04) * 80, -700);
      ctx.stroke();

      // Green laser center
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -430);
      ctx.lineTo(Math.sin(t * 0.06) * 350, -720);
      ctx.stroke();

      // Sweeping stage spotlights
      ctx.globalAlpha = 0.08 + Math.sin(t * 0.05) * 0.04;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      const spotAngle = Math.sin(t * 0.03) * 160;
      ctx.moveTo(-220, -450);
      ctx.lineTo(spotAngle - 180, 0);
      ctx.lineTo(spotAngle + 80, 0);
      ctx.fill();

      ctx.restore();
    } else if (stage.id === 'grzybek') {
      // Water mist and droplets shimmering in sunlight around the mushroom fountain
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.sin(t * 0.04) * 0.06;
      const mistGrad = ctx.createRadialGradient(0, -280, 40, 0, -280, 260);
      mistGrad.addColorStop(0, 'rgba(186, 230, 253, 0.55)');
      mistGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.2)');
      mistGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = mistGrad;
      ctx.beginPath();
      ctx.arc(0, -280, 260, 0, Math.PI * 2);
      ctx.fill();

      // Sparkling water spray particles
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 12; i++) {
        const seed = (t * 2 + i * 47) % 300;
        const px = Math.sin(i * 1.7) * (120 + seed * 0.4);
        const py = -200 - seed * 0.6;
        ctx.globalAlpha = Math.sin((seed / 300) * Math.PI) * 0.5;
        ctx.fillRect(px, py, 2.5, 2.5);
      }
      ctx.restore();
    } else if (stage.id === 'sunset_camp') {
      // Warm golden hour sunlight haze over tents and Ferris Wheel
      ctx.save();
      ctx.globalAlpha = 0.14 + Math.sin(t * 0.03) * 0.04;
      const sunGrad = ctx.createRadialGradient(0, -320, 20, 0, -320, 420);
      sunGrad.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
      sunGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.25)');
      sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(0, -320, 420, 0, Math.PI * 2);
      ctx.fill();

      // Barbecue / campfire smoke wisps
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#fef08a';
      for (let j = 0; j < 3; j++) {
        const smokeY = -50 - ((t * 0.8 + j * 60) % 180);
        const smokeX = 280 + j * 70 + Math.sin(smokeY * 0.03) * 15;
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, 16 + j * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (stage.id === 'krishna_village') {
      // Daytime Ratha Yatra festival sunbeams and floating marigold flower petals
      ctx.save();
      const sunPulse = Math.sin(t * 0.05) * 0.04 + 0.16;
      ctx.globalAlpha = sunPulse;

      // Golden halo around Ratha Yatra dome top
      const domeGrad = ctx.createRadialGradient(0, -320, 20, 0, -320, 260);
      domeGrad.addColorStop(0, 'rgba(251, 191, 36, 0.65)');
      domeGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.2)');
      domeGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = domeGrad;
      ctx.beginPath();
      ctx.arc(0, -320, 260, 0, Math.PI * 2);
      ctx.fill();

      // Drifting marigold flower petals in summer breeze
      for (let p = 0; p < 8; p++) {
        const pSeed = (t * 0.7 + p * 53) % 240;
        const px = -350 + p * 90 + Math.sin(pSeed * 0.04) * 25;
        const py = -240 + pSeed * 0.9;
        ctx.globalAlpha = Math.sin((pSeed / 240) * Math.PI) * 0.55;
        ctx.fillStyle = p % 2 === 0 ? '#f97316' : '#facc15';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  private drawStagePlatformSurface(ctx: CanvasRenderingContext2D, stage: StageDefinition): void {
    ctx.save();
    const t = this.frameCount;

    if (stage.id === 'main_stage') {
      // 1. Concert arena spotlights washing across the wooden catwalk fighting platform
      const spotPulse = Math.sin(t * 0.05) * 0.04 + 0.14;
      ctx.globalAlpha = spotPulse;
      const blueWash = ctx.createRadialGradient(0, -10, 20, 0, 15, 520);
      blueWash.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      blueWash.addColorStop(0.65, 'rgba(56, 189, 248, 0.12)');
      blueWash.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = blueWash;
      ctx.beginPath();
      ctx.ellipse(0, 15, 540, 70, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sweeping warm amber center spotlight on floor
      const spotOffset = Math.sin(t * 0.03) * 140;
      const amberSpot = ctx.createRadialGradient(spotOffset, 5, 10, spotOffset, 15, 230);
      amberSpot.addColorStop(0, 'rgba(251, 191, 36, 0.38)');
      amberSpot.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = amberSpot;
      ctx.beginPath();
      ctx.ellipse(spotOffset, 15, 230, 48, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage.id === 'grzybek') {
      // 2. Mud arena: glistening puddle reflections and wet floor specular sheen
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.sin(t * 0.04) * 0.05;
      const puddleGleam = ctx.createRadialGradient(0, 18, 15, 0, 22, 440);
      puddleGleam.addColorStop(0, 'rgba(186, 230, 253, 0.52)');
      puddleGleam.addColorStop(0.55, 'rgba(56, 189, 248, 0.16)');
      puddleGleam.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = puddleGleam;
      ctx.beginPath();
      ctx.ellipse(0, 22, 480, 58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (stage.id === 'sunset_camp') {
      // 3. Golden hour sunbeams sweeping across the timber deck & grass arena
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.sin(t * 0.03) * 0.04;
      const sunSweep = ctx.createRadialGradient(0, -5, 15, 0, 18, 510);
      sunSweep.addColorStop(0, 'rgba(251, 191, 36, 0.48)');
      sunSweep.addColorStop(0.5, 'rgba(249, 115, 22, 0.18)');
      sunSweep.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = sunSweep;
      ctx.beginPath();
      ctx.ellipse(0, 18, 530, 62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (stage.id === 'krishna_village') {
      // 4. Mandala carpet ambient lantern pooling and aromatic aura
      ctx.save();
      const candlePulse = Math.sin(t * 0.08) * 0.04 + 0.16;
      ctx.globalAlpha = candlePulse;
      const carpetAura = ctx.createRadialGradient(0, 12, 20, 0, 18, 480);
      carpetAura.addColorStop(0, 'rgba(245, 158, 11, 0.46)');
      carpetAura.addColorStop(0.6, 'rgba(234, 88, 12, 0.16)');
      carpetAura.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = carpetAura;
      ctx.beginPath();
      ctx.ellipse(0, 18, 500, 56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawArenaDepthSeparation(ctx: CanvasRenderingContext2D, stage: StageDefinition): void {
    ctx.save();
    // Atmospheric depth scrim behind fighters: gently softens background high-frequency lines
    // and creates rich, professional 2D fighter silhouette separation:
    const scrim = ctx.createLinearGradient(0, -250, 0, 15);
    scrim.addColorStop(0, 'rgba(15, 23, 42, 0)');
    scrim.addColorStop(0.35, `${stage.ambientLight}12`); // ~7% ambient wash
    scrim.addColorStop(0.85, `${stage.ambientLight}24`); // ~14% ambient wash
    scrim.addColorStop(1, 'rgba(15, 23, 42, 0.28)'); // Ground contact transition shadow
    ctx.fillStyle = scrim;
    ctx.fillRect(-650, -250, 1300, 280);
    ctx.restore();
  }

  private drawFighter(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    def: FighterDefinition,
    glowColor: string,
    bodyColor: string,
    simulationTick: number,
    slot: number,
    frozen: boolean,
    squeezed = false,
  ): void {
    ctx.save();
    ctx.translate(fighter.x, 0);

    // Realistic Dual-Layer Ground Contact Shadow
    const stage = this.getActiveStage();
    ctx.save();
    const shadowScale = Math.max(0.25, 1 - fighter.y / 280);
    const shadowAlpha = Math.max(0.12, 1 - fighter.y / 360);

    // 1. Soft ambient ground shadow (wide diffusion)
    ctx.save();
    ctx.scale(1, 0.32);
    const diffuseGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, 48 * shadowScale);
    diffuseGrad.addColorStop(0, `rgba(10, 15, 26, ${0.48 * shadowAlpha})`);
    diffuseGrad.addColorStop(0.55, `rgba(10, 15, 26, ${0.22 * shadowAlpha})`);
    diffuseGrad.addColorStop(1, 'rgba(10, 15, 26, 0)');
    ctx.fillStyle = diffuseGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 48 * shadowScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Crisp foot contact occlusion shadow (when grounded or near floor)
    if (fighter.y < 35) {
      const contactAlpha = (1 - fighter.y / 35) * shadowAlpha;
      ctx.save();
      ctx.scale(1, 0.26);
      const contactGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 26 * shadowScale);
      contactGrad.addColorStop(0, `rgba(4, 7, 14, ${0.82 * contactAlpha})`);
      contactGrad.addColorStop(0.7, `rgba(4, 7, 14, ${0.35 * contactAlpha})`);
      contactGrad.addColorStop(1, 'rgba(4, 7, 14, 0)');
      ctx.fillStyle = contactGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * shadowScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Flip if facing left
    ctx.translate(0, -fighter.y);
    ctx.scale(fighter.facing, 1);
    if (squeezed) ctx.scale(0.9, 0.95);

    // Genuine retargeted frames, fixed feet pivot; legacy poses only during loading.
    ctx.save();
    ctx.shadowColor = stage.ambientLight;
    ctx.shadowBlur = 6;
    const hasCombatFrame = this.combatSprites.draw(
      ctx,
      fighter,
      simulationTick,
      slot,
      frozen || fighter.hitstop > 0,
    );
    ctx.restore();
    if (hasCombatFrame) {
      if (fighter.state === 'block_high' || fighter.state === 'block_low') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(25, fighter.state === 'block_low' ? -48 : -80, 38, -1.3, 1.3);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const sprites = this.getFighterSprites(def.id);
    const tick = fighter.stateTicks;
    let bobY = 0;

    let activeImg: HTMLImageElement = sprites.idle;

    // Physical attack movement parameters (lunge, lean, stretch)
    let lungeX = 0;
    let attackBobY = 0;
    let attackRot = 0;
    let attackScaleX = 1;
    let attackScaleY = 1;

    if (fighter.state === 'attack' && fighter.currentMove) {
      const move = fighter.currentMove;
      const isUppercut = move.id === 'uppercut';
      const isSweep = move.id === 'sweep';
      const isKick = move.id.includes('kick') || isSweep;
      activeImg = isKick ? sprites.kick : sprites.punch;

      const mTick = fighter.moveTick;
      const startup = move.startup;
      const active = move.active;
      const recovery = move.recovery;

      if (mTick < startup) {
        // 1. Anticipation / Zamach: postać cofa się (-7px) i naciąga cios
        const progress = mTick / Math.max(1, startup);
        lungeX = -progress * 7;
        attackBobY = progress * 4;
        attackRot = -progress * 0.07;
      } else if (mTick < startup + active) {
        // 2. Aktywne uderzenie (Wypad / Lunge / Eksplozja ciosu w stronę rywala):
        const activeProgress = (mTick - startup) / Math.max(1, active);
        if (isUppercut) {
          // Podbródkowy: dynamiczne wybicie w górę i wyprostowanie sylwetki
          lungeX = 14 + activeProgress * 8;
          attackBobY = -22 - (1 - activeProgress) * 10;
          attackRot = 0.12;
          attackScaleX = 0.94;
          attackScaleY = 1.14;
        } else if (isSweep) {
          // Niskie podcięcie: niski przysiad i rotacja nogi
          lungeX = 18 + activeProgress * 10;
          attackBobY = 16;
          attackRot = -0.16;
          attackScaleX = 1.15;
          attackScaleY = 0.85;
        } else if (isKick) {
          // Kopnięcie: wysunięcie nogi w przód, odchylenie tułowia w tył dla balansu
          lungeX = 20 + activeProgress * 8;
          attackBobY = -4;
          attackRot = -0.11;
          attackScaleX = 1.08;
        } else {
          // Cios pięścią: zdecydowany wypad tułowia do przodu
          lungeX = 24 + (1 - activeProgress) * 6;
          attackBobY = 2;
          attackRot = 0.1;
          attackScaleX = 1.1;
          attackScaleY = 0.96;
        }
      } else {
        // 3. Recovery: płynny powrót do pozycji wyjściowej
        const recProgress = (mTick - startup - active) / Math.max(1, recovery);
        const easeReturn = 1 - recProgress;
        lungeX = easeReturn * 12;
        attackBobY = easeReturn * (isUppercut ? -8 : 2);
        attackRot = easeReturn * 0.04;
      }
    } else if (fighter.state === 'crouch' || fighter.state === 'block_low') {
      activeImg = sprites.crouch;
    } else if (fighter.state === 'hit_stun') {
      activeImg = sprites.hit;
    } else if (fighter.state.startsWith('walk')) {
      activeImg = tick % 16 < 8 ? sprites.walk : sprites.idle;
      bobY = Math.sin(tick * 0.3) * 3;
    } else if (fighter.state === 'idle') {
      bobY = Math.sin(tick * 0.12) * 2.5;
    }

    const isLoaded = activeImg && activeImg.complete && activeImg.naturalWidth > 0;

    if (isLoaded) {
      const spriteW = 150;
      const spriteH = 150;

      ctx.save();
      // Apply physical attack motion offsets in local space (+X is forward towards opponent)
      ctx.translate(lungeX, bobY + attackBobY);
      ctx.rotate(attackRot);
      ctx.scale(attackScaleX, attackScaleY);

      // Flip sprite internally along X so the original left-facing PNG faces forward (+X towards opponent)
      ctx.scale(-1, 1);

      const imgToDraw =
        (fighter.state === 'knockdown' || (!fighter.isGrounded && fighter.state === 'hit_stun')) &&
        sprites.hit.complete
          ? sprites.hit
          : activeImg;

      const renderSpriteInstance = (targetImg: HTMLImageElement) => {
        if (fighter.state === 'knockdown') {
          ctx.save();
          ctx.translate(0, -20);
          ctx.rotate(-Math.PI / 2.2);
          ctx.drawImage(targetImg, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
          ctx.restore();
        } else if (!fighter.isGrounded && fighter.state === 'hit_stun') {
          ctx.save();
          ctx.translate(0, -spriteH * 0.4);
          ctx.rotate(-Math.PI * 0.16);
          ctx.drawImage(targetImg, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
          ctx.restore();
        } else {
          ctx.drawImage(targetImg, -spriteW / 2, -spriteH * 0.93, spriteW, spriteH);
        }
      };

      // Pass 1: Stage ambient rim lighting pass (matching environmental spotlights/sunlight)
      ctx.save();
      ctx.shadowColor = stage.ambientLight;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.32;
      renderSpriteInstance(imgToDraw);
      ctx.restore();

      // Pass 2: Crisp ambient drop shadow (guarantees clear silhouette separation against any background)
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      renderSpriteInstance(imgToDraw);
      ctx.restore();
      ctx.restore();

      // Attack impact effect trail & swoosh in front of character
      if (
        fighter.state === 'attack' &&
        fighter.currentMove &&
        fighter.moveTick > fighter.currentMove.startup &&
        fighter.moveTick <= fighter.currentMove.startup + fighter.currentMove.active
      ) {
        ctx.save();
        ctx.fillStyle = glowColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 16;
        const isUppercut = fighter.currentMove.id === 'uppercut';
        const isKick = fighter.currentMove.id.includes('kick') || fighter.currentMove.id === 'sweep';
        const trailX = lungeX + (isUppercut ? 38 : isKick ? 52 : 48);
        const trailY = bobY + attackBobY + (isUppercut ? -110 : isKick ? -55 : -85);

        ctx.beginPath();
        if (isUppercut) {
          ctx.arc(trailX, trailY, 24, 0, Math.PI * 2);
        } else if (isKick) {
          ctx.arc(trailX, trailY, 20, 0, Math.PI * 2);
        } else {
          ctx.arc(trailX, trailY, 18, 0, Math.PI * 2);
        }
        ctx.globalAlpha = 0.65;
        ctx.fill();

        // Dynamic motion swoosh arc
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (isUppercut) {
          ctx.arc(trailX - 6, trailY + 20, 32, -Math.PI * 0.6, -Math.PI * 0.1);
        } else {
          ctx.arc(trailX - 18, trailY, 26, -Math.PI * 0.35, Math.PI * 0.35);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Blocking shield energy arc
      if (fighter.state === 'block_high' || fighter.state === 'block_low') {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        const shieldY = fighter.state === 'block_low' ? -45 : -70;
        ctx.arc(28, shieldY + bobY, 44, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Fallback: draw character with actual portrait head + stylized torso in character color
      this.drawFallbackFighter(ctx, fighter, def, sprites.portrait, bodyColor, bobY, glowColor);
    }

    ctx.restore();
  }

  private drawFallbackFighter(
    ctx: CanvasRenderingContext2D,
    fighter: FighterState,
    _def: FighterDefinition,
    portrait: HTMLImageElement,
    bodyColor: string,
    bobY: number,
    glowColor: string,
  ): void {
    const tick = fighter.stateTicks;

    if (fighter.state === 'knockdown') {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-40, -25, 80, 25);
    } else if (fighter.state === 'crouch' || fighter.state === 'block_low') {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-22, -65, 44, 65);
    } else {
      const stride = fighter.state.startsWith('walk') ? Math.sin(tick * 0.3) * 14 : 0;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-18 + stride, -45, 14, 45);
      ctx.fillRect(4 - stride, -45, 14, 45);

      ctx.fillStyle = bodyColor;
      ctx.fillRect(-22, -100 + bobY, 44, 60);

      if (fighter.state === 'attack') {
        ctx.save();
        ctx.fillStyle = glowColor;
        ctx.fillRect(15, -92 + bobY, 50, 18);
        ctx.restore();
      }
    }

    // Always draw character's actual head using their portrait if available
    const headY = fighter.state === 'crouch' || fighter.state === 'block_low' ? -75 : -114 + bobY;
    if (portrait && portrait.complete && portrait.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, headY, 20, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(portrait, -20, headY - 20, 40, 40);
      ctx.restore();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, headY, 20, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, headY, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawEffects(ctx: CanvasRenderingContext2D): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i]!;
      if (ef.life <= 0) {
        this.effects.splice(i, 1);
        continue;
      }

      ctx.save();
      const alpha = ef.life / ef.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ef.color;

      if (ef.type === 'spark') {
        ctx.beginPath();
        ctx.arc(ef.x, -ef.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (ef.type === 'block') {
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ef.x, -ef.y, (1 - alpha) * 35, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render comic text popups (floating with comic starburst outline)
    for (let i = this.comicTexts.length - 1; i >= 0; i--) {
      const ct = this.comicTexts[i]!;
      if (ct.life <= 0) {
        this.comicTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      const progress = 1 - ct.life / ct.maxLife; // 0 to 1
      const alpha = Math.min(1, ct.life / 6);
      const floatY = -ct.y - progress * 36;

      ctx.translate(ct.x, floatY);
      ctx.rotate(ct.rotation);
      ctx.globalAlpha = alpha;

      const scale = Math.min(1.25, 0.75 + Math.sin(progress * Math.PI) * 0.5);
      ctx.scale(scale, scale);

      // Starburst comic burst background
      ctx.fillStyle = ct.outlineColor;
      ctx.beginPath();
      const spikes = 8;
      const outerRad = 22;
      const innerRad = 11;
      for (let s = 0; s < spikes * 2; s++) {
        const r = s % 2 === 0 ? outerRad : innerRad;
        const angle = (s * Math.PI) / spikes;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.globalAlpha = alpha * 0.45;
      ctx.fill();

      // Comic text
      ctx.globalAlpha = alpha;
      ctx.font = '900 18px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#020617';
      ctx.strokeText(ct.text, 0, 0);

      ctx.fillStyle = ct.color;
      ctx.fillText(ct.text, 0, 0);

      ctx.restore();
    }
  }
}
