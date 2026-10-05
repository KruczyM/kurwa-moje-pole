import * as THREE from 'three';
import type { MapScenery, RemotePlayerMarker } from '../ui/FestivalMap';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFlankiActor } from '../interactions/FlankiActors';
import { StageVideoPlaylist, isStageAudienceCut } from './StageVideoPlaylist';
import type { SpatialStageAcoustics } from '../audio/SpatialStageAcoustics';

export const STAGE_SHOT_SECONDS = 30;
export const STAGE_FEED_FPS = 10;
export function stageShotIndex(seconds: number): number {
  return Math.floor(Math.max(0, seconds) / STAGE_SHOT_SECONDS) % 5;
}
export function chooseStagePlayer(
  players: readonly RemotePlayerMarker[],
  random: number,
): string | undefined {
  const ids = [...new Set(players.map((p) => p.id))].sort();
  return ids.length ? ids[Math.min(ids.length - 1, Math.floor(Math.max(0, random) * ids.length))] : undefined;
}

/** One shared low-resolution feed, rendered by the game's existing renderer/RAF. */
export class StageLiveScreens {
  readonly target = new THREE.WebGLRenderTarget(512, 288, { depthBuffer: true, stencilBuffer: false });
  readonly camera = new THREE.PerspectiveCamera(58, 512 / 288, 0.3, 500);
  readonly screens: THREE.Mesh[] = [];
  private originals: (THREE.Material | THREE.Material[])[] = [];
  private material: THREE.MeshBasicMaterial;
  private elapsed = 0;
  private frameTime = 1 / STAGE_FEED_FPS;
  private shot = -1;
  private playerId?: string;
  private fixedShots: { eye: THREE.Vector3; look: THREE.Vector3 }[];
  private disposed = false;
  private localAvatar?: ReturnType<typeof createFlankiActor>;
  private videoPlaylist?: StageVideoPlaylist;
  setVideoPlaylist(acoustics: SpatialStageAcoustics): void {
    if (this.videoPlaylist || this.disposed) return;
    this.videoPlaylist = new StageVideoPlaylist(acoustics);
  }
  playLocalJump(): void {
    this.localAvatar?.animator?.queueOneShot('Jump');
  }

  /** Reuse the existing cached character factory; visible only in the TV render pass. */
  setLocalAvatar(model: GLTF): void {
    this.localAvatar?.dispose();
    this.localAvatar = createFlankiActor('stage-local-avatar', new Map([['stage-local-avatar', model]]));
    this.localAvatar.root.name = 'StageLiveLocalAvatar';
    this.localAvatar.root.visible = false;
    this.scene.add(this.localAvatar.root);
  }

