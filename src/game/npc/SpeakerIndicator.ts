import * as THREE from 'three';

/** Two tiny unlit bars; no light, texture, timer or separate render loop. */
export class SpeakerIndicator extends THREE.Group {
  private readonly vertical: THREE.Mesh;
  private readonly target = new THREE.Vector3();

  constructor() {
    super();
    this.name = 'SpeakerStatusIndicator';
    this.position.y = 0.85;
    const material = new THREE.MeshBasicMaterial({ color: 0x65ff18, toneMapped: false });
    this.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.018), material));
    this.vertical = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.018), material);
    this.vertical.visible = false;
    this.add(this.vertical);
    this.userData.symbol = '-';
  }

  update(playing: boolean, viewer?: THREE.Vector3): void {
    this.vertical.visible = playing;
    this.userData.symbol = playing ? '+' : '-';
    if (viewer) {
      this.getWorldPosition(this.target);
      this.target.set(viewer.x, this.target.y, viewer.z);
      this.lookAt(this.target);
    }
  }
}
