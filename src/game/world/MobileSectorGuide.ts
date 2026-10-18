import * as THREE from 'three';
import {
  FESTIVAL_BOUNDARIES,
  festivalAreaLabel,
  nearestFestivalBoundary,
  type FestivalBoundary,
} from './mobileFestivalAreas';
import { terrainHeight } from './terrainHeight';

/** Ground markings use the existing scene and frame loop. No additional renderer or timer. */
export class MobileSectorGuide {
  readonly root = new THREE.Group();
  private readonly material = new THREE.LineBasicMaterial({
    color: 0xffdd83,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  private readonly lines: { edge: FestivalBoundary; mesh: THREE.LineSegments }[] = [];
  private readonly hint = document.createElement('div');
  constructor(scene: THREE.Scene) {
    this.root.name = 'MobileSectorBoundaries';
    this.root.visible = false;
    this.hint.id = 'mobile-sector-hint';
    for (const edge of FESTIVAL_BOUNDARIES) {
      const length = Math.hypot(edge.x2 - edge.x1, edge.z2 - edge.z1);
      const points: number[] = [];
      for (let t = 0; t < length; t += 1.5) {
        for (const along of [t, Math.min(length, t + 0.85)]) {
          const x = edge.x1 + ((edge.x2 - edge.x1) * along) / length;
          const z = edge.z1 + ((edge.z2 - edge.z1) * along) / length;
          points.push(x, terrainHeight(x, z) + 0.06, z);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const mesh = new THREE.LineSegments(geometry, this.material);
      mesh.userData.excludeMushroomWireframe = true;
      this.root.add(mesh);
      this.lines.push({ edge, mesh });
    }
    scene.add(this.root);
    this.hint.setAttribute('role', 'status');
    Object.assign(this.hint.style, {
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 124px)',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '80vw',
      padding: '6px 10px',
      borderRadius: '8px',
      background: 'rgba(12,22,24,.88)',
      color: '#ffdd83',
      font: '600 13px system-ui',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: '25',
    });
    this.hint.hidden = true;
    document.body.append(this.hint);
  }
  update(x: number, z: number, area: string | undefined, visible: boolean) {
    this.root.visible = visible && !!area;
    for (const { edge, mesh } of this.lines) {
      const px = Math.max(edge.x1, Math.min(edge.x2, x));
      const pz = Math.max(edge.z1, Math.min(edge.z2, z));
      mesh.visible = (edge.a === area || edge.b === area) && Math.hypot(x - px, z - pz) <= 24;
      const along = edge.x1 === edge.x2 ? pz - edge.z1 : px - edge.x1;
      const start = Math.max(0, Math.floor((along - 24) / 1.5)) * 2;
      const end = Math.min(mesh.geometry.getAttribute('position').count, Math.ceil((along + 24) / 1.5) * 2);
      mesh.geometry.setDrawRange(start, Math.max(0, end - start));
    }
    const nearby = area && visible ? nearestFestivalBoundary(x, z, area) : undefined;
    const text =
      nearby && nearby.distance <= 8
        ? `Granica: ${festivalAreaLabel(nearby.target)} · ${Math.ceil(nearby.distance)} m`
        : '';
    if (this.hint.textContent !== text) this.hint.textContent = text;
    this.hint.hidden = !text;
  }
  dispose() {
    this.root.removeFromParent();
    for (const { mesh } of this.lines) mesh.geometry.dispose();
    this.material.dispose();
    this.hint.remove();
  }
}
