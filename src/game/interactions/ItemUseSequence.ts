import * as THREE from 'three';
import { terrainHeight } from '../world/terrainHeight';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveCanonicalAnimationName } from '../animation/animationContract';
import { findRigBone } from '../animation/rigBones';
import { stabilizeLocomotionRoot } from '../npc/NpcAnimator';
import { cloneDisposableSkinnedModel, disposeObjectTree } from '../lifecycle/disposeThree';
import type { EffectId } from '../effects/EffectManager';
import { itemUseSequenceConfig } from './itemUseSequenceConfig';
import { createProceduralUseClip } from './itemUseMotion';
import { attachUseProp } from './itemUseProp';

export { createProceduralUseClip } from './itemUseMotion';

const INTRO_DURATION = 0.42;
const OUTRO_DURATION = 0.38;
const PLAYER_HEIGHT = 2.45;
const RIGHT_ARM = 'mixamorig:RightArm';
const RIGHT_FOREARM = 'mixamorig:RightForeArm';
const RIGHT_HAND = 'mixamorig:RightHand';

export type UseSequenceEvent = { activateEffect: boolean; complete: boolean; sfx?: string };
export type CameraPathValidator = (x: number, z: number) => boolean;

type CameraSnapshot = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
};

/** Zwraca gładką krzywą przejścia bez skoku prędkości na początku i końcu. */
function smoothStep(value: number) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/** Sprawdza w kilku punktach, czy droga kamery nie przecina collidera świata. */
function pathIsClear(start: THREE.Vector3, end: THREE.Vector3, canMove: CameraPathValidator) {
  const distance = start.distanceTo(end);
  const steps = Math.max(2, Math.ceil(distance / 0.35));
  for (let step = 1; step <= steps; step++) {
    const alpha = step / steps;
    const x = THREE.MathUtils.lerp(start.x, end.x, alpha);
    const z = THREE.MathUtils.lerp(start.z, end.z, alpha);
    if (!canMove(x, z)) return false;
  }
  return true;
}

/**
 * Szuka wolnego ujęcia przed postacią, następnie po bokach. Jeśli gracz stoi
 * bardzo ciasno, używa krótszego i wyższego kadru awaryjnego.
 */
export function chooseUseSequenceCamera(
  playerPosition: THREE.Vector3,
  yaw: number,
  canMove: CameraPathValidator,
) {
  const groundY = playerPosition.y - 1.9;
  const pathStart = new THREE.Vector3(playerPosition.x, groundY, playerPosition.z);
  for (const distance of [3.6, 3.05, 2.55]) {
    for (const angleOffset of [0, -0.72, 0.72, Math.PI]) {
      const angle = yaw + angleOffset;
      const candidate = new THREE.Vector3(
        playerPosition.x - Math.sin(angle) * distance,
        groundY + 1.65,
        playerPosition.z - Math.cos(angle) * distance,
      );
      if (pathIsClear(pathStart, candidate, canMove)) return candidate;
    }
  }
  return new THREE.Vector3(playerPosition.x, groundY + 3.35, playerPosition.z + 1.8);
}

/** Ustawia cienie i normalizuje wysokość postaci po zastosowaniu pierwszej klatki Idle. */
function fitCharacter(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinned = mesh as THREE.SkinnedMesh;
        skinned.skeleton.update();
        skinned.computeBoundingBox();
      }
    }
  });
  const bounds = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(PLAYER_HEIGHT / Math.max(0.01, bounds.max.y - bounds.min.y));
  bounds.setFromObject(model);
  model.position.y = -bounds.min.y;
}

/** Tworzy prostą widoczną postać awaryjną, gdy wybrany GLB nie został załadowany. */
function fallbackCharacter() {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xff5d76, roughness: 0.75 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.15, 5, 12), material);
  body.position.y = 1.15;
  root.add(body);
  const hand = new THREE.Object3D();
  hand.name = RIGHT_HAND;
  hand.position.set(-0.42, 1.45, -0.08);
  root.add(hand);
  return root;
}

/** Wymaga klipu Idle i pełnego łańcucha prawej ręki, aby nigdy nie pokazać T-pose. */
export function canAnimateUseSequence(character: GLTF | undefined) {
  if (!character) return false;
  const hasIdle = character.animations.some((clip) => resolveCanonicalAnimationName(clip.name) === 'Idle');
  return (
    hasIdle &&
    Boolean(findRigBone(character.scene, RIGHT_ARM)) &&
    Boolean(findRigBone(character.scene, RIGHT_FOREARM)) &&
    Boolean(findRigBone(character.scene, RIGHT_HAND)) &&
    Boolean(findRigBone(character.scene, 'mixamorig:Head'))
  );
}

