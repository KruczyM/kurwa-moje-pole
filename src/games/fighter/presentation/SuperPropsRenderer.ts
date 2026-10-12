/**
 * SuperPropsRenderer: High-quality procedural vector and sprite renderer
 * for the 16 unique festival character special & ultimate props.
 */
export class SuperPropsRenderer {
  private propImages: Map<string, HTMLImageElement> = new Map();

  /**
   * Helper to load optional custom PNG from public props folder
   */
  public getPropImage(propName: string): HTMLImageElement | null {
    if (typeof window === 'undefined') return null;
    let img = this.propImages.get(propName);
    if (!img) {
      const rawBase = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
      const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
      img = new Image();
      img.src = `${base}game-assets/2d/fighter/props/${propName}.png`;
      this.propImages.set(propName, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  // 1. Amper: Hand Mirror
  drawMirror(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, broken = false): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Oval handle
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.roundRect(-4, 25, 8, 30, 4);
    ctx.fill();

    // Mirror golden rim
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (!broken) {
      // Shiny reflection glint
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -15);
      ctx.lineTo(8, -5);
      ctx.moveTo(-6, -5);
      ctx.lineTo(10, 5);
      ctx.stroke();
    } else {
      // Broken glass cracks
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-14, -18);
      ctx.moveTo(0, 0);
      ctx.lineTo(15, -12);
      ctx.moveTo(0, 0);
      ctx.lineTo(8, 20);
      ctx.moveTo(0, 0);
      ctx.lineTo(-12, 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2. Korba: Spinning Propeller Braids
  drawBraidPropeller(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);

    // High speed blur disc
    ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, 75, 0, Math.PI * 2);
    ctx.fill();

    // 3 spinning braid blades
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(angle + (i * Math.PI * 2) / 3);

      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(38, 0, 36, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair tip ribbon
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(70, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Slashing wind trail
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 72, -0.4, 0.2);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  // 3. Kobra: Comic Liquid Stream
  drawWaterStream(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    progress: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    const midX = (startX + targetX) / 2;
    const midY = Math.min(startY, targetY) - 90; // high parabolic arc

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    // Draw quad curve up to progress
    const curX =
      (1 - progress) * (1 - progress) * startX +
      2 * (1 - progress) * progress * midX +
      progress * progress * targetX;
    const curY =
      (1 - progress) * (1 - progress) * startY +
      2 * (1 - progress) * progress * midY +
      progress * progress * targetY;

    ctx.quadraticCurveTo(midX, midY, curX, curY);
    ctx.stroke();

    // Stream drops
    ctx.fillStyle = '#fef08a';
    for (let i = 0; i < 6; i++) {
      const dropP = Math.max(0, progress - i * 0.12);
      const dx =
        (1 - dropP) * (1 - dropP) * startX +
        2 * (1 - dropP) * dropP * midX +
        dropP * dropP * targetX +
        Math.sin(i) * 10;
      const dy =
        (1 - dropP) * (1 - dropP) * startY +
        2 * (1 - dropP) * dropP * midY +
        dropP * dropP * targetY +
        Math.cos(i) * 8;
      ctx.beginPath();
      ctx.arc(dx, dy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Antena: Party Candy & Energy Beam
  drawCandyAndBeam(
    ctx: CanvasRenderingContext2D,
    candyX: number,
    candyY: number,
    beamActive: boolean,
    beamOriginX: number,
    beamOriginY: number,
    targetX: number,
  ): void {
    ctx.save();
    // Glowing candy
    if (candyY > -200) {
      ctx.save();
      ctx.translate(candyX, candyY);
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      // Wrapper twists
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-18, -8);
      ctx.lineTo(-18, 8);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(18, -8);
      ctx.lineTo(18, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // High energy dual laser beam
    if (beamActive) {
      ctx.save();
      const beamLen = Math.abs(targetX - beamOriginX);
      const dir = targetX >= beamOriginX ? 1 : -1;

      // Outer glow
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.moveTo(beamOriginX, beamOriginY);
      ctx.lineTo(beamOriginX + dir * beamLen, beamOriginY);
      ctx.stroke();

      // Main core
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(beamOriginX, beamOriginY);
      ctx.lineTo(beamOriginX + dir * beamLen, beamOriginY);
      ctx.stroke();

      // Center white hot laser
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(beamOriginX, beamOriginY);
      ctx.lineTo(beamOriginX + dir * beamLen, beamOriginY);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 5. Gruczoł: White Toi-Toi Throne & Toilet Paper Rolls
  drawToiToi(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1.0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main cabin (White / Sky Blue)
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(-36, -130, 72, 130);
    ctx.fill();
    ctx.stroke();

    // Curved roof
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(0, -130, 36, Math.PI, 0);
    ctx.fill();

    // Door vents and handle
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-22, -115 + i * 14, 44, 4);
    }

    // Door sign "WC"
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WC', 0, -45);

    // Free / Occupied lock (Red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(18, -65, 8, 8);

    ctx.restore();
  }

  drawToiletPaper(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    trailProgress: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Trailing unwound white paper ribbon
    ctx.save();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const trailLen = Math.min(100, trailProgress * 120);
    ctx.quadraticCurveTo(-trailLen / 2, 18, -trailLen, 0);
    ctx.stroke();
    ctx.restore();

    // Cylinder roll
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cardboard core
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 6. Klątwa: Giant Neon "KURWA MOJE POLE"
  drawNeonBattleCry(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1.0, alpha = 1.0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    ctx.font = '900 32px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Massive glowing aura
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 24;

    // Background 3D extrusion
    ctx.fillStyle = '#7f1d1d';
    ctx.fillText('KURWA MOJE POLE!', 4, 4);

    // Outline
    ctx.strokeStyle = '#fee2e2';
    ctx.lineWidth = 6;
    ctx.strokeText('KURWA MOJE POLE!', 0, 0);

    // Vibrant core
    ctx.fillStyle = '#f87171';
    ctx.fillText('KURWA MOJE POLE!', 0, 0);

    ctx.restore();
  }

  // 7. Krwiak: Neon "SUMMER" Festival Signboard
  drawSummerSign(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Wooden / metal signboard backing
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-75, -28, 150, 56, 10);
    ctx.fill();
    ctx.stroke();

    // Neon text "SUMMER '24"
    ctx.font = '900 24px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#fef08a';
    ctx.fillText('SUMMER', 0, 0);

    ctx.restore();
  }

  // 8. Pień: Metal Megaphone & Sonic Rings
  drawMegaphone(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, pulse: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // Handle
    ctx.fillStyle = '#475569';
    ctx.fillRect(-8, 8, 10, 24);

    // Megaphone cone
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.lineTo(26, -26);
    ctx.lineTo(26, 26);
    ctx.lineTo(-16, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red speaker rim
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(26, 0, 6, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sonic blast rings
    for (let i = 1; i <= 3; i++) {
      const ringR = 20 + i * 28 + (pulse % 30);
      const ringAlpha = Math.max(0, 1 - ringR / 120);
      ctx.strokeStyle = `rgba(56, 189, 248, ${ringAlpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(32, 0, ringR, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 9. Pierścień: Giant JBL Boombox Speaker
  drawJBLSpeaker(ctx: CanvasRenderingContext2D, x: number, y: number, bassPulse: number): void {
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 60, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main cylinder body (Black / Camo Orange)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-55, -60, 110, 60, 18);
    ctx.fill();
    ctx.stroke();

    // JBL Orange logo badge
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-18, -38, 36, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JBL', 0, -25);

    // Left & Right pulsing bass passive radiators
    const conePulse = Math.sin(bassPulse) * 4;
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(-55 - conePulse, -30, 8, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(55 + conePulse, -30, 8, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Musical sound wave rings
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -30, 50 + (bassPulse % 30), 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // 10. Zawór: Mushroom, Mandala Shader & Guerrilla Cape
  drawMushroom(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);

    // Stalk
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.roundRect(-6, 0, 12, 22, 4);
    ctx.fill();

    // Red cap with white spots
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 20, Math.PI, 0);
    ctx.fill();

    // White polka dots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-8, -8, 3.5, 0, Math.PI * 2);
    ctx.arc(8, -8, 3.5, 0, Math.PI * 2);
    ctx.arc(0, -14, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawMandala(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    rotation: number,
    alpha = 0.5,
  ): void {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;

    const petals = 12;
    for (let r = 0; r < petals; r++) {
      ctx.rotate((Math.PI * 2) / petals);
      const grad = ctx.createLinearGradient(0, 0, 0, 320);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.3, '#a855f7');
      grad.addColorStop(0.7, '#06b6d4');
      grad.addColorStop(1, '#eab308');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 140, 28, 120, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 11. Ambona: Bag, Wrench & Camping Stove
  drawToteBag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.roundRect(-30, -50, 60, 50, 8);
    ctx.fill();

    // Handles
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -50, 16, Math.PI, 0);
    ctx.stroke();

    ctx.restore();
  }

  drawCampingStove(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Blue gas canister
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(-16, -10, 32, 28, 6);
    ctx.fill();

    // Burner metal top
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-22, -20, 44, 8);

    // Blue burning flame
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, -25, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 12. Chlebak: DJ Deck & Vinyl Scratch
  drawDJDeck(ctx: CanvasRenderingContext2D, x: number, y: number, vinylAngle: number): void {
    ctx.save();
    ctx.translate(x, y);

    // Deck base
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-60, -35, 120, 40, 6);
    ctx.fill();
    ctx.stroke();

    // Rotating vinyl turntable
    ctx.save();
    ctx.translate(-25, -15);
    ctx.rotate(vinylAngle);
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // Vinyl grooves
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Center record label
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mixer faders
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(15, -24, 6, 18);
    ctx.fillRect(30, -20, 6, 14);

    ctx.restore();
  }

  // 13. Dziąsło: Meteor Dive Aura
  drawMeteorAura(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 55): void {
    ctx.save();
    ctx.translate(x, y);

    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#facc15');
    grad.addColorStop(0.8, '#ef4444');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 14. Hemoroid: Muddy Off-Road 4x4 Jeep
  drawOffroadJeep(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // Muddy wheels
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-55, -18, 22, 0, Math.PI * 2);
    ctx.arc(55, -18, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f'; // mud rims
    ctx.beginPath();
    ctx.arc(-55, -18, 12, 0, Math.PI * 2);
    ctx.arc(55, -18, 12, 0, Math.PI * 2);
    ctx.fill();

    // Jeep body (Army green)
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-85, -65, 170, 48, 8);
    ctx.fill();
    ctx.stroke();

    // Roll cage
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-40, -65);
    ctx.lineTo(-20, -100);
    ctx.lineTo(40, -100);
    ctx.lineTo(60, -65);
    ctx.stroke();

    // Headlights (beaming yellow light)
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(85, -45, 9, 0, Math.PI * 2);
    ctx.fill();

    const beamGrad = ctx.createLinearGradient(85, -45, 240, -45);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
    beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(85, -45);
    ctx.lineTo(240, -85);
    ctx.lineTo(240, -5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // 15. Jęczmień: Flying Burning Lighters
  drawBurningLighter(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Plastic body
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(-8, -15, 16, 32, 4);
    ctx.fill();

    // Metal hood
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-7, -23, 14, 8);

    // Flame
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(0, -29, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 16. Szerszeń: Falling "HIPOKRYZJA" Monolith
  drawHypocrisyBlock(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1.0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Heavy dark stone block
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#9333ea';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-110, -50, 220, 100, 12);
    ctx.fill();
    ctx.stroke();

    // Mysterious purple glow
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 25;
    ctx.font = '900 28px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3e8ff';
    ctx.fillText('HIPOKRYZJA', 0, 0);

    ctx.restore();
  }
}
