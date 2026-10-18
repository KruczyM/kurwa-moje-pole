import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  FESTIVAL_LOADING_TIPS,
  LoadingTipsController,
  DEFAULT_TIP_INTERVAL_MS,
} from './LoadingTipsController';

describe('LoadingTipsController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('contains all requested festival activities in curated tips list', () => {
    const ids = FESTIVAL_LOADING_TIPS.map((t) => t.id);
    expect(ids).toContain('guitar');
    expect(ids).toContain('crowd');
    expect(ids).toContain('stage');
    expect(ids).toContain('sunflowers');
    expect(ids).toContain('eco_cans');
    expect(ids).toContain('table_supplies');
    expect(ids).toContain('flanki');
    expect(ids).toContain('wheel');

    // Check content of guitar tip
    const guitarTip = FESTIVAL_LOADING_TIPS.find((t) => t.id === 'guitar')!;
    expect(guitarTip.text).toMatch(/gitara|ognisk/i);

    // Check content of table supplies tip
    const suppliesTip = FESTIVAL_LOADING_TIPS.find((t) => t.id === 'table_supplies')!;
    expect(suppliesTip.text).toMatch(/plecak|stół/i);

    // Check sunflowers tip
    const sunflowersTip = FESTIVAL_LOADING_TIPS.find((t) => t.id === 'sunflowers')!;
    expect(sunflowersTip.text).toMatch(/słonecznik/i);
  });

  it('binds DOM elements and renders current tip', () => {
    const titleEl = { textContent: '' } as any;
    const textEl = { textContent: '' } as any;
    const counterEl = { textContent: '' } as any;

    const controller = new LoadingTipsController();
    controller.bindElements({
      titleElement: titleEl,
      textElement: textEl,
      counterElement: counterEl,
    });

    expect(titleEl.textContent).toBeTruthy();
    expect(textEl.textContent).toBeTruthy();
    expect(counterEl.textContent).toMatch(/\d+\/\d+/);
  });

  it('cycles tips periodically when started and stops cleanly', () => {
    const controller = new LoadingTipsController();
    const initialIndex = controller.index;

    controller.start(1000);
    vi.advanceTimersByTime(1000);
    expect(controller.index).toBe((initialIndex + 1) % controller.count);

    vi.advanceTimersByTime(1000);
    expect(controller.index).toBe((initialIndex + 2) % controller.count);

    controller.stop();
    vi.advanceTimersByTime(2000);
    expect(controller.index).toBe((initialIndex + 2) % controller.count);
  });

  it('supports manual next and previous navigation', () => {
    const controller = new LoadingTipsController();
    const current = controller.index;

    controller.next();
    vi.advanceTimersByTime(200);
    expect(controller.index).toBe((current + 1) % controller.count);

    controller.prev();
    vi.advanceTimersByTime(200);
    expect(controller.index).toBe(current);
  });

  it('binds prev and next buttons and unbinds on dispose', () => {
    const controller = new LoadingTipsController();
    const current = controller.index;

    const listeners: Record<string, () => void> = {};
    const prevBtn = {
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[`prev_${event}`] = cb;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete listeners[`prev_${event}`];
      }),
    } as any;
    const nextBtn = {
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[`next_${event}`] = cb;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete listeners[`next_${event}`];
      }),
    } as any;

    controller.bindElements({
      prevButton: prevBtn,
      nextButton: nextBtn,
    });

    expect(prevBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(nextBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

    listeners['next_click']();
    vi.advanceTimersByTime(200);
    expect(controller.index).toBe((current + 1) % controller.count);

    listeners['prev_click']();
    vi.advanceTimersByTime(200);
    expect(controller.index).toBe(current);

    controller.dispose();
    expect(prevBtn.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(nextBtn.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('defaults to 8000ms (DEFAULT_TIP_INTERVAL_MS) giving comfortable reading time', () => {
    const controller = new LoadingTipsController();
    const initialIndex = controller.index;

    expect(DEFAULT_TIP_INTERVAL_MS).toBe(8000);
    controller.start();

    // At 7999ms, the tip is still on screen (not switched too fast)
    vi.advanceTimersByTime(7999);
    expect(controller.index).toBe(initialIndex);

    // At 8000ms, it advances to next tip
    vi.advanceTimersByTime(1);
    expect(controller.index).toBe((initialIndex + 1) % controller.count);
  });

  it('clicking next or prev button restarts the interval timer for a fresh reading window', () => {
    const controller = new LoadingTipsController();
    const initialIndex = controller.index;

    const listeners: Record<string, () => void> = {};
    const prevBtn = {
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[`prev_${event}`] = cb;
      }),
      removeEventListener: vi.fn(),
    } as any;
    const nextBtn = {
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[`next_${event}`] = cb;
      }),
      removeEventListener: vi.fn(),
    } as any;

    controller.bindElements({ prevButton: prevBtn, nextButton: nextBtn });
    controller.start(8000);

    // 6 seconds elapse
    vi.advanceTimersByTime(6000);

    // User clicks next button manually
    listeners['next_click']();
    vi.advanceTimersByTime(200);
    const manualIndex = controller.index;
    expect(manualIndex).toBe((initialIndex + 1) % controller.count);

    // Next auto-switch should not occur 2 seconds later (which was original 8s boundary);
    // timer was restarted, so 5 seconds after click the tip remains on screen!
    vi.advanceTimersByTime(5000);
    expect(controller.index).toBe(manualIndex);

    // After full remaining 3000ms (total 8000ms after user click), it advances
    vi.advanceTimersByTime(3000);
    expect(controller.index).toBe((manualIndex + 1) % controller.count);
  });
});
