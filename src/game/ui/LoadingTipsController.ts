/**
 * LoadingTipsController — Zarządza notatkami i ciekawostkami o aktywnościach
 * w świecie gry, wyświetlanymi podczas ekranu ładowania.
 */

export interface FestivalLoadingTip {
  readonly id: string;
  readonly icon: string;
  readonly title: string;
  readonly text: string;
}

export const FESTIVAL_LOADING_TIPS: readonly FestivalLoadingTip[] = [
  {
    id: 'guitar',
    icon: '🎸',
    title: 'Ogniskowe granie na gitarze',
    text: 'Odwiedź ognisko obok obozu i chwyć za gitarę! Zagraj legendarne rockowe utwory w minigrze rytmicznej z autentycznym brzmieniem stalowych strun.',
  },
  {
    id: 'crowd',
    icon: '🕺',
    title: 'Żywe miasteczko festiwalowe',
    text: 'Na terenie festiwalu spotkasz dziesiątki barwnych postaci – spacerują alejkami, rozmawiają przy namiotach i tańczą w rytm koncertów.',
  },
  {
    id: 'stage',
    icon: '📺',
    title: 'Koncerty live na Dużej Scenie',
    text: 'Podejdź pod Dużą Scenę! Na gigantycznych telebimach transmitowane są kultowe występy na żywo z prawdziwym przestrzennym nagłośnieniem.',
  },
  {
    id: 'sunflowers',
    icon: '🌻',
    title: 'Złociste pole słoneczników',
    text: 'Wybierz się na spacer przez malownicze pole słoneczników – to idealne miejsce na chwilę wytchnienia, relaks i podziwianie festiwalowej panoramy.',
  },
  {
    id: 'eco_cans',
    icon: '♻️',
    title: 'Eko-Wyzwanie: sprzątanie pola',
    text: 'Dbaj o festiwalową naturę! Zbieraj puszki i śmieci rozrzucone na trawie, rywalizuj w Eko-Sprincie i odblokowuj ekologiczne odznaki w Paszporcie.',
  },
  {
    id: 'table_supplies',
    icon: '🎒',
    title: 'Festiwalowe zapasy na stole',
    text: 'Zajrzyj na stół w centrum obozu – znajdziesz tam piwo, papierosy i inne zapasy, które od razu trafiają do Twojego plecaka i paska skrótów [1-4].',
  },
  {
    id: 'flanki',
    icon: '🍺',
    title: 'Turniej Flanków przy namiotach',
    text: 'Podejdź do boiska przy namiotach i rozegraj mecz w tradycyjne festiwalowe flanki ze znajomymi lub botami. Celuj, zbijaj butelkę i pij na czas!',
  },
  {
    id: 'wheel',
    icon: '🎡',
    title: 'Panorama z Diabelskiego Młyna',
    text: 'Wskocz do gondoli Diabelskiego Młyna, by zobaczyć całe tętniące życiem pole festiwalowe, oświetlone sceny i zachód słońca z lotu ptaka.',
  },
  {
    id: 'passport',
    icon: '📖',
    title: 'Paszport i Bingo Festiwalowe',
    text: 'Otwórz przewodnik [H], zbieraj pieczątki za unikalne aktywności i skreślaj pola w festiwalowym Bingo, aby zdobyć tytuł weterana Woodstocku.',
  },
];

export class LoadingTipsController {
  private currentIndex = 0;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private readonly tips: readonly FestivalLoadingTip[];
  private titleElement: Element | null = null;
  private textElement: Element | null = null;
  private counterElement: Element | null = null;
  private cardElement: Element | null = null;
  private prevButton: Element | null = null;
  private nextButton: Element | null = null;
  private prevHandler: (() => void) | null = null;
  private nextHandler: (() => void) | null = null;

  constructor(tips: readonly FestivalLoadingTip[] = FESTIVAL_LOADING_TIPS) {
    this.tips = tips;
    if (this.tips.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.tips.length);
    }
  }

  public get currentTip(): FestivalLoadingTip | null {
    if (this.tips.length === 0) return null;
    return this.tips[this.currentIndex];
  }

  public get index(): number {
    return this.currentIndex;
  }

  public get count(): number {
    return this.tips.length;
  }

  public bindElements(options: {
    titleElement?: Element | null;
    textElement?: Element | null;
    counterElement?: Element | null;
    cardElement?: Element | null;
    prevButton?: Element | null;
    nextButton?: Element | null;
  }): void {
    this.unbindButtons();
    this.titleElement = options.titleElement ?? null;
    this.textElement = options.textElement ?? null;
    this.counterElement = options.counterElement ?? null;
    this.cardElement = options.cardElement ?? null;
    this.prevButton = options.prevButton ?? null;
    this.nextButton = options.nextButton ?? null;

    if (this.prevButton) {
      this.prevHandler = () => this.prev();
      this.prevButton.addEventListener?.('click', this.prevHandler);
    }
    if (this.nextButton) {
      this.nextHandler = () => this.next();
      this.nextButton.addEventListener?.('click', this.nextHandler);
    }

    this.renderCurrentTip();
  }

  public unbindButtons(): void {
    if (this.prevButton && this.prevHandler) {
      this.prevButton.removeEventListener?.('click', this.prevHandler);
      this.prevHandler = null;
      this.prevButton = null;
    }
    if (this.nextButton && this.nextHandler) {
      this.nextButton.removeEventListener?.('click', this.nextHandler);
      this.nextHandler = null;
      this.nextButton = null;
    }
  }

  public start(intervalMs = 3800): void {
    this.stop();
    this.renderCurrentTip();
    this.intervalTimer = setInterval(() => {
      this.next();
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalTimer !== null) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public dispose(): void {
    this.stop();
    this.unbindButtons();
    this.titleElement = null;
    this.textElement = null;
    this.counterElement = null;
    this.cardElement = null;
  }

  public next(): void {
    if (this.tips.length <= 1) return;
    this.applyTransition(() => {
      this.currentIndex = (this.currentIndex + 1) % this.tips.length;
      this.renderCurrentTip();
    });
  }

  public prev(): void {
    if (this.tips.length <= 1) return;
    this.applyTransition(() => {
      this.currentIndex = (this.currentIndex - 1 + this.tips.length) % this.tips.length;
      this.renderCurrentTip();
    });
  }

  private applyTransition(updateFn: () => void): void {
    if (!this.cardElement) {
      updateFn();
      return;
    }
    this.cardElement.classList.add('tip-fading');
    setTimeout(() => {
      updateFn();
      this.cardElement?.classList.remove('tip-fading');
    }, 180);
  }

  public renderCurrentTip(): void {
    const tip = this.currentTip;
    if (!tip) return;

    if (this.titleElement) {
      this.titleElement.textContent = `${tip.icon} ${tip.title}`;
    }
    if (this.textElement) {
      this.textElement.textContent = tip.text;
    }
    if (this.counterElement) {
      this.counterElement.textContent = `${this.currentIndex + 1}/${this.tips.length}`;
    }
  }
}
