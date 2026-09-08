export type MatrixQualityPreset = 'low' | 'medium' | 'high';

export interface MatrixColumn {
  x: number;
  y: number;
  speed: number;
  length: number;
  glyphIndices: Uint16Array;
  stepTimer: number;
  fontSize: number;
}

export interface MatrixRainContext {
  canvas: { width: number; height: number };
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  font: string;
}

export interface MatrixRainOptions {
  context?: MatrixRainContext;
  quality?: MatrixQualityPreset;
}

export const MATRIX_GLYPHS = '0123456789ABCDEF:・.*+-<>¦|日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ';

const QUALITY_SPACING: Record<MatrixQualityPreset, number> = {
  low: 32,
  medium: 22,
  high: 16,
};

const QUALITY_MAX_COLUMNS: Record<MatrixQualityPreset, number> = {
  low: 45,
  medium: 90,
  high: 140,
};

/**
 * Wydajny renderer cyfrowego zielonego deszczu Matrix na canvasie 2D.
 * Nie alokuje obiektów ani tablic w pętli update/render.
 */
export class MatrixRainOverlay {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: MatrixRainContext | null = null;
  private columns: MatrixColumn[] = [];
  private quality: MatrixQualityPreset = 'medium';
  private width = 0;
  private height = 0;
  private disposed = false;
  private visible = false;

  constructor(canvasOrSelector?: HTMLCanvasElement | string | null, options?: MatrixRainOptions) {
    if (options?.quality) this.quality = options.quality;

    if (options?.context) {
      this.ctx = options.context;
      this.width = options.context.canvas.width || 800;
      this.height = options.context.canvas.height || 600;
    } else if (typeof document !== 'undefined') {
      if (typeof canvasOrSelector === 'string') {
        this.canvas = document.querySelector<HTMLCanvasElement>(canvasOrSelector);
      } else if (canvasOrSelector) {
        this.canvas = canvasOrSelector;
      }
      if (this.canvas) {
        this.ctx = (this.canvas.getContext('2d') as unknown as MatrixRainContext) || null;
        this.width = this.canvas.width || (typeof window !== 'undefined' ? window.innerWidth : 800);
        this.height = this.canvas.height || (typeof window !== 'undefined' ? window.innerHeight : 600);
      }
    }

    if (this.width > 0 && this.height > 0) {
      this.rebuildColumns();
    }
  }

