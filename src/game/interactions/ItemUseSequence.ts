import * as THREE from 'three';
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

export type UseSequenceEvent = { activateEffect: boolean; complete: boolean };
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
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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
  private root?: THREE.Group;
  private visual?: THREE.Object3D;
  private prop?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private snapshot?: CameraSnapshot;
  private targetPosition = new THREE.Vector3();
  private targetQuaternion = new THREE.Quaternion();
  private currentEffect?: EffectId;

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

  /** Buduje postać, animację i bezpieczny kadr dla nowej sekwencji. */
  start(effect: EffectId, yaw: number) {
    if (this.active) return false;
    const config = itemUseSequenceConfig[effect];
    this.currentEffect = effect;
    this.elapsed = 0;
    this.markerPassed = false;
    this.snapshot = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      fov: this.camera.fov,
    };
    this.root = new THREE.Group();
    this.root.name = 'PlayerUseSequence';
    const animatedCharacter = canAnimateUseSequence(this.character) ? this.character : undefined;
    this.visual = this.character ? cloneDisposableSkinnedModel(this.character.scene) : fallbackCharacter();
    this.root.add(this.visual);

    if (this.character) {
      this.mixer = new THREE.AnimationMixer(this.visual);
      const idle = this.character.animations.find(
        (clip) => resolveCanonicalAnimationName(clip.name) === 'Idle',
      );
      if (idle) {
        const basePose = this.mixer.clipAction(stabilizeLocomotionRoot(this.visual, idle));
        basePose.play();
        // Keep the reference pose steady while the authored gesture makes contact with the face.
        basePose.paused = true;
      }
      this.mixer.update(0);
    }
    fitCharacter(this.visual);
    // Bake before attaching a prop so bounds and reach depend only on the character.
    const clip = animatedCharacter ? createProceduralUseClip(this.visual, effect) : undefined;
    this.prop = attachUseProp(
      this.visual,
      config.propId ? this.propModels.get(config.propId) : undefined,
      effect,
    );

    if (clip && this.mixer) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }

    const groundY = this.snapshot.position.y - 1.9;
    this.root.position.set(this.snapshot.position.x, groundY, this.snapshot.position.z);
    this.root.rotation.y = yaw + Math.PI;
    this.root.visible = false;
    this.scene.add(this.root);

    this.targetPosition.copy(chooseUseSequenceCamera(this.snapshot.position, yaw, this.canMove));
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
    const complete = this.elapsed >= config.duration;
    if (complete) this.finish();
    return { activateEffect, complete };
  }

  /** Przerywa sekwencję i zawsze przywraca dokładny poprzedni kadr. */
  cancel() {
    if (!this.active) return false;
    this.finish();
    return true;
  }

  /** Zatrzymuje mikser, usuwa klony i odtwarza parametry kamery FPS. */
  private finish() {
    if (this.snapshot) {
      this.camera.position.copy(this.snapshot.position);
      this.camera.quaternion.copy(this.snapshot.quaternion);
      this.camera.fov = this.snapshot.fov;
      this.camera.updateProjectionMatrix();
    }
    this.mixer?.stopAllAction();
    if (this.visual) this.mixer?.uncacheRoot(this.visual);
    if (this.root) {
      this.scene.remove(this.root);
      disposeObjectTree(this.root);
    }
    this.elapsed = 0;
    this.markerPassed = false;
    this.root = undefined;
    this.visual = undefined;
    this.prop = undefined;
    this.mixer = undefined;
    this.snapshot = undefined;
    this.currentEffect = undefined;
  }

  /** Zwalnia aktywną sekwencję podczas zamykania całej gry. */
  dispose() {
    this.finish();
  }
}
