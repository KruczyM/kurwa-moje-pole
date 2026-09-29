import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { resolveCanonicalAnimationName } from '../animation/animationContract';
import { cloneDisposableSkinnedModel, disposeObjectTree } from '../lifecycle/disposeThree';
import { NpcAnimator, type NpcActivityStep } from '../npc/NpcAnimator';

export type SeatPose = {
  seatId: string;
  position: [number, number, number];
  rotationY: number;
};

type CameraSnapshot = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
};

/** Znajduje kanoniczną animację siedzenia niezależnie od wielkości liter nazwy źródłowej. */
export function findSittingClip(clips: THREE.AnimationClip[]) {
  return (
    clips.find((clip) => clip.name === 'SittingIdle') ??
    clips.find((clip) => resolveCanonicalAnimationName(clip.name) === 'SittingLaughing')
  );
}

/** Wyznacza czytelny kadr przed siedzącą postacią, aby patrzyła w stronę kamery. */
export function seatCameraPosition(position: THREE.Vector3, rotationY: number) {
  const forward = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  const side = new THREE.Vector3(forward.z, 0, -forward.x);
  return position
    .clone()
    .addScaledVector(forward, 3.1)
    .addScaledVector(side, 0.65)
    .add(new THREE.Vector3(0, 1.85, 0));
}

/** Pokazuje wybraną postać na krześle i odtwarza zapętloną animację siedzenia. */
export class SeatController {
  private root?: THREE.Group;
  private visual?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private animator?: NpcAnimator;
  private exitRequested = false;
  private restSequence = false;
  private snapshot?: CameraSnapshot;
  private seatId?: string;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private character: GLTF | undefined,
  ) {}

  get active() {
    return this.seatId !== undefined;
  }

  get animationNames() {
    return this.character?.animations.map((clip) => clip.name).sort() ?? [];
  }
  get finished() {
    return this.active && this.exitRequested && !this.animator?.activityActive;
  }

  requestStop() {
    if (!this.active) return false;
    this.exitRequested = true;
    if (this.restSequence) this.animator?.endActivityHold();
    else this.animator?.cancelActivity();
    return true;
  }

  /** Ustawia postać przy krześle, uruchamia SittingLaughing i przełącza kamerę na trzecią osobę. */
  start(pose: SeatPose, animationName?: string) {
    if (this.active || !this.character) return false;
    const clip = animationName
      ? this.character.animations.find((candidate) => candidate.name === animationName)
      : findSittingClip(this.character.animations);
    if (!clip) return false;
    this.snapshot = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      fov: this.camera.fov,
    };
    this.seatId = pose.seatId;
    this.root = new THREE.Group();
    this.root.name = `SeatedPlayer_${pose.seatId}`;
    this.root.position.set(...pose.position);
    this.root.rotation.y = pose.rotationY;
    this.visual = cloneDisposableSkinnedModel(this.character.scene);
    this.root.add(this.visual);
    this.animator = new NpcAnimator(this.visual, this.character.animations);
    this.mixer = this.animator.mixer;
    this.animator.update(0);
    this.fitCharacter(this.visual);
    const loop =
      !animationName ||
      /Idle|Pose|Dancing|Headbanging|Walking|DrunkWalk|Talking|TextingWhileStanding|Cheering|Clapping/.test(
        clip.name,
      );
    const steps: NpcActivityStep[] = [{ name: clip.name, ...(loop ? { seconds: 3600 } : {}) }];
    if (
      /^(LayingIdle|LayingIdleFootCrossed|SleepingIdle)$/.test(clip.name) &&
      this.animator.hasClip('LieDown') &&
      this.animator.hasClip('StandUpFromLaying')
    ) {
      steps.unshift({ name: 'LieDown' });
      steps.push({ name: 'StandUpFromLaying' });
    } else if (
      /^Sitting(Idle|Talking|Drinking|Laughing)$/.test(clip.name) &&
      this.animator.hasClip('Sitting') &&
      this.animator.hasClip('SittingToStanding')
    ) {
      steps.unshift({ name: 'Sitting' });
      steps.push({ name: 'SittingToStanding' });
    }
    this.restSequence = steps.length > 1;
    this.animator.startActivity(steps);
    this.exitRequested = !loop;
    this.scene.add(this.root);

    const target = this.root.position.clone().add(new THREE.Vector3(0, 1.15, 0));
    this.camera.position.copy(seatCameraPosition(this.root.position, pose.rotationY));
    this.camera.lookAt(target);
    this.camera.fov = 54;
    this.camera.updateProjectionMatrix();
    return true;
  }

  /** Aktualizuje zapętloną animację siedzącej postaci. */
  update(deltaSeconds: number) {
    this.animator?.update(deltaSeconds);
  }

  /** Przywraca kamerę FPS i usuwa tymczasowy klon postaci. */
  stop() {
    if (!this.active) return false;
    if (this.snapshot) {
      this.camera.position.copy(this.snapshot.position);
      this.camera.quaternion.copy(this.snapshot.quaternion);
      this.camera.fov = this.snapshot.fov;
      this.camera.updateProjectionMatrix();
    }
    this.mixer?.stopAllAction();
    this.animator?.dispose();
    if (this.visual) this.mixer?.uncacheRoot(this.visual);
    if (this.root) {
      this.scene.remove(this.root);
      disposeObjectTree(this.root);
    }
    this.root = undefined;
    this.visual = undefined;
    this.mixer = undefined;
    this.animator = undefined;
    this.exitRequested = false;
    this.restSequence = false;
    this.snapshot = undefined;
    this.seatId = undefined;
    return true;
  }

  /** Skaluje postać do wspólnej wysokości i opiera ją o poziom krzesła. */
  private fitCharacter(model: THREE.Object3D) {
    const bounds = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(2.45 / Math.max(0.01, bounds.max.y - bounds.min.y));
    bounds.setFromObject(model);
    model.position.y = -bounds.min.y;
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }

  /** Kończy ewentualne siedzenie podczas wyłączania gry. */
  dispose() {
    this.stop();
  }
}
