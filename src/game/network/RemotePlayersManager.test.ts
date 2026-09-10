import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RemotePlayersManager } from './RemotePlayersManager';
import { NetworkClient } from './NetworkClient';
import type { WorldSnapshotPayload } from './networkProtocol';

describe('RemotePlayersManager', () => {
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let characterModels: Map<string, GLTF>;
  let networkClient: NetworkClient;
  let manager: RemotePlayersManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 2, 5);

    characterModels = new Map<string, GLTF>();
    // Dodajemy przykładowy mock modelu dla amper:
    const mockScene = new THREE.Group();
    mockScene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)));
    const mockGltf: GLTF = {
      scene: mockScene,
      scenes: [mockScene],
      animations: [
        new THREE.AnimationClip('Idle', 1, []),
        new THREE.AnimationClip('Walk', 1, []),
        new THREE.AnimationClip('Run', 1, []),
      ],
      cameras: [],
      asset: {},
      parser: {} as any,
      userData: {},
    };
    characterModels.set('amper', mockGltf);

    networkClient = new NetworkClient({ autoConnect: false });
    manager = new RemotePlayersManager(scene, characterModels, networkClient);
  });

  it('dodaje nową encję zdalnego gracza ze snapshotu', () => {
    const snapshot: WorldSnapshotPayload = {
      timestamp: Date.now(),
      players: [
        {
          playerId: 'remote-1',
          character: 'Amper',
          nickname: 'Kolega1',
          transform: {
            position: [5, 0, -2],
            yaw: 1.5,
            pitch: 0,
            locomotion: 'Walk',
            speed: 3.0,
            timestamp: Date.now(),
          },
        },
      ],
    };

    manager.handleWorldSnapshot(snapshot);

    expect(manager.remotePlayers.size).toBe(1);
    const entity = manager.remotePlayers.get('remote-1');
    expect(entity).toBeDefined();
    expect(entity?.characterName).toBe('Amper');
    expect(entity?.nickname).toBe('Kolega1');
    expect(entity?.targetPosition.x).toBe(5);
    expect(entity?.targetPosition.z).toBe(-2);
    expect(scene.children.length).toBe(1);
  });

  it('ignoruje lokalnego gracza na podstawie getMyPlayerId()', () => {
    // Ustawiamy myPlayerId w networkClient
    (networkClient as any).myPlayerId = 'my-local-id';

    const snapshot: WorldSnapshotPayload = {
      timestamp: Date.now(),
      players: [
        {
          playerId: 'my-local-id',
          character: 'Amper',
          nickname: 'JaSam',
          transform: {
            position: [0, 0, 0],
            yaw: 0,
            locomotion: 'Idle',
            speed: 0,
            timestamp: Date.now(),
          },
        },
        {
          playerId: 'remote-2',
          character: 'Klątwa',
          nickname: 'Kolega2',
          transform: {
            position: [2, 0, 2],
            yaw: 0.5,
            locomotion: 'Idle',
            speed: 0,
            timestamp: Date.now(),
          },
        },
      ],
    };

    manager.handleWorldSnapshot(snapshot);

    expect(manager.remotePlayers.size).toBe(1);
    expect(manager.remotePlayers.has('my-local-id')).toBe(false);
    expect(manager.remotePlayers.has('remote-2')).toBe(true);
  });

  it('płynnie interpoluje pozycję i kąt yaw w update()', () => {
    const snapshot: WorldSnapshotPayload = {
      timestamp: Date.now(),
      players: [
        {
          playerId: 'remote-1',
          character: 'Amper',
          nickname: 'Kolega1',
          transform: {
            position: [10, 0, 10],
            yaw: 1.0,
            locomotion: 'Run',
            speed: 6.0,
            timestamp: Date.now(),
          },
        },
      ],
    };

    manager.handleWorldSnapshot(snapshot);
    const entity = manager.remotePlayers.get('remote-1')!;

    // Zmieniamy cel na nową pozycję:
    entity.targetPosition.set(2, 0, 2);
    entity.targetYaw = 2.0;

    manager.update(0.05, camera);

    // Pozycja powinna zbliżyć się do targetu, ale nie przeskoczyć w jednej klatce:
    expect(entity.currentPosition.x).toBeLessThan(10);
    expect(entity.currentPosition.x).toBeGreaterThan(2);
    expect(entity.currentYaw).toBeGreaterThan(1.0);
    expect(entity.currentYaw).toBeLessThanOrEqual(2.0);
  });

  it('teleportuje od razu jeśli dystans przekracza limit (np. respawn)', () => {
    const snapshot: WorldSnapshotPayload = {
      timestamp: Date.now(),
      players: [
        {
          playerId: 'remote-1',
          character: 'Amper',
          nickname: 'Kolega1',
          transform: {
            position: [0, 0, 0],
            yaw: 0,
            locomotion: 'Idle',
            speed: 0,
            timestamp: Date.now(),
          },
        },
      ],
    };

    manager.handleWorldSnapshot(snapshot);
    const entity = manager.remotePlayers.get('remote-1')!;

    // Zmieniamy cel o ponad 12 metrów:
    entity.targetPosition.set(30, 0, 30);
    manager.update(0.05, camera);

    // Pozycja powinna natychmiast przeskoczyć do targetu:
    expect(entity.currentPosition.x).toBe(30);
    expect(entity.currentPosition.z).toBe(30);
  });

  it('usuwa encję zdalnego gracza gdy znika ze snapshotu', () => {
    const snapshot1: WorldSnapshotPayload = {
      timestamp: Date.now(),
      players: [
        {
          playerId: 'remote-1',
          character: 'Amper',
          nickname: 'Kolega1',
          transform: {
            position: [1, 0, 1],
            yaw: 0,
            locomotion: 'Idle',
            speed: 0,
            timestamp: Date.now(),
          },
        },
      ],
    };
    manager.handleWorldSnapshot(snapshot1);
    expect(manager.remotePlayers.size).toBe(1);

    const snapshot2: WorldSnapshotPayload = {
      timestamp: Date.now() + 100,
      players: [], // Gracz opuścił pokój
    };
    manager.handleWorldSnapshot(snapshot2);

    expect(manager.remotePlayers.size).toBe(0);
    expect(scene.children.length).toBe(0);
  });

  it('zwalnia zasoby w dispose()', () => {
    const snapshot: WorldSnapshotPayload = {
      timestamp: Date.now(),
      players: [
        {
          playerId: 'remote-1',
          character: 'Amper',
          nickname: 'Kolega1',
          transform: {
            position: [1, 0, 1],
            yaw: 0,
            locomotion: 'Idle',
            speed: 0,
            timestamp: Date.now(),
          },
        },
      ],
    };
    manager.handleWorldSnapshot(snapshot);
    expect(manager.remotePlayers.size).toBe(1);

    manager.dispose();
    expect(manager.remotePlayers.size).toBe(0);
    expect(scene.children.length).toBe(0);
  });
});
