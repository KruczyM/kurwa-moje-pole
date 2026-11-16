import * as THREE from 'three';
import { MAIN_ASPHALT_ROAD } from './festivalLayout';
import { terrainHeight } from './terrainHeight';

const STALL_LABEL = 'nielegalne rzeczy';
const STALL_WIDTH = 3.8;
const STALL_DEPTH = 3.4;
const EAVE_HEIGHT = 2.35;

function createSign() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#281742';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, 20);
  ctx.rect(0, canvas.height - 20, canvas.width, 20);
  ctx.clip();
  const colors = ['#ffce38', '#ff6a41', '#ed428c', '#a96ae3', '#2ab3e8', '#66d079'];
  for (let i = -1; i <= 8; i++) {
    ctx.fillStyle = colors[(i + colors.length) % colors.length];
    ctx.beginPath();
    ctx.moveTo(i * 132 + 52, 0);
    ctx.lineTo((i + 1) * 132 + 52, 0);
    ctx.lineTo((i + 1) * 132, canvas.height);
    ctx.lineTo(i * 132, canvas.height);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#fff8df';
  ctx.font = '900 106px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(STALL_LABEL, canvas.width / 2, canvas.height / 2, canvas.width - 92);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.34, 0.63),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  sign.name = STALL_LABEL;
  sign.position.set(0, EAVE_HEIGHT + 0.12, STALL_DEPTH / 2 + 0.127);
  return sign;
}

/** Open-front trading tent with a recessed counter and a walkable customer area. */
export function createContrabandStall() {
  const root = new THREE.Group();
  root.name = 'ContrabandStall';
  const x = -62;
  const z = MAIN_ASPHALT_ROAD.minZ - 3;
  root.position.set(x, terrainHeight(x, z), z);

  const cloth = new THREE.MeshStandardMaterial({ color: 0x653994, roughness: 0.93 });
  const canopy = new THREE.MeshStandardMaterial({ color: 0x34204f, roughness: 0.9 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x29212c, roughness: 0.65 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xc49558, roughness: 0.8 });
  const box = (
    material: THREE.Material,
    size: [number, number, number],
    position: [number, number, number],
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  };
  const halfWidth = STALL_WIDTH / 2;
  const halfDepth = STALL_DEPTH / 2;
  const obstacles = [
    box(cloth, [STALL_WIDTH, EAVE_HEIGHT, 0.07], [0, EAVE_HEIGHT / 2, -halfDepth]),
    box(cloth, [0.07, EAVE_HEIGHT, STALL_DEPTH], [-halfWidth, EAVE_HEIGHT / 2, 0]),
    box(cloth, [0.07, EAVE_HEIGHT, STALL_DEPTH], [halfWidth, EAVE_HEIGHT / 2, 0]),
  ];
  for (const postX of [-halfWidth, halfWidth])
    for (const postZ of [-halfDepth, halfDepth])
      box(frame, [0.095, EAVE_HEIGHT, 0.095], [postX, EAVE_HEIGHT / 2, postZ]);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT2, 1.15, 4).rotateY(Math.PI / 4), canopy);
  roof.position.y = EAVE_HEIGHT + 0.575;
  roof.scale.set(halfWidth + 0.1, 1, halfDepth + 0.1);
  root.add(roof);
  box(cloth, [STALL_WIDTH + 0.2, 0.22, 0.09], [0, EAVE_HEIGHT - 0.08, halfDepth]);
  const sign = createSign();
  if (sign) {
    box(frame, [3.4, 0.67, 0.08], [0, EAVE_HEIGHT + 0.12, halfDepth + 0.085]);
    root.add(sign);
  }

  const counterZ = 0.15;
  const counterTop = 1.08;
  box(frame, [2.68, counterTop, 0.76], [0, counterTop / 2, counterZ]);
  const counter = box(wood, [2.82, 0.08, 0.9], [0, counterTop - 0.04, counterZ]);
  box(cloth, [2.58, 0.76, 0.04], [0, 0.49, counterZ + 0.39]);
  box(wood, [2.58, 0.035, 0.045], [0, 0.18, counterZ + 0.4]);
  obstacles.push(counter);

  const display = new THREE.Group();
  display.position.set(0, counterTop, counterZ + 0.19);
  root.traverse((part) => {
    if (part instanceof THREE.Mesh && part !== sign) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  root.add(display);
  return {
    root,
    display,
    obstacles,
    scenery: { id: root.name, category: 'Passage', x, z, width: STALL_WIDTH, depth: STALL_DEPTH },
  };
}
