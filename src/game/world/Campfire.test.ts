import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Campfire } from './Campfire';

describe('Campfire', () => {
  it('creates campfire visual hierarchy with stones, flame and light', () => {
    const campfire = new Campfire({ position: [5.5, 0, -3.0], lightIntensity: 4.0 });
    expect(campfire.root.name).toBe('Campfire');
    expect(campfire.position.x).toBe(5.5);
    expect(campfire.position.z).toBe(-3.0);

    const light = campfire.root.getObjectByName('Campfire_PointLight') as THREE.PointLight;
    expect(light).toBeDefined();
    expect(light.isPointLight).toBe(true);
    expect(campfire.logSeats.length).toBe(3);

    campfire.dispose();
  });

  it('updates flame flicker and light intensity on update', () => {
    const campfire = new Campfire();
    const light = campfire.root.getObjectByName('Campfire_PointLight') as THREE.PointLight;
    const initialIntensity = light.intensity;

    campfire.update(0.1);
    expect(light.intensity).toBeGreaterThan(0);

    campfire.update(0.2);
    expect(light.intensity).toBeGreaterThan(0);

    campfire.dispose();
  });

  it('provides interactive log seats around the fire', () => {
    const campfire = new Campfire();
    for (const seat of campfire.logSeats) {
      expect(seat.id).toMatch(/^Campfire_Seat_\d+$/);
      expect(seat.position).toBeDefined();
      expect(typeof seat.rotationY).toBe('number');
    }
    campfire.dispose();
  });
});
