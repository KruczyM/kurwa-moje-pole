import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { RemotePlayersManager } from './RemotePlayersManager';
import type { WorldSnapshotPayload } from './networkProtocol';
import { festivalAreaAt } from '../world/mobileFestivalAreas';

const snapshot: WorldSnapshotPayload = {
  timestamp: 1,
  players: [
    {
      playerId: 'camp-player',
      character: 'Amper',
      nickname: 'Camp',
      transform: { position: [0, 0, 5], yaw: 0, locomotion: 'Idle', speed: 0, timestamp: 1 },
    },
    {
      playerId: 'stage-player',
      character: 'Antena',
      nickname: 'Stage',
      transform: { position: [175, 0, 20], yaw: 0, locomotion: 'Idle', speed: 0, timestamp: 1 },
    },
  ],
};

describe('remote players across mobile places', () => {
  it('keeps one room snapshot and global markers/voice positions while evicting nonresident avatars', () => {
    let area: string | undefined = 'camp';
    const scene = new THREE.Scene();
    const manager = new RemotePlayersManager(
      scene,
      new Map(),
      undefined,
      undefined,
      (player) => festivalAreaAt(player.transform.position[0], player.transform.position[2]) === area,
    );
    manager.handleWorldSnapshot(snapshot);
    expect([...manager.remotePlayers.keys()]).toEqual(['camp-player']);
    expect(manager.getPlayerMarkers()).toHaveLength(2);
    expect(manager.getPlayerPositions().size).toBe(2);
    const root = manager.remotePlayers.get('camp-player')!.root;
    const fallback = manager.remotePlayers.get('camp-player')!.visual as THREE.Mesh;
    const disposed = vi.fn();
    fallback.geometry.addEventListener('dispose', disposed);
    area = undefined;
    manager.refreshResidentPlayers();
    expect(manager.remotePlayers.size).toBe(0);
    expect(root.parent).toBeNull();
    expect(disposed).toHaveBeenCalledOnce();
    area = 'main-stage';
    manager.refreshResidentPlayers();
    expect([...manager.remotePlayers.keys()]).toEqual(['stage-player']);
    expect(manager.getResidentCharacterNames()).toEqual(['Antena']);
    expect(manager.getPlayerMarkers()).toHaveLength(2);
    area = 'camp';
    manager.refreshResidentPlayers();
    expect([...manager.remotePlayers.keys()]).toEqual(['camp-player']);
    manager.handleWorldSnapshot({ timestamp: 2, players: [] });
    expect(manager.remotePlayers.size).toBe(0);
    expect(manager.getPlayerMarkers()).toHaveLength(0);
    expect(manager.getPlayerPositions().size).toBe(0);
    manager.dispose();
    manager.refreshResidentPlayers();
    expect(scene.children).toHaveLength(0);
  });
});
