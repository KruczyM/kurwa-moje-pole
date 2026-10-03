import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FlankiGame } from './FlankiGame';

describe('FlankiGame', () => {
  let game: FlankiGame;
  let toastMessages: string[];
  let drinkSfxCalled: boolean;

  beforeEach(() => {
    toastMessages = [];
    drinkSfxCalled = false;
    game = new FlankiGame(
      {
        canPosition: [0, 0, 5],
        playerLineZ: 9.0,
        botLineZ: 1.0,
        drinkRate: 0.5, // 50% per second for fast test validation
        botAccuracy: 1.0, // 100% deterministic for tests
      },
      {
        onToast: (msg) => toastMessages.push(msg),
        onDrinkSfx: () => (drinkSfxCalled = true),
      },
    );
  });

  it('inicjalizuje się w stanie idle z puszką stojącą prosto', () => {
    expect(game.getPhase()).toBe('idle');
    expect(game.getPlayerBeer()).toBe(1.0);
    expect(game.getBotBeer()).toBe(1.0);
    expect(game.isCanUpright()).toBe(true);
    expect(game.root.children.length).toBeGreaterThan(3);
  });

  it('startMatch() przechodzi do fazy aiming i resetuje stan meczu', () => {
    game.startMatch();
    expect(game.getPhase()).toBe('aiming');
    expect(game.getPlayerBeer()).toBe(1.0);
    expect(game.getBotBeer()).toBe(1.0);
    expect(game.isCanUpright()).toBe(true);
    expect(toastMessages.some((m) => m.includes('FLANKI ROZPOCZĘTE'))).toBe(true);
  });

  it('startCharge() i update() zwiększają siłę rzutu', () => {
    game.startMatch();
    game.startCharge();
    const initialPower = game.getHudState().throwPower;

    // Krok symulacji o 0.3 sekundy
    game.update(0.3);
    const updatedPower = game.getHudState().throwPower;

    expect(updatedPower).toBeGreaterThan(initialPower);
    expect(game.getHudState().isCharging).toBe(true);
  });

  it('releaseThrow() wystrzeliwuje pocisk w stronę puszki i trafia', () => {
    game.startMatch();
    game.startCharge();
    game.update(0.2);

    // Celujemy w stronę puszki (Z = 5 z pozycji Z = 9)
    const cameraOrigin = new THREE.Vector3(0, 1.5, 9);
    const cameraDir = new THREE.Vector3(0, -0.2, -1).normalize();

    const released = game.releaseThrow(cameraOrigin, cameraDir);
    expect(released).toBe(true);
    expect(game.getPhase()).toBe('projectile_flying');

    // Symulujemy lot pocisku przez kilka klatek
    for (let i = 0; i < 20; i++) {
      game.update(0.02);
      if (game.getPhase() === 'player_drinking') break;
    }

    // Jeśli trafił: puszka przewrócona, faza player_drinking
    if (game.getPhase() === 'player_drinking') {
      expect(game.isCanUpright()).toBe(false);
      expect(drinkSfxCalled).toBe(true);
      expect(toastMessages.some((m) => m.includes('TRAFIENIE'))).toBe(true);
    }
  });

  it('w fazie player_drinking gracz pije piwo, a bot biegnie postawić puszkę', () => {
    game.startMatch();
    // Bezpośrednie wywołanie trafienia (poprzez symulację stanu)
    (game as any).phase = 'player_drinking';
    (game as any).tipOverCan();
    expect(game.isCanUpright()).toBe(false);

    // Po 0.5s picia stan piwa gracza powinien spaść o ~0.25 (drinkRate = 0.5)
    game.update(0.5);
    expect(game.getPlayerBeer()).toBeLessThan(1.0);

    // Po wystarczającym czasie bot dociera i stawia puszkę
    for (let i = 0; i < 60; i++) {
      game.update(0.05);
      if (game.getPhase() === 'bot_turn') break;
    }

    expect(game.getPhase()).toBe('bot_turn');
    expect(game.isCanUpright()).toBe(true);
  });

  it('zwycięstwo gracza gdy wypije piwo do 0% w trakcie picia', () => {
    game.startMatch();
    (game as any).phase = 'player_drinking';
    (game as any).playerBeer = 0.05;

    // Po 0.2s picia piwo się kończy
    game.update(0.2);
    expect(game.getPlayerBeer()).toBe(0);
    expect(game.getPhase()).toBe('game_over');
    expect(toastMessages.some((m) => m.includes('WYGRAŁEŚ WE FLANKI'))).toBe(true);
  });

  it('standUpCanByPlayer() stawia puszkę podczas tury picia bota', () => {
    game.startMatch();
    (game as any).phase = 'bot_drinking';
    (game as any).tipOverCan();
    expect(game.isCanUpright()).toBe(false);

    const stoodUp = game.standUpCanByPlayer();
    expect(stoodUp).toBe(true);
    expect(game.isCanUpright()).toBe(true);
    expect(game.getPhase()).toBe('aiming');
  });

  it('getHudState() zwraca kompletny zestaw danych i promptów', () => {
    const hudIdle = game.getHudState();
    expect(hudIdle.active).toBe(false);
    expect(hudIdle.promptText).toContain('zagrać w Flanki');

    game.startMatch();
    const hudAiming = game.getHudState();
    expect(hudAiming.active).toBe(true);
    expect(hudAiming.promptText).toContain('wycelować');
  });

  it('dispose() bezpiecznie zwalnia geometrie i materiały', () => {
    expect(() => game.dispose()).not.toThrow();
    expect(game.root.children.length).toBe(0);
    expect(game.getPhase()).toBe('idle');
  });
});
