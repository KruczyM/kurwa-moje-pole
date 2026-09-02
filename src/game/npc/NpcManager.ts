import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { characterAssets } from '../assets/assetManifest';
import { npcLines } from './npcConfig';
import { NpcAnimator } from './NpcAnimator';
import { enableInteractionLayer } from '../interactions/InteractionManager';
export type Npc = {
  root: THREE.Group;
  name: string;
  line: string[];
  animator?: NpcAnimator;
  phase: number;
  target: THREE.Vector3;
  wait: number;
  returning: boolean;
  stationary: boolean;
};
const spawns = [
    [-2, -1],
    [1, -1],
    [2.4, 1],
    [-2.6, 1.2],
    [0, 1.3],
    [4.8, 2.7],
    [7, -4],
    [-8, 5],
  ],
  FIELD_EDGE = 53,
  CAMP_RADIUS = 13;

/** Dodaje stabilną strefę interakcji niezależną od aktualnej pozy animowanej siatki. */
function addNpcInteractionHitbox(root: THREE.Group) {
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 2.5, 0.8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  hitbox.name = 'NpcInteractionHitbox';
  hitbox.position.y = 1.25;
  root.add(hitbox);
}

export class NpcManager {
  readonly npcs: Npc[] = [];
  private candidate = new THREE.Vector3();
  constructor(
    scene: THREE.Scene,
    models: Map<string, GLTF>,
    speaker: GLTF | null,
    private canMove: (x: number, z: number) => boolean,
  ) {
    characterAssets.forEach((asset, index) => {
      const root = new THREE.Group(),
        model = models.get(asset.id);
      let animator: NpcAnimator | undefined;
      if (model) {
        const visual = clone(model.scene);
        animator = new NpcAnimator(visual, model.animations);
        // Pierwsza klatka musi zostać zastosowana przed pomiarem SkinnedMesh.
        // Inaczej rig Pierścienia zmienia bounds dopiero po rozpoczęciu pętli.
        animator.update(0);
        this.fit(visual, 2.45);
        root.add(visual);
      } else {
        const fallback = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.34, 0.75, 4, 10),
          new THREE.MeshStandardMaterial({ color: 0xff5d76 }),
        );
        fallback.position.y = 1;
        root.add(fallback);
      }
      if (index === 0 && speaker) {
        const anchor = new THREE.Object3D();
        anchor.position.set(0.55, 0.25, 1.65);
        anchor.userData.interaction = { kind: 'speaker' };
        const accessory = clone(speaker.scene);
        this.fit(accessory, 0.55);
        anchor.add(accessory);
        root.add(anchor);
      }
      root.position.set(spawns[index][0], 0, spawns[index][1]);
      root.userData.interaction = { kind: 'npc', name: asset.name };
      addNpcInteractionHitbox(root);
      root.traverse((o) => (o.userData.interactionRoot = root));
      enableInteractionLayer(root);
      scene.add(root);
      const npc = {
        root,
        name: asset.name,
        line: npcLines[asset.name] || ['Cześć!'],
        animator,
        phase: index,
        target: new THREE.Vector3(),
        wait: 0.6 + index * 0.18,
        returning: false,
        stationary: index === 0 || index === 3 || index === 5,
      };
      this.pickTarget(npc, false);
      this.npcs.push(npc);
    });
  }
  /** Normalizuje wysokość modelu NPC i włącza obsługę cieni. */
  private fit(object: THREE.Object3D, height: number) {
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(object);
    object.scale.setScalar(height / Math.max(0.01, box.max.y - box.min.y));
    box.setFromObject(object);
    object.position.y = -box.min.y;
  }
  /** Losuje osiągalny cel w całym polu albo w centralnej strefie powrotu. */
  private pickTarget(npc: Npc, toCamp: boolean) {
    npc.returning = toCamp;
    const range = toCamp ? CAMP_RADIUS : FIELD_EDGE - 2;
    for (let i = 0; i < 32; i++) {
      const x = (Math.random() * 2 - 1) * range,
        z = (Math.random() * 2 - 1) * range;
      this.candidate.set(x, 0, z);
      if (this.canMove(x, z) && this.candidate.distanceToSquared(npc.root.position) > 25) {
        npc.target.copy(this.candidate);
        return;
      }
    }
    npc.target.set(0, 0, 0);
  }
  /** Chroni NPC przed wejściem w przestrzeń zajętą przez inną postać. */
  private overlapsOther(npc: Npc, next: THREE.Vector3) {
    return this.npcs.some((other) => other !== npc && other.root.position.distanceToSquared(next) < 1.25);
  }
  /** Aktualizuje decyzje ruchu, obrót, powroty od granicy i płynne animacje NPC. */
  update(dt: number, time: number) {
    for (const npc of this.npcs) {
      if (npc.stationary) {
        npc.root.position.y = Math.sin(time * 1.2 + npc.phase) * 0.01;
        npc.animator?.play('Idle');
        npc.animator?.update(dt);
        continue;
      }
      if (npc.wait > 0) {
        npc.wait -= dt;
        npc.animator?.play('Idle');
        npc.animator?.update(dt);
        continue;
      }
      const dir = npc.target.clone().sub(npc.root.position);
      dir.y = 0;
      if (dir.length() < 0.42) {
        npc.wait = 0.5 + Math.random() * 1.7;
        this.pickTarget(npc, false);
        npc.animator?.play('Idle');
        npc.animator?.update(dt);
        continue;
      }
      dir.normalize();
      const nearEdge =
        Math.abs(npc.root.position.x) > FIELD_EDGE - 2 || Math.abs(npc.root.position.z) > FIELD_EDGE - 2;
      if (nearEdge && !npc.returning) this.pickTarget(npc, true);
      const speed = npc.returning ? 1.55 : 0.8,
        next = npc.root.position.clone().addScaledVector(dir, dt * speed);
      if (!this.canMove(next.x, next.z) || this.overlapsOther(npc, next)) {
        this.pickTarget(npc, false);
        npc.wait = 0.18;
        npc.animator?.play('Idle');
      } else {
        npc.root.position.copy(next);
        npc.root.rotation.y = THREE.MathUtils.damp(npc.root.rotation.y, Math.atan2(dir.x, dir.z), 10, dt);
        npc.animator?.setWalkTimeScale(npc.returning ? 1.18 : 0.8);
        npc.animator?.play(npc.returning ? 'Run' : 'Walk');
      }
      npc.animator?.update(dt);
    }
  }
  /** Zatrzymuje miksery animacji wszystkich NPC. */
  dispose() {
    this.npcs.forEach((n) => n.animator?.dispose());
  }
}
