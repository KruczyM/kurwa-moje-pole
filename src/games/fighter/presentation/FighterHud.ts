import { MatchState } from '../simulation/CombatTypes';

export class FighterHud {
  private p1DisplayedHp = 1000;
  private p2DisplayedHp = 950;
  private p1LagHp = 1000;
  private p2LagHp = 950;

  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    match: MatchState,
    p1Name: string,
    p2Name: string,
    p1Img?: HTMLImageElement,
    p2Img?: HTMLImageElement,
  ): void {
    ctx.save();

    // Smooth health bar interpolation
    this.p1DisplayedHp += (match.p1.hp - this.p1DisplayedHp) * 0.25;
    this.p2DisplayedHp += (match.p2.hp - this.p2DisplayedHp) * 0.25;
    this.p1LagHp += (match.p1.hp - this.p1LagHp) * 0.05;
    this.p2LagHp += (match.p2.hp - this.p2LagHp) * 0.05;

    const barWidth = Math.min(320, width * 0.36);
    const barHeight = 22;
    const topY = 28;
    const portraitSize = 42;

    // --- P1 PORTRAIT & HEALTH BAR (Left) ---
    const p1PortraitX = 20;
    const p1X = p1PortraitX + portraitSize + 8;

    // P1 Portrait Frame
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(p1PortraitX - 2, topY - 2, portraitSize + 4, portraitSize + 4);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(p1PortraitX - 2, topY - 2, portraitSize + 4, portraitSize + 4);
    if (p1Img && p1Img.complete) {
      ctx.drawImage(p1Img, p1PortraitX, topY, portraitSize, portraitSize);
    }

    this.drawHealthBar(
      ctx,
      p1X,
      topY,
      barWidth,
      barHeight,
      this.p1DisplayedHp,
      this.p1LagHp,
      match.p1.maxHp,
      false,
    );

    // P1 Name & Wins
    ctx.font = '900 16px sans-serif';
    ctx.fillStyle = '#ffde59';
    ctx.fillText(p1Name.toUpperCase(), p1X + 4, topY + barHeight + 17);

    // P1 Round Wins
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(p1X + 110 + i * 16, topY + barHeight + 12, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < match.p1Wins ? '#ffd700' : '#334155';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }

    // --- P2 PORTRAIT & HEALTH BAR (Right) ---
    const p2PortraitX = width - 20 - portraitSize;
    const p2X = p2PortraitX - 8 - barWidth;

    // P2 Portrait Frame
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(p2PortraitX - 2, topY - 2, portraitSize + 4, portraitSize + 4);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(p2PortraitX - 2, topY - 2, portraitSize + 4, portraitSize + 4);
    if (p2Img && p2Img.complete) {
      ctx.drawImage(p2Img, p2PortraitX, topY, portraitSize, portraitSize);
    }

    this.drawHealthBar(
      ctx,
      p2X,
      topY,
      barWidth,
      barHeight,
      this.p2DisplayedHp,
      this.p2LagHp,
      match.p2.maxHp,
      true,
    );

    // P2 Name & Wins
    ctx.font = '900 16px sans-serif';
    ctx.fillStyle = '#ff6b81';
    ctx.textAlign = 'right';
    ctx.fillText(p2Name.toUpperCase(), p2X + barWidth - 4, topY + barHeight + 17);

    // P2 Round Wins
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(p2X + barWidth - 110 - i * 16, topY + barHeight + 12, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < match.p2Wins ? '#ffd700' : '#334155';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }
    ctx.textAlign = 'left';

    // --- CENTER TIMER ---
    const centerX = width / 2;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(centerX - 36, topY - 2, 72, 42);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(centerX - 36, topY - 2, 72, 42);

    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = match.roundTimer <= 10 ? '#ef4444' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(match.roundTimer).toString(), centerX, topY + 30);

    // --- SUPER METERS (Under Player Names) ---
    const meterWidth = barWidth * 0.7;
    const meterHeight = 10;
    const meterY = topY + barHeight + 24;

    // P1 Super Meter
    this.drawSuperMeter(ctx, p1X, meterY, meterWidth, meterHeight, match.p1.meter, '#06b6d4');
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = match.p1.meter >= 100 ? '#ffd700' : '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(
      match.p1.meter >= 100 ? 'SUPER READY!' : `SUPER ${Math.floor(match.p1.meter)}%`,
      p1X + meterWidth + 8,
      meterY + 9,
    );

    // P2 Super Meter
    this.drawSuperMeter(
      ctx,
      p2X + barWidth - meterWidth,
      meterY,
      meterWidth,
      meterHeight,
      match.p2.meter,
      '#ec4899',
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = match.p2.meter >= 100 ? '#ffd700' : '#94a3b8';
    ctx.fillText(
      match.p2.meter >= 100 ? 'SUPER READY!' : `SUPER ${Math.floor(match.p2.meter)}%`,
      p2X + barWidth - meterWidth - 8,
      meterY + 9,
    );

    // --- COMBO COUNTERS ---
    if (match.p2.comboHits > 1) {
      ctx.font = 'italic 900 32px sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'left';
      ctx.fillText(`${match.p2.comboHits} HITS!`, 40, 120);
      if (match.p2.isAirJuggle) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('AIR JUGGLE!', 42, 142);
      }
    }
    if (match.p1.comboHits > 1) {
      ctx.font = 'italic 900 32px sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'right';
      ctx.fillText(`${match.p1.comboHits} HITS!`, width - 40, 120);
      if (match.p1.isAirJuggle) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('AIR JUGGLE!', width - 42, 142);
      }
    }

    // --- ANNOUNCER OVERLAYS ---
    if (match.roundState === 'fight' && match.stateTicks < 75) {
      ctx.font = '900 48px sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      const text = match.stateTicks < 40 ? `RUNDA ${match.roundNumber}` : 'FIGHT!';
      ctx.fillText(text, centerX, height * 0.38);
      ctx.shadowBlur = 0;
    } else if (match.roundState === 'roundOver' || match.roundState === 'matchOver') {
      ctx.font = '900 56px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 14;
      ctx.fillText('K.O.!', centerX, height * 0.38);

      if (match.roundState === 'matchOver') {
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#ffffff';
        const winText =
          match.winner === 1
            ? `${p1Name.toUpperCase()} WYGRYWA!`
            : match.winner === 2
              ? `${p2Name.toUpperCase()} WYGRYWA!`
              : 'REMIS!';
        ctx.fillText(winText, centerX, height * 0.48);
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    currentHp: number,
    lagHp: number,
    maxHp: number,
    reverse: boolean,
  ): void {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#334155';
    ctx.fillRect(x, y, w, h);

    const curPct = Math.max(0, Math.min(1, currentHp / maxHp));
    const lagPct = Math.max(0, Math.min(1, lagHp / maxHp));

    // Lag bar (yellow/orange damage trailing)
    ctx.fillStyle = '#fbbf24';
    if (!reverse) {
      ctx.fillRect(x, y, w * lagPct, h);
    } else {
      ctx.fillRect(x + w * (1 - lagPct), y, w * lagPct, h);
    }

    // Active health bar (green -> yellow -> red)
    ctx.fillStyle = curPct > 0.5 ? '#10b981' : curPct > 0.25 ? '#f59e0b' : '#ef4444';
    if (!reverse) {
      ctx.fillRect(x, y, w * curPct, h);
    } else {
      ctx.fillRect(x + w * (1 - curPct), y, w * curPct, h);
    }

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  private drawSuperMeter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    meter: number,
    color: string,
  ): void {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, w, h);

    const pct = Math.max(0, Math.min(1, meter / 100));
    ctx.fillStyle = meter >= 100 ? '#ffd700' : color;
    ctx.fillRect(x, y, w * pct, h);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }
}