  constructor(
    private scene: THREE.Scene,
    scenery: readonly MapScenery[],
    private random = Math.random,
  ) {
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.target.texture.name = 'FestivalLiveFeed';
    // Rotate the shared feed around its centre without changing either screen mesh.
    this.target.texture.center.set(0.5, 0.5);
    this.target.texture.rotation = Math.PI;
    this.target.texture.updateMatrix();
    this.material = new THREE.MeshBasicMaterial({
      map: this.target.texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        /^Wing_Single_Telebim_(Left|Right)$/.test(
          String(obj.userData.runtimeNode ?? obj.userData.runtimePlacement ?? obj.name),
        )
      ) {
        this.screens.push(obj);
        this.originals.push(obj.material);
        obj.material = this.material;
      }
    });
    const road = scenery
      .filter((s) => s.category === 'Roads' && !s.id.startsWith('Camp_path_'))
      .sort((a, b) => b.width * b.depth - a.width * a.depth)
      .slice(0, 2)
      .sort((a, b) => a.z - b.z);
    const stage = scenery.find((s) => s.id === 'Main_Stage_Deck_Plinth' || s.id === 'mainStage');
    const camp = scenery.find((s) => s.id === 'CampFlag');
    const center = (item: MapScenery | undefined, x: number, z: number) =>
      new THREE.Vector3(item?.x ?? x, 0, item?.z ?? z);
    const north = center(road[0], 40, -45),
      south = center(road[1], 0, 92);
    const deck = center(stage, 215, 18),
      base = center(camp, 0, 0);
    this.fixedShots = [
      {
        eye: north.clone().add(new THREE.Vector3(-28, 14, 15)),
        look: north.clone().add(new THREE.Vector3(12, 0, 0)),
      },
      {
        eye: south.clone().add(new THREE.Vector3(28, 14, -15)),
        look: south.clone().add(new THREE.Vector3(-12, 0, 0)),
      },
      {
        eye: deck.clone().add(new THREE.Vector3(-(stage?.width ?? 34) / 2 - 3, 13, 0)),
        look: deck.clone().add(new THREE.Vector3(-55, 0, 0)),
      },
      { eye: base.clone().add(new THREE.Vector3(18, 22, 22)), look: base },
    ];
  }

  update(
    dt: number,
    renderer: THREE.WebGLRenderer,
    viewer: THREE.Camera,
    remotePlayers: readonly RemotePlayerMarker[],
    localPlayer?: RemotePlayerMarker,
  ): void {
    if (this.disposed || !this.screens.length) return;
    this.localAvatar?.animator?.update(Math.max(0, dt));
    const players = localPlayer ? [...remotePlayers, localPlayer] : remotePlayers;
    this.elapsed += Math.max(0, dt);
    if (this.videoPlaylist && !isStageAudienceCut(this.elapsed)) {
      if (this.material.map !== this.videoPlaylist.texture) {
        this.material.map = this.videoPlaylist.texture;
        this.material.needsUpdate = true;
      }
      for (const screen of this.screens)
        screen.userData.liveFeed = { shot: 'video', label: this.videoPlaylist.currentFile };
      return;
    }
    if (this.material.map !== this.target.texture) {
      this.material.map = this.target.texture;
      this.material.needsUpdate = true;
    }
    const next = this.videoPlaylist ? 2 : stageShotIndex(this.elapsed);
    if (next !== this.shot) {
      this.shot = next;
      this.playerId = next === 4 ? chooseStagePlayer(players, this.random()) : undefined;
    }
    let label: string;
    const followed = this.shot === 4 ? players.find((p) => p.id === this.playerId) : undefined;
    if (followed) {
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(followed.x, (followed.y ?? 0) + 18, followed.z);
      this.camera.lookAt(followed.x, followed.y ?? 0, followed.z);
      label = `Gracz: ${followed.name}`;
    } else {
      const shot = this.fixedShots[this.shot === 4 ? 3 : this.shot];
      this.camera.up.set(0, 1, 0);
      this.camera.position.copy(shot.eye);
      this.camera.lookAt(shot.look);
      label = ['Pasaż północny', 'Pasaż południowy', 'Pod dużą sceną', 'Obóz #KurwaMojePole'][
        this.shot === 4 ? 3 : this.shot
      ];
    }
    for (const screen of this.screens) screen.userData.liveFeed = { shot: this.shot, label };
    this.frameTime += Math.max(0, dt);
    if (this.frameTime < 1 / STAGE_FEED_FPS) return;
    // Do not pay for an offscreen TV when the viewer is far away.
    const position = new THREE.Vector3();
    viewer.getWorldPosition(position);
    if (this.screens.every((s) => s.getWorldPosition(new THREE.Vector3()).distanceTo(position) > 240)) return;
    this.frameTime = 0;
    const previousTarget = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace(),
      mip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new THREE.Vector4()),
      scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest(),
      shadow = renderer.shadowMap.autoUpdate;
    const xr = renderer.xr.enabled;
    const visible = this.screens.map((s) => s.visible);
    try {
      if (this.localAvatar && localPlayer) {
        this.localAvatar.root.position.set(localPlayer.x, localPlayer.y ?? 0, localPlayer.z);
        this.localAvatar.root.rotation.y = localPlayer.yaw ?? 0;
        this.localAvatar.groundFeet();
        this.localAvatar.root.visible = true;
      }
      this.screens.forEach((s) => (s.visible = false)); // No recursive feedback.
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.target);
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      if (this.localAvatar) this.localAvatar.root.visible = false;
      this.screens.forEach((s, i) => (s.visible = visible[i]));
      renderer.xr.enabled = xr;
      renderer.shadowMap.autoUpdate = shadow;
      renderer.setRenderTarget(previousTarget, cubeFace, mip);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.screens.forEach((s, i) => (s.material = this.originals[i]));
    this.material.dispose();
    this.target.dispose();
    this.videoPlaylist?.dispose();
    this.localAvatar?.dispose();
  }
}