/**
 * Zarządza jedną transakcyjną sekwencją użycia: modelem postaci, kamerą,
 * animacją, rekwizytem i deterministycznym sprzątaniem po zakończeniu.
 */
export class ItemUseSequence {
  private elapsed = 0;
  private markerPassed = false;
  private sfxPlayed = false;
  private root?: THREE.Group;
  private visual?: THREE.Object3D;
  private prop?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private snapshot?: CameraSnapshot;
  private targetPosition = new THREE.Vector3();
  private targetQuaternion = new THREE.Quaternion();
  private currentEffect?: EffectId;

  private pooledRoot?: THREE.Group;
  private pooledVisual?: THREE.Object3D;
  private pooledMixer?: THREE.AnimationMixer;
  private basePoseAction?: THREE.AnimationAction;
  private currentClipAction?: THREE.AnimationAction;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private character: GLTF | undefined,
    private propModels: Map<string, THREE.Object3D>,
    private canMove: CameraPathValidator,
  ) {}

  /** Zwraca informację, czy wejście gracza powinno pozostać zablokowane. */
  get active() {
    return this.currentEffect !== undefined;
  }

  /** Zapewnia pojedynczą prealokowaną instancję aktora sekwencji bez klonowania w każdej sekwencji. */
  private ensureActor() {
    if (!this.pooledRoot || !this.pooledVisual) {
      this.pooledRoot = new THREE.Group();
      this.pooledRoot.name = 'PlayerUseSequence';
      this.pooledVisual = this.character
        ? cloneDisposableSkinnedModel(this.character.scene)
        : fallbackCharacter();
      this.pooledRoot.add(this.pooledVisual);

      if (this.character) {
        this.pooledMixer = new THREE.AnimationMixer(this.pooledVisual);
        const idle = this.character.animations.find(
          (clip) => resolveCanonicalAnimationName(clip.name) === 'Idle',
        );
        if (idle) {
          this.basePoseAction = this.pooledMixer.clipAction(stabilizeLocomotionRoot(this.pooledVisual, idle));
          this.basePoseAction.play();
          this.basePoseAction.paused = true;
        }
        this.pooledMixer.update(0);
      }
      fitCharacter(this.pooledVisual);
    }
    return { root: this.pooledRoot, visual: this.pooledVisual, mixer: this.pooledMixer };
  }

  /** Buduje postać, animację i bezpieczny kadr dla nowej sekwencji. */
  start(effect: EffectId, yaw: number) {
    if (this.active) return false;
    const config = itemUseSequenceConfig[effect];
    this.currentEffect = effect;
    this.elapsed = 0;
    this.markerPassed = false;
    this.sfxPlayed = false;
    this.snapshot = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      fov: this.camera.fov,
    };

    const actor = this.ensureActor();
    this.root = actor.root;
    this.visual = actor.visual;
    this.mixer = actor.mixer;

    if (this.basePoseAction && this.mixer) {
      this.basePoseAction.reset();
      this.basePoseAction.play();
      this.basePoseAction.paused = true;
      this.mixer.update(0);
    }

    const animatedCharacter = canAnimateUseSequence(this.character) ? this.character : undefined;
    const clip = animatedCharacter ? createProceduralUseClip(this.visual, effect) : undefined;
    this.prop = attachUseProp(
      this.visual,
      config.propId ? this.propModels.get(config.propId) : undefined,
      effect,
    );

    if (clip && this.mixer) {
      this.currentClipAction = this.mixer.clipAction(clip);
      this.currentClipAction.reset();
      this.currentClipAction.setLoop(THREE.LoopOnce, 1);
      this.currentClipAction.clampWhenFinished = true;
      this.currentClipAction.play();
    }

    const groundY = terrainHeight(this.snapshot.position.x, this.snapshot.position.z);
    this.root.position.set(this.snapshot.position.x, groundY, this.snapshot.position.z);
    this.root.visible = false;
    this.scene.add(this.root);

    this.targetPosition.copy(chooseUseSequenceCamera(this.snapshot.position, yaw, this.canMove));
    this.targetPosition.y += groundY - (this.snapshot.position.y - 1.9);
    this.root.rotation.y = Math.atan2(
      this.targetPosition.x - this.root.position.x,
      this.targetPosition.z - this.root.position.z,
    );
    const target = new THREE.Vector3(this.root.position.x, groundY + 1.18, this.root.position.z);
    const lookMatrix = new THREE.Matrix4().lookAt(this.targetPosition, target, this.camera.up);
    this.targetQuaternion.setFromRotationMatrix(lookMatrix);
    return true;
  }

  /** Aktualizuje kamerę i zwraca jednorazowe zdarzenia markera oraz zakończenia. */
  update(deltaSeconds: number): UseSequenceEvent {
    if (!this.currentEffect || !this.snapshot) return { activateEffect: false, complete: false };
    const config = itemUseSequenceConfig[this.currentEffect];
    const step = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const elapsed = Math.min(config.duration, this.elapsed + step);
    this.mixer?.update(elapsed - this.elapsed);
    this.elapsed = elapsed;
    if (this.prop) {
      const hideAt = config.consumeProp ? config.effectMarker + 0.14 : config.duration - 0.24;
      this.prop.visible = this.elapsed >= 0.18 && this.elapsed <= hideAt;
    }

    const blend =
      this.elapsed < INTRO_DURATION
        ? smoothStep(this.elapsed / INTRO_DURATION)
        : this.elapsed > config.duration - OUTRO_DURATION
          ? smoothStep((config.duration - this.elapsed) / OUTRO_DURATION)
          : 1;
    if (this.root) this.root.visible = blend > 0.08;
    this.camera.position.lerpVectors(this.snapshot.position, this.targetPosition, blend);
    this.camera.quaternion.slerpQuaternions(this.snapshot.quaternion, this.targetQuaternion, blend);
    this.camera.fov = THREE.MathUtils.lerp(this.snapshot.fov, 58, blend);
    this.camera.updateProjectionMatrix();

    const activateEffect = !this.markerPassed && this.elapsed >= config.effectMarker;
    if (activateEffect) this.markerPassed = true;

    const sfxDelay = config.sfx?.delay ?? 0.2;
    const triggerSfx = !this.sfxPlayed && config.sfx !== undefined && this.elapsed >= sfxDelay;
    let sfx: string | undefined;
    if (triggerSfx) {
      this.sfxPlayed = true;
      sfx = config.sfx?.sound;
    }

    const complete = this.elapsed >= config.duration;
    if (complete) this.finish();
    return { activateEffect, complete, sfx };
  }

  /** Przerywa sekwencję i zawsze przywraca dokładny poprzedni kadr. */
  cancel() {
    if (!this.active) return false;
    this.finish();
    return true;
  }

  /** Zatrzymuje mikser, odłącza rekwizyt i odtwarza parametry kamery FPS. */
  private finish() {
    if (this.snapshot) {
      this.camera.position.copy(this.snapshot.position);
      this.camera.quaternion.copy(this.snapshot.quaternion);
      this.camera.fov = this.snapshot.fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.currentClipAction) {
      this.currentClipAction.stop();
      this.currentClipAction = undefined;
    }
    this.mixer?.stopAllAction();
    if (this.basePoseAction && this.mixer) {
      this.basePoseAction.reset();
      this.basePoseAction.play();
      this.basePoseAction.paused = true;
      this.mixer.update(0);
    }
    if (this.prop) {
      this.prop.removeFromParent();
      disposeObjectTree(this.prop);
      this.prop = undefined;
    }
    if (this.root) {
      this.scene.remove(this.root);
    }
    this.elapsed = 0;
    this.markerPassed = false;
    this.sfxPlayed = false;
    this.root = undefined;
    this.visual = undefined;
    this.prop = undefined;
    this.mixer = undefined;
    this.snapshot = undefined;
    this.currentEffect = undefined;
  }

  /** Zwalnia aktywną sekwencję oraz prealokowane zasoby modelu podczas zamykania gry. */
  dispose() {
    this.finish();
    if (this.pooledRoot) {
      this.scene.remove(this.pooledRoot);
      this.pooledMixer?.stopAllAction();
      if (this.pooledVisual && this.pooledMixer) this.pooledMixer.uncacheRoot(this.pooledVisual);
      disposeObjectTree(this.pooledRoot);
      this.pooledRoot = undefined;
      this.pooledVisual = undefined;
      this.pooledMixer = undefined;
      this.basePoseAction = undefined;
    }
  }
}
