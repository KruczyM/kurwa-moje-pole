import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerNametag, projectNametagPosition } from './PlayerNametag';

describe('PlayerNametag', () => {
  it('przechowuje i aktualizuje pseudonim oraz postać gracza', () => {
    const nametag = new PlayerNametag({
      nickname: 'Kowalski',
      characterName: 'Amper',
    });

    expect(nametag.getNickname()).toBe('Kowalski');
    expect(nametag.getCharacterName()).toBe('Amper');

    nametag.setNickname('NowyNick');
    expect(nametag.getNickname()).toBe('NowyNick');
  });

  describe('projectNametagPosition', () => {
    it('poprawnie rzutuje pozycję postaci przed kamerą na współrzędne ekranu', () => {
      const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);
      camera.position.set(0, 2, 5);
      camera.lookAt(0, 2, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      const characterPos = new THREE.Vector3(0, 0, 0);
      const viewport = { width: 1920, height: 1080 };

      const res = projectNametagPosition(characterPos, camera, viewport);
      expect(res.visible).toBe(true);
      expect(res.x).toBeCloseTo(960, 0); // środek ekranu w poziomie
      expect(res.opacity).toBe(1.0);
    });

    it('zwraca visible=false gdy postać znajduje się za daleko', () => {
      const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -1);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      const characterPos = new THREE.Vector3(0, 0, -40); // 40m > maxDistance 25m
      const viewport = { width: 1920, height: 1080 };

      const res = projectNametagPosition(characterPos, camera, viewport, { maxDistance: 25 });
      expect(res.visible).toBe(false);
    });

    it('zmniejsza opacity przy oddalaniu w strefie fade', () => {
      const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -1);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      // Pozycja w połowie strefy fade (21.5m, między 18 a 25m):
      const characterPos = new THREE.Vector3(0, -2.15, -21.5);
      const viewport = { width: 1920, height: 1080 };

      const res = projectNametagPosition(characterPos, camera, viewport, {
        fadeStartDistance: 18,
        maxDistance: 25,
      });

      expect(res.visible).toBe(true);
      expect(res.opacity).toBeLessThan(1.0);
      expect(res.opacity).toBeGreaterThan(0.0);
    });
  });
});
