import * as THREE from 'three';
import { terrainHeight } from '../world/CampWorld';

export type FlankiPhase =
  | 'idle'
  | 'aiming'
  | 'projectile_flying'
  | 'player_drinking'
  | 'bot_turn'
  | 'bot_drinking'
  | 'game_over';

export interface FlankiGameConfig {
  canPosition?: [number, number, number];
  playerLineZ?: number;
  botLineZ?: number;
  playerBeerInitial?: number;
  botBeerInitial?: number;
  drinkRate?: number; // beer consumed per second
  botAccuracy?: number; // 0..1
}

export interface FlankiHudState {
  active: boolean;
  phase: FlankiPhase;
  playerBeer: number;
  botBeer: number;
  throwPower: number;
  isCharging: boolean;
  promptText: string;
}

export class FlankiGame {
  readonly root = new THREE.Group();
  private phase: FlankiPhase = 'idle';

  private readonly canPosition: THREE.Vector3;
  private readonly playerLineZ: number;
  private readonly botLineZ: number;
  private readonly drinkRate: number;
  private readonly botAccuracy: number;

  private playerBeer = 1.0;
  private botBeer = 1.0;

  private isCharging = false;
  private chargeTimer = 0;
  private throwPower = 0;

  // Projectile state
  private readonly projectilePos = new THREE.Vector3();
  private readonly projectileVel = new THREE.Vector3();

  // Bot state
  private readonly botPos = new THREE.Vector3();
  private botTurnTimer = 0;
  private botSetupTimer = 0;

  // Meshes
  private readonly canMesh: THREE.Mesh;
  private readonly projectileMesh: THREE.Mesh;
  private readonly botMesh: THREE.Group;
  private readonly playerLineMesh: THREE.Mesh;
  private readonly botLineMesh: THREE.Mesh;
  private readonly interactionHitbox: THREE.Mesh;

  private onToast?: (msg: string) => void;
  private onDrinkSfx?: () => void;