  get columnCount(): number {
    return this.columns.length;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** Zmienia preset gęstości kolumn kodu. */
  setQuality(quality: MatrixQualityPreset) {
    if (this.quality === quality) return;
    this.quality = quality;
    this.rebuildColumns();
  }

  /** Dostosowuje rozmiar canvasa i przelicza liczbę kolumn. */
  resize(width: number, height: number) {
    if (this.disposed) return;
    const clampedW = Math.max(1, Math.floor(width));
    const clampedH = Math.max(1, Math.floor(height));
    if (this.width === clampedW && this.height === clampedH) return;

    this.width = clampedW;
    this.height = clampedH;
    if (this.canvas) {
      this.canvas.width = clampedW;
      this.canvas.height = clampedH;
    }
    this.rebuildColumns();
  }

  private rebuildColumns() {
    const spacing = QUALITY_SPACING[this.quality];
    const maxCols = QUALITY_MAX_COLUMNS[this.quality];
    const targetCols = Math.min(maxCols, Math.max(1, Math.floor(this.width / spacing)));

    const newColumns: MatrixColumn[] = [];
    const glyphsCount = MATRIX_GLYPHS.length;

    for (let i = 0; i < targetCols; i++) {
      const length = 12 + Math.floor(Math.random() * 16);
      const glyphIndices = new Uint16Array(length);
      for (let g = 0; g < length; g++) {
        glyphIndices[g] = Math.floor(Math.random() * glyphsCount);
      }

      newColumns.push({
        x: Math.floor(i * spacing + spacing * 0.5),
        y: Math.random() * -this.height,
        speed: 160 + Math.random() * 260,
        length,
        glyphIndices,
        stepTimer: Math.random() * 0.1,
        fontSize: Math.max(12, Math.floor(spacing * 0.78)),
      });
    }

    this.columns = newColumns;
  }

  /**
   * Aktualizuje pozycje kolumn i renderuje glify na canvasie.
   * @param dt Czas ramki w sekundach.
   * @param alpha Poziom widoczności od 0.0 do 1.0.
   * @param reduceMotion Czy ruch jest wyłączony (reduced motion).
   * @param disableFlashes Czy mutacje czoła kolumny są wyłączone.
   */
  update(dt: number, alpha: number, reduceMotion: boolean, disableFlashes: boolean) {
    if (this.disposed) return;

    if (alpha <= 0.005) {
      if (this.visible) {
        this.clear();
        this.setVisibleState(false);
      }
      return;
    }

    this.setVisibleState(true);
    if (!this.ctx) return;

    const ctx = this.ctx;
    const glyphsCount = MATRIX_GLYPHS.length;
    const w = this.width;
    const h = this.height;

    // Czyścimy poprzednią klatkę
    ctx.clearRect(0, 0, w, h);

    const speedScale = reduceMotion ? 0 : 1;
    const clampedAlpha = Math.min(1, Math.max(0, alpha));

    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];

      // Aktualizacja pozycji (spadanie)
      if (speedScale > 0) {
        col.y += col.speed * dt * speedScale;
        const totalHeight = col.length * col.fontSize;
        if (col.y - totalHeight > h) {
          col.y = -totalHeight * (0.2 + Math.random() * 0.8);
          col.speed = 160 + Math.random() * 260;
        }

        // Mutacja pojedynczego znaku w strumieniu
        if (!disableFlashes) {
          col.stepTimer += dt;
          if (col.stepTimer >= 0.08) {
            col.stepTimer = 0;
            const mutIdx = Math.floor(Math.random() * col.length);
            col.glyphIndices[mutIdx] = Math.floor(Math.random() * glyphsCount);
          }
        }
      }

      ctx.font = `${col.fontSize}px monospace`;

      // Rysowanie glifów w kolumnie od ogona do czoła
      const headY = col.y;
      for (let g = 0; g < col.length; g++) {
        const glyphY = headY - g * col.fontSize;
        if (glyphY < -col.fontSize || glyphY > h + col.fontSize) continue;

        const glyphChar = MATRIX_GLYPHS[col.glyphIndices[g]] || '0';

        if (g === 0) {
          // Czoło strumienia - jasne, biało-zielone
          const headA = clampedAlpha * 0.95;
          ctx.fillStyle = `rgba(225, 255, 235, ${headA.toFixed(3)})`;
        } else if (g < 3) {
          // Początek strumienia - intensywna zieleń
          const brightA = clampedAlpha * (0.85 - g * 0.1);
          ctx.fillStyle = `rgba(0, 255, 110, ${brightA.toFixed(3)})`;
        } else {
          // Ogon strumienia - wygasająca ciemniejsza zieleń
          const tailFraction = (col.length - g) / col.length;
          const tailA = clampedAlpha * Math.max(0.08, tailFraction * 0.65);
          ctx.fillStyle = `rgba(0, 180, 60, ${tailA.toFixed(3)})`;
        }

        ctx.fillText(glyphChar, col.x, glyphY);
      }
    }
  }

  /** Czyści zawartość canvasa. */
  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private setVisibleState(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (this.canvas) {
      if (visible) {
        this.canvas.removeAttribute('hidden');
      } else {
        this.canvas.setAttribute('hidden', '');
      }
    }
  }

  /** Zwalnia zasoby i czyści referencje. */
  dispose() {
    this.disposed = true;
    this.clear();
    this.setVisibleState(false);
    this.columns = [];
    this.ctx = null;
    this.canvas = null;
  }
}
