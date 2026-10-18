import * as THREE from 'three';

/** Small additive overarm throw on the existing rig, without changing skin weights. */
export class FlankiThrowPose {
  private elapsed = 1;
  private bones: { bone: THREE.Bone; base: THREE.Quaternion; restored: boolean; forearm: boolean }[] = [];
  constructor(root: THREE.Object3D) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Bone)) return;
      const name = object.name.replace(/^mixamorig[:_]?/i, '');
      if (name === 'RightArm' || name === 'RightForeArm')
        this.bones.push({
          bone: object,
          base: object.quaternion.clone(),
          restored: true,
          forearm: name === 'RightForeArm',
        });
    });
  }
  get active() {
    return this.elapsed < 0.7;
  }
  start() {
    if (!this.active) this.elapsed = 0;
  }
  restore() {
    for (const entry of this.bones) {
      if (!entry.restored) entry.bone.quaternion.copy(entry.base);
      entry.restored = true;
    }
  }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0 || !this.active) return;
    this.elapsed = Math.min(0.7, this.elapsed + dt);
    const t = this.elapsed;
    // Wind up to release at 0.28 s, follow through and ease back to locomotion.
    const weight = Math.sin((Math.PI * t) / 0.7);
    const swing = t < 0.28 ? (-0.8 * t) / 0.28 : 0.65 * (1 - (t - 0.28) / 0.42);
    for (const entry of this.bones) {
      entry.base.copy(entry.bone.quaternion);
      const offset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          entry.forearm ? -0.6 * weight : swing * weight,
          0,
          entry.forearm ? 0 : -0.25 * weight,
        ),
      );
      entry.bone.quaternion.multiply(offset).normalize();
      entry.restored = false;
    }
  }
  dispose() {
    this.restore();
    this.bones.length = 0;
  }
}