  constructor(
    config: FlankiGameConfig = {},
    callbacks?: { onToast?: (msg: string) => void; onDrinkSfx?: () => void },
  ) {
    this.root.name = 'FlankiGame';
    this.onToast = callbacks?.onToast;
    this.onDrinkSfx = callbacks?.onDrinkSfx;

    const canY = config.canPosition ? config.canPosition[1] : terrainHeight(0, 5);
    this.canPosition = new THREE.Vector3(
      config.canPosition?.[0] ?? 0,
      canY,
      config.canPosition?.[2] ?? 5,
    );
    this.playerLineZ = config.playerLineZ ?? 9.0;
    this.botLineZ = config.botLineZ ?? 1.0;
    this.drinkRate = config.drinkRate ?? 0.22;
    this.botAccuracy = config.botAccuracy ?? 0.5;

    // 1. Can mesh (puszka piwa na środku)
    const canGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.24, 16);
    const canMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // golden beer can
      metalness: 0.8,
      roughness: 0.25,
    });
    this.canMesh = new THREE.Mesh(canGeo, canMat);
    this.canMesh.name = 'Flanki_Can';
    this.canMesh.position.copy(this.canPosition).add(new THREE.Vector3(0, 0.12, 0));
    this.canMesh.castShadow = true;
    this.root.add(this.canMesh);

    // 2. Throw lines (linie rzutu na trawie)
    const lineGeo = new THREE.BoxGeometry(3.5, 0.02, 0.08);
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.9,
    });
    this.playerLineMesh = new THREE.Mesh(lineGeo, lineMat);
    this.playerLineMesh.position.set(0, terrainHeight(0, this.playerLineZ) + 0.01, this.playerLineZ);
    this.root.add(this.playerLineMesh);

    this.botLineMesh = new THREE.Mesh(lineGeo, lineMat);
    this.botLineMesh.position.set(0, terrainHeight(0, this.botLineZ) + 0.01, this.botLineZ);
    this.root.add(this.botLineMesh);

    // 3. Projectile mesh (kamień do rzucania)
    const stoneGeo = new THREE.DodecahedronGeometry(0.07);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x6e7072,
      roughness: 0.9,
    });
    this.projectileMesh = new THREE.Mesh(stoneGeo, stoneMat);
    this.projectileMesh.name = 'Flanki_Stone';
    this.projectileMesh.visible = false;
    this.root.add(this.projectileMesh);

    // 4. Opponent Bot proxy
    this.botMesh = new THREE.Group();
    this.botMesh.name = 'Flanki_Opponent_Bot';
    const botBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.9, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0x334466 }),
    );
    botBody.position.y = 0.9;
    this.botMesh.add(botBody);
    this.botPos.set(0, terrainHeight(0, this.botLineZ), this.botLineZ);
    this.botMesh.position.copy(this.botPos);
    this.root.add(this.botMesh);

    // 5. Interaction trigger at player line
    const hitGeo = new THREE.BoxGeometry(3.5, 2.0, 2.0);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.interactionHitbox = new THREE.Mesh(hitGeo, hitMat);
    this.interactionHitbox.position.set(0, terrainHeight(0, this.playerLineZ) + 1.0, this.playerLineZ);
    this.interactionHitbox.userData.interaction = {
      kind: 'flanki',
      label: 'Zagraj w Flanki (Bierball)',
    };
    this.root.add(this.interactionHitbox);
  }

  getPhase(): FlankiPhase {
    return this.phase;
  }

  getPlayerBeer(): number {
    return Math.max(0, this.playerBeer);
  }

  getBotBeer(): number {
    return Math.max(0, this.botBeer);
  }

  getCanPosition(): THREE.Vector3 {
    return this.canPosition.clone();
  }

  isCanUpright(): boolean {
    return this.canMesh.rotation.x === 0;
  }

  /** Rozpoczyna nowy mecz we flanki */
  startMatch(): void {
    this.playerBeer = 1.0;
    this.botBeer = 1.0;
    this.resetCan();
    this.resetBotPosition();
    this.phase = 'aiming';
    this.isCharging = false;
    this.throwPower = 0;
    this.chargeTimer = 0;
    this.projectileMesh.visible = false;
    this.toast('🍻 FLANKI ROZPOCZĘTE! Przytrzymaj [E] lub LPM, aby wycelować i rzucić w puszkę!');
  }

  /** Kończy lub resetuje mecz */
  stopMatch(): void {
    this.phase = 'idle';
    this.isCharging = false;
    this.resetCan();
    this.resetBotPosition();
    this.projectileMesh.visible = false;
  }

  /** Rozpoczyna ładowanie siły rzutu */
  startCharge(): void {
    if (this.phase === 'aiming') {
      this.isCharging = true;
      this.chargeTimer = 0;
      this.throwPower = 0.1;
    }
  }

  /** Zwalnia ładowanie i wyrzuca kamień w stronę podaną przez kamerę */
  releaseThrow(cameraOrigin: THREE.Vector3, cameraDirection: THREE.Vector3): boolean {
    if (this.phase !== 'aiming') return false;

    this.isCharging = false;
    const power = Math.max(0.2, this.throwPower);
    this.phase = 'projectile_flying';

    this.projectilePos.copy(cameraOrigin).addScaledVector(cameraDirection, 0.4);
    this.projectileMesh.position.copy(this.projectilePos);
    this.projectileMesh.visible = true;

    // Prędkość wylotowa: 9 do 22 m/s w zależności od siły
    const speed = 9.0 + power * 13.0;
    this.projectileVel.copy(cameraDirection).normalize().multiplyScalar(speed);
    // Lekki łuk balistyczny
    this.projectileVel.y += 1.8 + power * 2.2;

    this.toast(`Rzut! (Siła: ${Math.round(power * 100)}%)`);
    return true;
  }

  /** Gracz podbiega do puszki i stawia ją podczas tury picia bota */
  standUpCanByPlayer(): boolean {
    if (this.phase !== 'bot_drinking') return false;

    this.resetCan();
    this.toast('Postawiłeś puszkę! Przeciwnik przestał pić!');

    if (this.botBeer <= 0) {
      this.phase = 'game_over';
      this.toast('🍺 PRZEGRAŁEŚ! Przeciwnik opróżnił swoje piwo pierwszy!');
    } else {
      this.phase = 'aiming';
      this.toast('Twoja kolej na rzut!');
    }
    return true;
  }

  private resetCan(): void {
    this.canMesh.rotation.set(0, 0, 0);
    this.canMesh.position.set(this.canPosition.x, this.canPosition.y + 0.12, this.canPosition.z);
  }

  private tipOverCan(): void {
    this.canMesh.rotation.set(Math.PI / 2, 0, 0);
    this.canMesh.position.set(this.canPosition.x, this.canPosition.y + 0.075, this.canPosition.z);
  }

  private resetBotPosition(): void {
    this.botPos.set(0, terrainHeight(0, this.botLineZ), this.botLineZ);
    this.botMesh.position.copy(this.botPos);
  }

  private toast(msg: string): void {
    this.onToast?.(msg);
  }

  /** Główna pętla symulacji flanków */
  update(dt: number, playerPos?: THREE.Vector3): void {
    if (this.phase === 'idle' || this.phase === 'game_over') return;

    // 1. Ładowanie siły rzutu
    if (this.phase === 'aiming' && this.isCharging) {
      this.chargeTimer += dt;
      // Oscylacja 0.15 .. 1.0
      this.throwPower = 0.15 + 0.85 * ((Math.sin(this.chargeTimer * 4.0 - Math.PI / 2) + 1) / 2);
    }

    // 2. Lot pocisku gracza
    if (this.phase === 'projectile_flying') {
      this.projectileVel.y -= 9.81 * dt;
      this.projectilePos.addScaledVector(this.projectileVel, dt);
      this.projectileMesh.position.copy(this.projectilePos);

      // Sprawdzenie trafienia w puszkę
      const distToCan = this.projectilePos.distanceTo(this.canMesh.position);
      if (distToCan < 0.28) {
        // TRAFIENIE!
        this.projectileMesh.visible = false;
        this.tipOverCan();
        this.phase = 'player_drinking';
        this.botSetupTimer = 0;
        this.toast('🎯 TRAFIENIE! PIJ PIWO, DOPÓKI BOT NIE POSTAWI PUSZKI!');
        this.onDrinkSfx?.();
        return;
      }

      // Sprawdzenie uderzenia w ziemię
      const groundY = terrainHeight(this.projectilePos.x, this.projectilePos.z);
      if (this.projectilePos.y <= groundY) {
        this.projectileMesh.visible = false;
        this.phase = 'bot_turn';
        this.botTurnTimer = 1.4;
        this.toast('💨 PUDŁO! Tura przeciwnika.');
        return;
      }
    }

    // 3. Gracz pije, bot biegnie postawić puszkę
    if (this.phase === 'player_drinking') {
      this.playerBeer -= dt * this.drinkRate;
      if (this.playerBeer <= 0) {
        this.playerBeer = 0;
        this.phase = 'game_over';
        this.toast('🏆 WYGRAŁEŚ WE FLANKI! Kurwa Moje Pole, jesteś mistrzem festiwalu!');
        return;
      }

      // Bot biegnie do puszki (Z: 1 -> 5)
      const targetZ = this.canPosition.z;
      if (this.botPos.z < targetZ - 0.2) {
        this.botPos.z += dt * 4.6;
        this.botMesh.position.copy(this.botPos);
      } else {
        // Bot jest przy puszce i stawia ją
        this.botSetupTimer += dt;
        if (this.botSetupTimer >= 0.6) {
          this.resetCan();
          this.toast('Puszka stoi! Stop picia!');
          this.phase = 'bot_turn';
          this.botTurnTimer = 1.2;
        }
      }
    }

    // 4. Tura rzutu bota
    if (this.phase === 'bot_turn') {
      // Bot wraca na swoją linię (Z: 1.0)
      if (this.botPos.z > this.botLineZ + 0.1) {
        this.botPos.z -= dt * 4.0;
        this.botMesh.position.copy(this.botPos);
      }

      this.botTurnTimer -= dt;
      if (this.botTurnTimer <= 0) {
        // Bot rzuca
        const willHit = Math.random() < this.botAccuracy;
        if (willHit) {
          this.tipOverCan();
          this.phase = 'bot_drinking';
          this.toast('💥 PRZECIWNIK TRAFIŁ! BIEGNIJ POSTAWIĆ PUSZKĘ [E]!');
        } else {
          this.toast('Przeciwnik spudłował! Twoja kolej na rzut!');
          this.phase = 'aiming';
        }
      }
    }

    // 5. Bot pije, gracz musi podbiec i postawić puszkę
    if (this.phase === 'bot_drinking') {
      this.botBeer -= dt * this.drinkRate;
      if (this.botBeer <= 0) {
        this.botBeer = 0;
        this.phase = 'game_over';
        this.toast('🍺 PRZEGRAŁEŚ! Bot wypił piwo przed postawieniem puszki!');
      }
    }
  }

  /** Zwraca kompletny stan dla UI / HUD */
  getHudState(): FlankiHudState {
    let prompt = '';
    switch (this.phase) {
      case 'idle':
        prompt = 'Naciśnij [E], aby zagrać w Flanki';
        break;
      case 'aiming':
        prompt = this.isCharging
          ? `Moc: ${Math.round(this.throwPower * 100)}% (zwolnij [E] lub LPM, aby rzucić)`
          : 'Przytrzymaj [E] lub LPM, aby wycelować';
        break;
      case 'projectile_flying':
        prompt = 'Rzut w toku...';
        break;
      case 'player_drinking':
        prompt = `🍻 PIJESZ! Twoje piwo: ${Math.round(this.playerBeer * 100)}%`;
        break;
      case 'bot_turn':
        prompt = 'Przeciwnik przymierza się do rzutu...';
        break;
      case 'bot_drinking':
        prompt = `⚠️ BIEGNIJ POSTAWIĆ PUSZKĘ [E]! Bot pije: ${Math.round(this.botBeer * 100)}%`;
        break;
      case 'game_over':
        prompt = this.playerBeer <= 0 ? '🏆 WYGRANA!' : 'PRZEGRANA!';
        break;
    }

    return {
      active: this.phase !== 'idle',
      phase: this.phase,
      playerBeer: Math.max(0, this.playerBeer),
      botBeer: Math.max(0, this.botBeer),
      throwPower: this.throwPower,
      isCharging: this.isCharging,
      promptText: prompt,
    };
  }

  dispose(): void {
    this.stopMatch();
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.root.clear();
  }
}
