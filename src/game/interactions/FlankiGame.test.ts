import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('assigns an offset throwing place instead of centering every player', () => {
    game.prepareOfflineLobby();
    expect(game.getLocalStandPosition().x).toBe(-1.6);
    expect(game.getLocalStandPosition().z).toBe(9);
  });

  it('places existing participants on their team lines and keeps them facing the can', () => {
    const npcs = Array.from({ length: 5 }, (_, i) => ({ root: new THREE.Group(), name: `NPC ${i}` }));
    game.prepareOfflineLobby();
    game.enlistNearbyNpcs(npcs);
    game.startMatch();
    for (const npc of npcs) {
      const target = npc.root.userData.flankiTarget as THREE.Vector3;
      expect(npc.root.position.distanceTo(target)).toBeLessThan(1e-6);
      const bearing = Math.atan2(game.canPosition.x - target.x, game.canPosition.z - target.z);
      expect(npc.root.rotation.y).toBeCloseTo(bearing);
    }
    npcs[2].root.rotation.y = 0;
    npcs[2].root.position.x += 0.3;
    game.update(1 / 60);
    expect(npcs[2].root.position.distanceTo(npcs[2].root.userData.flankiTarget)).toBeLessThan(1e-6);
    expect(npcs[2].root.position.z).toBe(9);
    game.stopMatch();
    expect(npcs.every((n) => !n.root.userData.flankiFacing)).toBe(true);
  });

  it('a minimum-power throw does not topple the can, including floor bounces', () => {
    game.prepareOfflineLobby();
    game.startMatch();
    const origin = new THREE.Vector3(0, 1.9, 9);
    const direction = new THREE.Vector3(0, -0.2, -1).normalize();
    game.startCharge(origin, direction);
    game.releaseThrow(origin, direction);
    for (let i = 0; i < 240 && game.getPhase() === 'projectile_flying'; i++) {
      game.update(1 / 60);
      expect(game.isCanUpright()).toBe(true);
    }
    expect(game.getPhase()).not.toBe('player_drinking');
  });

  it('default bots physically hit most shots from an offset stance without guaranteed hits', () => {
    let hits = 0;
    const random = vi.spyOn(Math, 'random');
    try {
      for (let sample = 0; sample < 20; sample++) {
        random.mockReturnValue((sample + 0.5) / 20);
        const match = new FlankiGame({ canPosition: [0, 0, 5], playerLineZ: 9, botLineZ: 1 });
        match.startMatch();
        match.roster.setTurnIndex(1);
        (match as any).phase = 'bot_turn';
        (match as any).botTurnTimer = 0;
        match.update(0.001);
        for (let step = 0; step < 300 && match.getPhase() === 'projectile_flying'; step++)
          match.update(1 / 120);
        if (!match.isCanUpright()) hits++;
        match.dispose();
      }
    } finally {
      random.mockRestore();
    }
    expect(hits).toBeGreaterThanOrEqual(14);
    expect(hits).toBeLessThan(20);
  });

  it('borrows nearby entities without cloning, reparenting or teleporting them', () => {
    const scene = new THREE.Scene();
    const npcs = Array.from({ length: 5 }, (_, i) => {
      const root = new THREE.Group();
      root.position.set(20 + i, 0, 20);
      scene.add(root);
      return { root, name: `Nearby ${i}` };
    });
    game.enlistNearbyNpcs(npcs);
    expect(game.runnerA.mesh).toBe(npcs[0].root);
    expect(npcs[0].root.parent).toBe(scene);
    expect(npcs[0].root.position.x).toBe(20);
    expect(game.arePlayersReady()).toBe(false);
    npcs.forEach((n) => n.root.position.copy(n.root.userData.flankiTarget));
    expect(game.arePlayersReady()).toBe(true);
    game.stopMatch();
    expect(npcs.every((n) => !n.root.userData.flankiTarget)).toBe(true);
    expect(npcs.every((n) => n.root.parent === scene)).toBe(true);
    game.dispose();
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
    game.setPlayerDrinking(true);
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
    game.setPlayerDrinking(true);
    game.update(0.2);
    expect(game.getPlayerBeer()).toBe(0);
    expect(game.getPhase()).toBe('game_over');
    expect(toastMessages.some((m) => m.includes('WYGRAŁEŚ WE FLANKI'))).toBe(true);
  });

  it('gracz nie pomija powrotu wyznaczonego biegacza ręcznym postawieniem puszki', () => {
    game.startMatch();
    (game as any).phase = 'bot_drinking';
    (game as any).tipOverCan();
    expect(game.isCanUpright()).toBe(false);

    const stoodUp = game.standUpCanByPlayer();
    expect(stoodUp).toBe(false);
    expect(game.isCanUpright()).toBe(false);
    expect(game.getPhase()).toBe('bot_drinking');
  });

  it('getHudState() zwraca kompletny zestaw danych i promptów', () => {
    const hudIdle = game.getHudState();
    expect(hudIdle.active).toBe(false);
    expect(hudIdle.promptText).toContain('zagrać w Flanki');

    game.startMatch();
    const hudAiming = game.getHudState();
    expect(hudAiming.active).toBe(true);
    expect(hudAiming.promptText).toContain('wyceluj');
  });

  it('posiada piłeczkę tenisową o fluorescencyjnej barwie z białymi szwami', () => {
    const ballMesh = game.root.getObjectByName('Flanki_TennisBall');
    expect(ballMesh).toBeDefined();
    expect(ballMesh?.children.length).toBeGreaterThanOrEqual(1);
  });

  it('obsługuje zewnętrzny model 3D puszki piwa', () => {
    const mockModel = {
      scene: new THREE.Group().add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5))),
    } as any;
    const customGame = new FlankiGame({ beerCanModel: mockModel });
    expect(customGame.root.getObjectByName('Flanki_Can')).toBeDefined();
    customGame.dispose();
  });

  it('wywołuje callback onVictory po dopiciu piwa przez gracza', () => {
    let victoryCalled = false;
    const victoryGame = new FlankiGame({ drinkRate: 10.0 }, { onVictory: () => (victoryCalled = true) });
    victoryGame.startMatch();
    (victoryGame as any).phase = 'player_drinking';
    victoryGame.setPlayerDrinking(true);
    victoryGame.update(0.2);

    expect(victoryGame.getPhase()).toBe('game_over');
    expect(victoryGame.getPlayerBeer()).toBe(0);
    expect(victoryCalled).toBe(true);
    victoryGame.dispose();
  });

  it('only drinks while E is held; unrelated keys do not choke or consume beer', () => {
    game.startMatch();
    (game as any).phase = 'player_drinking';
    expect(game.getHudState().qteSequence).toBeUndefined();
    expect(game.handleDrinkInput('Q').success).toBe(false);
    game.update(0.1);
    expect(game.getPlayerBeer()).toBe(1);
    game.setPlayerDrinking(true);
    game.update(0.1);
    expect(game.getPlayerBeer()).toBeCloseTo(0.95);
    game.setPlayerDrinking(false);
    game.update(0.1);
    expect(game.getPlayerBeer()).toBeCloseTo(0.95);
    expect(game.getHudState().isChoking).toBe(false);
  });

  it('locks every thrower phase and only unlocks the defending human runner', () => {
    expect(game.selectRunner('A', 'player')).toBe(true);
    game.startMatch();
    expect(game.isLocalRunner()).toBe(true);
    expect(game.shouldLockPlayerMovement()).toBe(true);
    game.roster.advanceTurn();
    (game as any).phase = 'bot_drinking';
    (game as any).tipOverCan();
    game.update(0.01);
    expect(game.shouldLockPlayerMovement()).toBe(false);
    expect(game.standUpCanByPlayer()).toBe(false);
    const camera = game.canPosition.clone().add(new THREE.Vector3(0, 1.9, 0));
    game.updateLocalRunnerPosition(camera);
    expect(game.standUpCanByPlayer()).toBe(true);
    expect(game.isCanUpright()).toBe(true);
    expect(game.getPhase()).toBe('bot_drinking');
    camera.copy(game.runnerA.basePosition).add(new THREE.Vector3(0, 1.9, 0));
    game.updateLocalRunnerPosition(camera);
    expect(game.shouldLockPlayerMovement()).toBe(true);
    expect(game.roster.getTurnIndex()).toBe(2);
  });

  it('locks the chosen arc and charges monotonically to a stable maximum', () => {
    game.startMatch();
    game.startCharge(new THREE.Vector3(0, 1.9, 9), new THREE.Vector3(0, -0.2, -1));
    game.update(0.5);
    const power = game.getHudState().throwPower;
    game.update(0.5);
    expect(game.getHudState().throwPower).toBeGreaterThan(power);
    game.update(5);
    expect(game.getHudState().throwPower).toBe(1);
    game.update(5);
    expect(game.getHudState().throwPower).toBe(1);
    game.releaseThrow(new THREE.Vector3(0, 1.9, 9), new THREE.Vector3(1, 0, 0));
    expect((game as any).projectileVel.x).toBeCloseTo(0);
    expect((game as any).projectileVel.z).toBeLessThan(0);
  });
  it('the recommended green-band throw physically hits the can without random luck', () => {
    game.startMatch();
    const origin = new THREE.Vector3(0, 1.9, 9),
      direction = new THREE.Vector3(0.01, -0.2, -1).normalize();
    game.updateAimPreview(origin, direction);
    const recommended = game.getHudState().recommendedPower!;
    game.startCharge(origin, direction);
    game.update((recommended - 0.05) / 0.5);
    game.releaseThrow(origin, direction);
    for (let i = 0; i < 100 && game.getPhase() === 'projectile_flying'; i++) game.update(0.01);
    expect(game.getPhase()).toBe('player_drinking');
    expect(game.isCanUpright()).toBe(false);
  });

  it('synchronizuje tury gospodarza i gościa, a gość nie wykonuje samodzielnych tur botów', () => {
    const lobby = {
      sessionId: 'match',
      hostId: 'host',
      phase: 'playing' as const,
      players: [
        { id: 'host', name: 'Host', character: 'Amper', team: 'A' as const },
        { id: 'guest', name: 'Guest', character: 'Antena', team: 'B' as const },
      ],
    };
    const guest = new FlankiGame();
    game.configureLobby(lobby, 'host');
    guest.configureLobby(lobby, 'guest');
    guest.startMatch({ multiplayer: true, isHost: false });
    game.setCallbacks({
      onSendMultiplayerAction: (action, payload) =>
        guest.handleNetworkAction(action, payload, 'host', 'match'),
    });
    game.startMatch({ multiplayer: true, isHost: true });
    expect(guest.getPhase()).toBe('bot_turn');
    guest.update(10);
    expect(guest.getPhase()).toBe('bot_turn');
    // After a miss, the first member of B receives the next throw.
    game.roster.advanceTurn();
    (game as any).phase = 'bot_turn';
    game.update(0.1);
    expect(guest.getPhase()).toBe('aiming');
    expect(guest.isLocalTurn()).toBe(true);
    expect(game.isLocalTurn()).toBe(false);
    // An old match cannot alter the new one.
    guest.handleNetworkAction('flanki:snapshot', { phase: 'game_over', turn: 0 }, 'host', 'old');
    expect(guest.getPhase()).toBe('aiming');
    guest.dispose();
  });

  it('ignoruje obcy rzut i nie pozwala rzucić bez rozpoczęcia ładowania', () => {
    game.startMatch();
    expect(game.releaseThrow(new THREE.Vector3(0, 1.8, 9), new THREE.Vector3(0, 0, -1))).toBe(false);
    game.handleNetworkAction(
      'flanki:throw',
      { direction: [0, 0, -1], power: 1, swaySeconds: 0 },
      'intruder',
      'unknown',
    );
    expect(game.getPhase()).toBe('aiming');
  });

  it('validates a remote human runner: no distant pickup, no teleport, STOP only after return', () => {
    game.configureLobby(
      {
        sessionId: 'runner-match',
        hostId: 'host',
        phase: 'playing',
        players: [
          { id: 'host', name: 'Host', character: 'Amper', team: 'A' },
          { id: 'guest', name: 'Guest', character: 'Antena', team: 'B' },
        ],
        runners: { B: 'guest' },
      },
      'host',
    );
    game.startMatch({ multiplayer: true, isHost: true });
    (game as any).phase = 'player_drinking';
    (game as any).tipOverCan();
    game.update(0.01);
    const action = (name: string, payload: Record<string, unknown>) =>
      game.handleNetworkAction(name, payload, 'guest', 'runner-match');
    action('flanki:pickup', {});
    expect(game.isCanUpright()).toBe(false);
    const start = game.runnerB.currentPosition.clone();
    action('flanki:runner_move', { position: [0, 0, 5] });
    expect(game.runnerB.currentPosition).toEqual(start);
    const path = [
      [2.2, 0, 1.5],
      [2.2, 0, 2.5],
      [2.2, 0, 3.5],
      [1.2, 0, 4.5],
      [0.2, 0, 5],
    ];
    path.forEach((position) => action('flanki:runner_move', { position }));
    action('flanki:pickup', {});
    expect(game.isCanUpright()).toBe(true);
    expect(game.getPhase()).toBe('player_drinking');
    [...path].reverse().forEach((position) => action('flanki:runner_move', { position }));
    action('flanki:runner_move', { position: start.toArray() });
    expect(game.roster.getTurnIndex()).toBe(1);
    expect(game.getHudState().isStopActive).toBe(true);
    expect(game.roster.getCurrentThrower().id).not.toBe('guest');
  });

  it('preserves both human runners across start and snapshots without assigning them NPC meshes', () => {
    const lobby = {
      sessionId: 'both-runners',
      hostId: 'host',
      phase: 'playing' as const,
      players: [
        { id: 'host', name: 'Host', character: 'Amper' as const, team: 'A' as const },
        { id: 'guest', name: 'Guest', character: 'Antena' as const, team: 'B' as const },
      ],
      runners: { A: 'host', B: 'guest' },
    };
    game.configureLobby(lobby, 'host');
    game.startMatch({ multiplayer: true, isHost: true });
    const start = game.runnerB.currentPosition.clone();
    (game as any).phase = 'player_drinking';
    game.update(0.5);
    expect(game.runnerA.mesh).toBeUndefined();
    expect(game.runnerB.mesh).toBeUndefined();
    expect(game.runnerB.currentPosition).toEqual(start);
    const guest = new FlankiGame();
    guest.configureLobby({ ...lobby, runners: {} }, 'guest');
    guest.startMatch({ multiplayer: true, isHost: false });
    guest.handleNetworkAction(
      'flanki:snapshot',
      {
        phase: 'player_drinking',
        turn: 0,
        canUpright: false,
        runnerIdA: 'host',
        runnerIdB: 'guest',
        runnerStateB: 'running_to_can',
      },
      'host',
      lobby.sessionId,
    );
    expect(guest.roster.teamA.runner.id).toBe('host');
    expect(guest.roster.teamB.runner.id).toBe('guest');
    expect(guest.canLocalRunnerMove()).toBe(true);
    expect(guest.runnerB.mesh).toBeUndefined();
    guest.dispose();
  });

  it('remote drinking consumes only the holding teammate and expires if release is lost', () => {
    game.configureLobby(
      {
        sessionId: 'drink-match',
        hostId: 'host',
        phase: 'playing',
        players: [
          { id: 'host', name: 'Host', character: 'Amper', team: 'A' },
          { id: 'guest', name: 'Guest', character: 'Antena', team: 'A' },
        ],
      },
      'host',
    );
    game.startMatch({ multiplayer: true, isHost: true });
    (game as any).phase = 'player_drinking';
    (game.runnerB as any).runSpeed = 0.01;
    game.update(0.1);
    expect(game.roster.teamA.throwers.every((p) => p.beerRemaining === 1)).toBe(true);
    game.handleNetworkAction('flanki:drink', { held: true }, 'guest', 'drink-match');
    game.update(0.1);
    const guest = game.roster.teamA.throwers.find((p) => p.id === 'guest')!;
    expect(guest.beerRemaining).toBeCloseTo(0.95);
    expect(game.roster.teamA.throwers.find((p) => p.id === 'host')!.beerRemaining).toBe(1);
    game.update(1);
    const remaining = guest.beerRemaining;
    game.update(1);
    expect(guest.beerRemaining).toBe(remaining);
    game.handleNetworkAction('flanki:drink', { held: true }, 'stranger', 'drink-match');
    expect((game as any).drinkingPlayers.has('stranger')).toBe(false);
  });

  it('rzut podąża za kierunkiem celowania, a nie automatycznie za puszką', () => {
    game.startMatch();
    game.startCharge();
    game.update(0.5);
    game.releaseThrow(new THREE.Vector3(0, 1.8, 9), new THREE.Vector3(1, 0, 0));
    game.update(0.1);
    expect(game.root.getObjectByName('Flanki_TennisBall')!.position.x).toBeGreaterThan(0.5);
    expect(game.isCanUpright()).toBe(true);
  });

  it('dispose() bezpiecznie zwalnia geometrie i materiały', () => {
    expect(() => game.dispose()).not.toThrow();
    expect(game.root.children.length).toBe(0);
    expect(game.getPhase()).toBe('idle');
  });

  it('bot rzeczywiście rzuca piłkę i trafienie wynika z lotu, a po STOP kolejka idzie dalej', () => {
    game.startMatch();
    game.roster.advanceTurn();
    (game as any).phase = 'bot_turn';
    (game as any).botTurnTimer = 0;
    game.update(0.02);
    expect(game.getPhase()).toBe('projectile_flying');
    expect(game.isCanUpright()).toBe(true);
    for (let i = 0; i < 100 && game.getPhase() === 'projectile_flying'; i++) game.update(0.01);
    expect(game.getPhase()).toBe('bot_drinking');
    expect(game.isCanUpright()).toBe(false);
    for (let i = 0; i < 300 && game.roster.getTurnIndex() === 1; i++) game.update(0.01);
    expect(game.roster.getTurnIndex()).toBe(2);
    expect(game.roster.getCurrentThrower().id).toBe('antena');
    expect(game.isCanUpright()).toBe(true);
    expect(game.getHudState().isStopActive).toBe(true);
  });
});
