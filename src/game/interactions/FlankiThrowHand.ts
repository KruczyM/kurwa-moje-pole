import * as THREE from 'three';
import { flankiSway } from './FlankiPhysics';

/** Camera-space hand; updated from the existing game loop, never its own renderer. */
export class FlankiThrowHand {
  readonly root = new THREE.Group();
  constructor() {
    this.root.name = 'Flanki_ThrowHand';
    this.root.scale.setScalar(0.65);
    const skin = new THREE.MeshStandardMaterial({ color: 0xe7b78f, roughness: 0.85, depthTest: false });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 1, depthTest: false });
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 0.38, 12), sleeve);
    arm.position.set(0, -0.17, 0.07);
    arm.rotation.x = 0.6;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), skin);
    palm.scale.set(0.85, 1.2, 0.65);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xccff00, roughness: 0.85, depthTest: false }),
    );
    ball.position.set(-0.025, 0.085, -0.02);
    this.root.add(arm, palm, ball);
    this.root.traverse((object) => {
      object.renderOrder = 1000;
    });
    this.root.visible = false;
  }
  update(camera: THREE.Camera, visible: boolean, seconds: number, charging = false) {
    if (this.root.parent !== camera) camera.add(this.root);
    this.root.visible = visible;
    const sway = charging ? { x: 0, y: 0, pitch: 0, yaw: 0 } : flankiSway(seconds);
    this.root.position.set(0.17 + sway.x, -0.17 + sway.y, -0.52);
    this.root.rotation.set(sway.pitch, sway.yaw, -0.2 + sway.yaw);
  }
  dispose() {
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) =>
          materials.add(m),
        );
      }
    });
    materials.forEach((material) => material.dispose());
    this.root.removeFromParent();
  }
}
