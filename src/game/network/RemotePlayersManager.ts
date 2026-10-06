import * as THREE from 'three';
import { CharacterVisibility } from '../rendering/CharacterVisibility';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFlankiActor } from '../interactions/FlankiActors';
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
import type { SpatialVoiceManager } from '../audio/SpatialVoiceManager';

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
  isSpeaking?: boolean;
  groundFeet?: () => void;
  disposeVisual?: () => void;
}

export class RemotePlayersManager {
  readonly visibility = new CharacterVisibility();
  readonly remotePlayers = new Map<string, RemotePlayerEntity>();
  private unsubscribeSnapshot?: () => void;
  private unsubscribeSpeaking?: () => void;
  private unsubscribeAction?: () => void;
  private unsubscribeStatus?: () => void;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly characterModels: Map<string, GLTF>,
    private readonly networkClient?: NetworkClient,
    private spatialVoice?: SpatialVoiceManager,
  ) {
    if (this.networkClient) {
      this.unsubscribeStatus = this.networkClient.onStatusChange((status) => {
        if (status === 'disconnected' || status === 'error')
          for (const id of [...this.remotePlayers.keys()]) this.removeRemotePlayer(id);
      });
      this.unsubscribeSnapshot = this.networkClient.onWorldSnapshot((snapshot) => {
        this.handleWorldSnapshot(snapshot);
      });
      this.unsubscribeAction = this.networkClient.onActionTrigger((payload) => {
        this.handleRemoteAction(payload);
      });
    }

    if (this.spatialVoice) {
      this.bindSpatialVoice(this.spatialVoice);
    }
  }

  setSpatialVoice(spatialVoice?: SpatialVoiceManager): void {
    this.unsubscribeSpeaking?.();
    this.unsubscribeSpeaking = undefined;
    this.spatialVoice = spatialVoice;
    if (spatialVoice) {
      this.bindSpatialVoice(spatialVoice);
    }
  }

  private bindSpatialVoice(voice: SpatialVoiceManager): void {
    this.unsubscribeSpeaking = voice.onSpeakingPeersChange((speakingPeers) => {
      for (const [id, entity] of this.remotePlayers) {
        entity.nametag.setSpeaking(speakingPeers.has(id));
      }
    });
  }

  setPlayerSpeaking(playerId: string, isSpeaking: boolean): void {
    const entity = this.remotePlayers.get(playerId);
    if (entity) {
      entity.nametag.setSpeaking(isSpeaking);
    }
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

    const assetId = this.resolveAssetId(player.character);
    const gltf = this.characterModels.get(assetId);

    let visual: THREE.Object3D | undefined;
    let animator: NpcAnimator | undefined;
    let groundFeet: (() => void) | undefined;
    let disposeVisual: (() => void) | undefined;

    if (gltf) {
      const actor = createFlankiActor(assetId, this.characterModels);
      visual = actor.root;
      // Camera yaw looks down -Z; the imported festival characters face +Z.
      visual.rotation.y = Math.PI;
      animator = actor.animator;
      groundFeet = actor.groundFeet;
      disposeVisual = actor.dispose;
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
    if (this.spatialVoice) {
      nametag.setSpeaking(this.spatialVoice.isPeerSpeaking(player.playerId));
    }

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
      groundFeet,
      disposeVisual,
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
    if (entity.disposeVisual) entity.disposeVisual();
    else entity.animator?.dispose();
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
      const jumpSeconds = Number(entity.root.userData.jumpSeconds ?? 0);
      entity.root.userData.jumpSeconds = Math.max(0, jumpSeconds - dt);
      entity.root.position.set(
        entity.currentPosition.x,
        jumpSeconds > 0 ? Math.max(groundY, entity.currentPosition.y) : groundY,
        entity.currentPosition.z,
      );

      // 2. Interpolacja kąta yaw (najkrótszą drogą):
      let diff = (entity.targetYaw - entity.currentYaw) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;

      const yawFactor = 1 - Math.exp(-18 * dt);
      entity.currentYaw += diff * yawFactor;
      entity.root.rotation.set(0, entity.currentYaw, 0, 'YXZ');

      // 3. Aktualizacja animacji:
      const animate = this.visibility.update(entity.root, camera.position);
      if (entity.animator && animate) {
        entity.animator.setMovementSpeed(entity.speed);
        entity.animator.play(entity.locomotion);
        entity.animator.update(dt);
      }
      if (animate) entity.groundFeet?.();

      // 4. Aktualizacja pozycji nametaga na ekranie oraz wskaźnika mówienia:
      if (this.spatialVoice) {
        const speaking = this.spatialVoice.isPeerSpeaking(entity.playerId);
        entity.isSpeaking = speaking;
        entity.nametag.setSpeaking(speaking);
      }
      entity.nametag.update(entity.root.position, camera);
    }
  }

  /** Obsługuje jednorazowe akcje animacyjne graczy (picie, palenie, taniec, siadanie, gesty). */
  handleRemoteAction(payload: {
    playerId: string;
    character: CharacterName;
    action: string;
    timestamp: number;
  }): void {
    const entity = this.remotePlayers.get(payload.playerId);
    if (!entity || !entity.animator) return;
    if (payload.action.toLowerCase() === 'jump') entity.root.userData.jumpSeconds = 1.2;
    const actionClipMap: Record<string, import('../animation/animationContract').CanonicalAnimationClip[]> = {
      jump: ['Jump'],
      drink: ['Drinking'],
      drinking: ['Drinking'],
      smoke: ['RelievedSigh', 'HappyHandGesture'],
      smoking: ['RelievedSigh', 'HappyHandGesture'],
      dance: ['HipHopDancing', 'SillyDancing'],
      dancing: ['HipHopDancing', 'SillyDancing'],
      sit: ['SittingIdle', 'Sitting'],
      cheer: ['Cheering', 'HappyHandGesture'],
      clap: ['Clapping'],
      wave: ['Waving'],
    };
    const candidates = actionClipMap[payload.action.toLowerCase()] ?? [
      payload.action as import('../animation/animationContract').CanonicalAnimationClip,
    ];
    for (const clip of candidates) {
      if (entity.animator.hasClip(clip)) {
        entity.animator.queueOneShot(clip);
        break;
      }
    }
  }

  /** Zwraca listę pozycji, obrotu i stanów mówienia zdalnych graczy dla HUD mapy. */
  getPlayerMarkers(): {
    id: string;
    name: string;
    x: number;
    z: number;
    yaw?: number;
    isSpeaking?: boolean;
  }[] {
    const markers: {
      id: string;
      name: string;
      x: number;
      z: number;
      yaw?: number;
      isSpeaking?: boolean;
    }[] = [];
    for (const [id, entity] of this.remotePlayers.entries()) {
      markers.push({
        id,
        name: entity.nickname?.trim() || entity.characterName,
        x: entity.currentPosition.x,
        z: entity.currentPosition.z,
        yaw: entity.currentYaw,
        isSpeaking: entity.isSpeaking,
      });
    }
    return markers;
  }

  /** Zwalnia wszystkie modele zdalnych graczy, nametagi i odłącza subskrypcję snapshotów. */
  dispose(): void {
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = undefined;
    this.unsubscribeSnapshot?.();
    this.unsubscribeSnapshot = undefined;
    this.unsubscribeAction?.();
    this.unsubscribeAction = undefined;
    this.unsubscribeSpeaking?.();
    this.unsubscribeSpeaking = undefined;

    for (const playerId of Array.from(this.remotePlayers.keys())) {
      this.removeRemotePlayer(playerId);
    }
  }
}
