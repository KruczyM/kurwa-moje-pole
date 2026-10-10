import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { StageLiveScreens, stageShotIndex, chooseStagePlayer } from './StageLiveScreens';
import { isStageAudienceCut, STAGE_VIDEO_FILES, StageVideoPlaylist } from './StageVideoPlaylist';

describe('stage live camera feed', () => {
  it('interrupts video every 30 seconds for exactly three seconds', () => {
    expect([0, 29.999, 30, 32.999, 33, 59.999, 60, 62.999, 63].map(isStageAudienceCut)).toEqual([
      false,
      false,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
    expect(STAGE_VIDEO_FILES).toHaveLength(10);
    expect(new Set(STAGE_VIDEO_FILES).size).toBe(10);
  });
  it('cycles five exact 30-second slots, then repeats', () => {
    expect([0, 29.999, 30, 60, 90, 120, 149.999, 150].map(stageShotIndex)).toEqual([0, 0, 1, 2, 3, 4, 4, 0]);
  });
  it('selects a stable logged player ID independently of marker ordering', () => {
    const players = [
      { id: 'b', name: 'B', x: 0, z: 0 },
      { id: 'a', name: 'A', x: 0, z: 0 },
    ];
    expect(chooseStagePlayer(players, 0)).toBe('a');
    expect(chooseStagePlayer([...players].reverse(), 0.99)).toBe('b');
    expect(chooseStagePlayer([], 0)).toBeUndefined();
  });
  it('shares one texture, follows a player, restores renderer state even on error, and disposes once', () => {
    const scene = new THREE.Scene();
    const original = new THREE.MeshStandardMaterial();
    for (const side of ['Left', 'Right']) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), original);
      mesh.userData.runtimeNode = `Wing_Single_Telebim_${side}`;
      scene.add(mesh);
    }
    const feed = new StageLiveScreens(scene, [], () => 0);
    const localModel = new THREE.Group();
    localModel.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), original));
    feed.setLocalAvatar({ scene: localModel, animations: [] } as unknown as GLTF);
    const localAvatar = scene.getObjectByName('StageLiveLocalAvatar')!;
    expect(localAvatar.visible).toBe(false);
    expect(feed.screens[0].material).toBe(feed.screens[1].material);
    expect(feed.target.texture.rotation).toBe(Math.PI);
    for (const uv of [new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0.2, 0.7)]) {
      const rotated = uv.clone().applyMatrix3(feed.target.texture.matrix);
      expect(rotated.x).toBeCloseTo(1 - uv.x);
      expect(rotated.y).toBeCloseTo(1 - uv.y);
    }
    const previous = new THREE.WebGLRenderTarget(8, 8);
    const render = vi.fn();
    const renderer = {
      getRenderTarget: () => previous,
      getActiveCubeFace: () => 0,
      getActiveMipmapLevel: () => 0,
      getViewport: (v: THREE.Vector4) => v.set(1, 2, 3, 4),
      getScissor: (v: THREE.Vector4) => v.set(5, 6, 7, 8),
      getScissorTest: () => true,
      setRenderTarget: vi.fn(),
      setScissorTest: vi.fn(),
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      shadowMap: { autoUpdate: true },
      xr: { enabled: true },
      clear: vi.fn(),
      render,
    };
    const camera = new THREE.PerspectiveCamera();
    const player = { id: 'logged', name: 'Test', x: 12, z: 34 };
    feed.update(120, renderer as unknown as THREE.WebGLRenderer, camera, [player]);
    expect(feed.camera.position.toArray()).toEqual([12, 18, 34]);
    expect(feed.screens[0].userData.liveFeed.shot).toBe(4);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previous, 0, 0);
    expect(renderer.setViewport).toHaveBeenLastCalledWith(new THREE.Vector4(1, 2, 3, 4));
    const count = render.mock.calls.length;
    feed.update(0.01, renderer as unknown as THREE.WebGLRenderer, camera, [player]);
    expect(render).toHaveBeenCalledTimes(count);
    render.mockImplementation(() => expect(localAvatar.visible).toBe(true));
    feed.update(0.1, renderer as unknown as THREE.WebGLRenderer, camera, [], player);
    expect(localAvatar.visible).toBe(false);
    render.mockImplementation(() => {
      throw new Error('GPU');
    });
    expect(() => feed.update(0.1, renderer as unknown as THREE.WebGLRenderer, camera, [player])).toThrow(
      'GPU',
    );
    expect(feed.screens.every((s) => s.visible)).toBe(true);
    expect(renderer.xr.enabled).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    const dispose = vi.spyOn(feed.target, 'dispose');
    feed.dispose();
    feed.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(feed.screens[0].material).toBe(original);
    expect(scene.getObjectByName('StageLiveLocalAvatar')).toBeUndefined();
    previous.dispose();
  });

  it('initializes StageVideoPlaylist with random track or deterministic initialIndex', () => {
    const acoustics = {
      initGraph: vi.fn(),
      connectOutput: vi.fn(),
      dispose: vi.fn(),
    } as any;
    const playlist1 = new StageVideoPlaylist(acoustics, 2);
    expect(playlist1.currentFile).toBe(STAGE_VIDEO_FILES[2]);
    playlist1.dispose();

    const playlist2 = new StageVideoPlaylist(acoustics, 0);
    expect(playlist2.currentFile).toBe(STAGE_VIDEO_FILES[0]);
    playlist2.dispose();

    const playlistRandom = new StageVideoPlaylist(acoustics);
    expect(STAGE_VIDEO_FILES).toContain(playlistRandom.currentFile);
    playlistRandom.dispose();
  });
});
