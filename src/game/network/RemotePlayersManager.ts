import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  type CharacterName,
  type LocomotionState,
  type PlayerSnapshot,
  type WorldSnapshotPayload,
} from './networkProtocol';
import { NetworkClient } from './NetworkClient';
import { NpcAnimator } from '../npc/NpcAnimator';
import { PlayerNametag } from '../ui/PlayerNametag';
import { characterAssets } from '../assets/assetManifest';
import { terrainHeight } from '../world/CampWorld';

export interface RemotePlayerEntity {
  playerId: string;
  characterName: CharacterName;
  nickname: string;
  root: THREE.Group;
  visual?: THREE.Object3D;
  animator?: NpcAnimator;
  nametag: PlayerNametag;
  currentPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  currentYaw: number;
  targetYaw: number;
  locomotion: LocomotionState;
  speed: number;
  lastUpdateTime: number;
}

export class RemotePlayersManager {
  readonly remotePlayers = new Map<string, RemotePlayerEntity>();
  private unsubscribeSnapshot?: () => void;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly characterModels: Map<string, GLTF>,
    private readonly networkClient?: NetworkClient,
  ) {
    if (this.networkClient) {
      this.unsubscribeSnapshot = this.networkClient.onWorldSnapshot((snapshot) => {
        this.handleWorldSnapshot(snapshot);
      });
    }
  }

  /** Normalizuje wysokość modelu gracza (2.45m) i włącza rzucanie/odbieranie cieni. */
  private fit(object: THREE.Object3D, height = 2.45) {
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    const currentHeight = Math.max(0.01, box.max.y - box.min.y);
    object.scale.setScalar(height / currentHeight);
    box.setFromObject(object);
    object.position.y = -box.min.y;
  }

  /** Zwraca identyfikator zasobu GLTF dla podanej nazwy kanonicznej postaci. */
  private resolveAssetId(characterName: CharacterName): string {
    const asset = characterAssets.find((item) => item.name === characterName);
    return asset?.id ?? characterName.toLowerCase();
  }

  /** Tworzy nową encję zdalnego gracza w scenie Three.js wraz z modelem, animatorem i nametagiem. */
  private spawnRemotePlayer(player: PlayerSnapshot): RemotePlayerEntity {
    const root = new THREE.Group();
    root.name = `RemotePlayer_${player.playerId}_${player.character}`;

    const [px, py, pz] = player.transform.position;
    const initialGroundY = terrainHeight(px, pz);
    root.position.set(px, initialGroundY, pz);
    root.rotation.set(0, player.transform.yaw, 0, 'YXZ');
    root.rotation.set(0, player.transform.yaw + Math.PI, 0, 'YXZ');

    const assetId = this.resolveAssetId(player.character);
    const gltf = this.characterModels.get(assetId);

    let visual: THREE.Object3D | undefined;
    let animator: NpcAnimator | undefined;

    if (gltf) {
      visual = clone(gltf.scene);
      animator = new NpcAnimator(visual, gltf.animations);
      animator.update(0);
      this.fit(visual, 2.45);
      root.add(visual);
    } else {
      // Fallbackowa bryła kapsuły, jeśli model nie jest jeszcze dostępny:
      const fallback = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.34, 0.75, 4, 10),
        new THREE.MeshStandardMaterial({ color: 0x4fc3f7 }),
      );
      fallback.position.y = 1;
      visual = fallback;
      root.add(fallback);
    }

    this.scene.add(root);

    const nametag = new PlayerNametag({
      nickname: player.nickname,
      characterName: player.character,
    });

    const entity: RemotePlayerEntity = {
      playerId: player.playerId,
      characterName: player.character,
      nickname: player.nickname,
      root,
      visual,
      animator,
      nametag,
      currentPosition: new THREE.Vector3(px, initialGroundY, pz),
      targetPosition: new THREE.Vector3(px, py, pz),
      currentYaw: player.transform.yaw,
      targetYaw: player.transform.yaw,
      locomotion: player.transform.locomotion,
      speed: player.transform.speed,
      lastUpdateTime: player.transform.timestamp,
    };

    if (animator) {
      animator.play(player.transform.locomotion);
      animator.setMovementSpeed(player.transform.speed);
    }

    this.remotePlayers.set(player.playerId, entity);
    return entity;
  }

  /** Usuwa encję zdalnego gracza ze sceny i zwalnia zasoby. */
  private removeRemotePlayer(playerId: string): void {
    const entity = this.remotePlayers.get(playerId);
    if (!entity) return;

    this.scene.remove(entity.root);
    entity.animator?.dispose();
    entity.nametag.dispose();
    this.remotePlayers.delete(playerId);
  }

  /** Przetwarza snapshot świata z serwera: dodaje, aktualizuje lub usuwa innych graczy. */
  handleWorldSnapshot(snapshot: WorldSnapshotPayload): void {
    const myId = this.networkClient?.getMyPlayerId();
    const activePlayerIds = new Set<string>();

    for (const player of snapshot.players) {
      // Pomijamy własnego gracza (sterowanego lokalnie):
      if (myId && player.playerId === myId) {
        continue;
      }

      activePlayerIds.add(player.playerId);
      const existing = this.remotePlayers.get(player.playerId);

      if (!existing) {
        this.spawnRemotePlayer(player);
      } else {
        // Jeśli gracz zmienił postać:
        if (existing.characterName !== player.character) {
          this.removeRemotePlayer(player.playerId);
          this.spawnRemotePlayer(player);
          continue;
        }

        // Aktualizacja pseudonimu:
        if (existing.nickname !== player.nickname) {
          existing.nickname = player.nickname;
          existing.nametag.setNickname(player.nickname);
        }

        // Aktualizacja celów interpolacji:
        const [tx, ty, tz] = player.transform.position;
        existing.targetPosition.set(tx, ty, tz);
        existing.targetYaw = player.transform.yaw;
        existing.locomotion = player.transform.locomotion;
        existing.speed = player.transform.speed;
        existing.lastUpdateTime = player.transform.timestamp;
      }
    }

    // Usunięcie graczy, którzy opuścili pokój:
    for (const playerId of Array.from(this.remotePlayers.keys())) {
      if (!activePlayerIds.has(playerId)) {
        this.removeRemotePlayer(playerId);
      }
    }
  }

  /** Aktualizuje pozycje, obrót, animacje i nametagi wszystkich zdalnych graczy. */
  update(deltaTime: number, camera: THREE.Camera): void {
    const dt = Math.max(0, deltaTime);

    for (const entity of this.remotePlayers.values()) {
      // 1. Interpolacja pozycji (lerp z zabezpieczeniem przed teleportami):
      const distanceToTarget = entity.currentPosition.distanceTo(entity.targetPosition);
      if (distanceToTarget > 12.0) {
        // Natychmiastowy przeskok przy dużej odległości (np. respawn):
        entity.currentPosition.copy(entity.targetPosition);
      } else {
        const posFactor = 1 - Math.exp(-16 * dt);
        entity.currentPosition.lerp(entity.targetPosition, posFactor);
      }

      // Dopasowanie do wysokości terenu na pozycji (x, z):
      const groundY = terrainHeight(entity.currentPosition.x, entity.currentPosition.z);
      entity.root.position.set(entity.currentPosition.x, groundY, entity.currentPosition.z);

      // 2. Interpolacja kąta yaw (najkrótszą drogą):
      let diff = (entity.targetYaw - entity.currentYaw) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;

      const yawFactor = 1 - Math.exp(-18 * dt);
      entity.currentYaw += diff * yawFactor;
      entity.root.rotation.set(0, entity.currentYaw, 0, 'YXZ');
      entity.root.rotation.set(0, entity.currentYaw + Math.PI, 0, 'YXZ');

      // 3. Aktualizacja animacji:
      if (entity.animator) {
        entity.animator.setMovementSpeed(entity.speed);
        entity.animator.play(entity.locomotion);
        entity.animator.update(dt);
      }

      // 4. Aktualizacja pozycji nametaga na ekranie:
      entity.nametag.update(entity.root.position, camera);
    }
  }

  /** Zwalnia wszystkie modele zdalnych graczy, nametagi i odłącza subskrypcję snapshotów. */
  dispose(): void {
    this.unsubscribeSnapshot?.();
    this.unsubscribeSnapshot = undefined;

    for (const playerId of Array.from(this.remotePlayers.keys())) {
      this.removeRemotePlayer(playerId);
    }
  }
}
