import { expect, it } from 'vitest';
import * as THREE from 'three';
import { FlankiThrowPose } from './FlankiThrowPose';

it('animates the throwing arm, leaves head and shoulder alone, and restores the pose without drift', () => {
  const root = new THREE.Group();
  const arm = new THREE.Bone();
  arm.name = 'mixamorigRightArm';
  const head = new THREE.Bone();
  head.name = 'mixamorigHead';
  const shoulder = new THREE.Bone();
  shoulder.name = 'mixamorigRightShoulder';
  root.add(arm, head, shoulder);
  const pose = new FlankiThrowPose(root);
  pose.start();
  pose.update(0.2);
  expect(arm.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.1);
  expect(head.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  expect(shoulder.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  for (let i = 0; i < 60; i++) {
    pose.restore();
    pose.update(1 / 60);
  }
  pose.dispose();
  expect(arm.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-7);
  expect(pose.active).toBe(false);
});
