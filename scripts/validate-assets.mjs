import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicAssets = join(root, 'public', 'game-assets');
const catalogPath = join(root, 'src', 'game', 'assets', 'assetCatalog.json');
const voiceCatalogPath = join(root, 'src', 'game', 'audio', 'voiceReactionCatalog.json');
const reportPath = join(root, 'reports', 'asset-validation.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const voiceCatalog = JSON.parse(readFileSync(voiceCatalogPath, 'utf8'));
const voiceNames = new Set();
/** Rekurencyjnie zbiera nazwy nagrań z wielopoziomowego katalogu reakcji. */
const collectVoiceNames = (value) => {
  if (typeof value === 'string') voiceNames.add(value);
  else if (Array.isArray(value)) value.forEach(collectVoiceNames);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectVoiceNames);
};
collectVoiceNames(voiceCatalog);
const requiredLocomotion = ['Idle', 'Walk', 'Run'];
const knownBlockers = {};
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const assets = [
  ...catalog.characters.flatMap((character) => [
    {
      id: `character:${character.id}:preview`,
      label: `${character.name} — preview`,
      path: `characters/${character.id}/preview.glb`,
      kind: 'character-preview',
    },
    {
      id: `character:${character.id}:animations`,
      label: `${character.name} — NPC`,
      path: `characters/${character.id}/npc-animations.glb`,
      kind: 'character-animation',
    },
  ]),
  ...Object.entries(catalog.environment).map(([id, path]) => ({
    id: `environment:${id}`,
    label: id,
    path,
    kind: 'model',
  })),
  ...Object.entries(catalog.tents).map(([id, path]) => ({
    id: `tent:${id}`,
    label: `tent ${id}`,
    path,
    kind: 'model',
  })),
  ...Object.entries(catalog.interactives).map(([id, path]) => ({
    id: `interactive:${id}`,
    label: id,
    path,
    kind: 'model',
  })),
  ...Object.entries(catalog.textures.grass).map(([id, path]) => ({
    id: `texture:grass:${id}`,
    label: `grass ${id}`,
    path,
    kind: 'file',
  })),
  {
    id: 'texture:horizon',
    label: 'horizon',
    path: catalog.textures.horizon,
    kind: 'file',
  },
  ...Object.entries(catalog.textures.skyboxes).flatMap(([period, paths]) =>
    paths.map((path, index) => ({
      id: `texture:skybox:${period}:${index}`,
      label: `skybox ${period} ${index + 1}/6`,
      path,
      kind: 'file',
    })),
  ),
  ...catalog.effects.lsdOverlays.map((path, index) => ({
    id: `effect:lsd-overlay:${index + 1}`,
    label: `LSD overlay ${index + 1}`,
    path,
    kind: 'file',
  })),
  {
    id: 'audio:music',
    label: 'camp music',
    path: catalog.audio.music,
    kind: 'file',
  },
  ...[...voiceNames].map((name) => ({
    id: `audio:voice:${name}`,
    label: `voice ${name}`,
    path: `${catalog.audio.voiceBase}/${name}.wav`,
    kind: 'file',
  })),
];

/** Buduje jednolity wpis problemu do raportu walidacji. */
function issue(level, code, message) {
  return { level, code, message };
}

/** Sprawdza podstawowy nagłówek i rozmiar pliku WAV. */
function validateWav(filePath) {
  const bytes = readFileSync(filePath);
  const valid =
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WAVE';
  return {
    byteLength: bytes.length,
    problems: valid ? [] : [issue('error', 'invalid-wav', 'plik nie ma nagłówka RIFF/WAVE')],
  };
}

/** Parsuje kontener GLB 2.0 i zwraca JSON oraz jego binarne chunki. */
function parseGlb(filePath) {
  const bytes = readFileSync(filePath);
  if (bytes.length < 20) throw new Error('plik jest krótszy niż nagłówek GLB');
  if (bytes.readUInt32LE(0) !== GLB_MAGIC) throw new Error('nieprawidłowy magic GLB');
  const version = bytes.readUInt32LE(4);
  if (version !== 2) throw new Error(`nieobsługiwana wersja GLB: ${version}`);
  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) {
    throw new Error(`długość nagłówka ${declaredLength} nie zgadza się z plikiem ${bytes.length}`);
  }

  let offset = 12;
  let json;
  const binaryChunks = [];
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('ucięty nagłówek chunka GLB');
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + length > bytes.length) throw new Error('chunk GLB wychodzi poza koniec pliku');
    const chunk = bytes.subarray(offset, offset + length);
    if (type === JSON_CHUNK) {
      json = JSON.parse(chunk.toString('utf8').replace(/[\u0000\u0020]+$/u, ''));
    } else if (type === BIN_CHUNK) {
      binaryChunks.push(chunk);
    }
    offset += length;
  }
  if (!json) throw new Error('brak chunka JSON');
  return { json, binaryChunks, byteLength: bytes.length };
}

/** Rozwiązuje bufory osadzone, data URI oraz zewnętrzne pliki glTF. */
function loadBuffers(gltf, binaryChunks, filePath, problems) {
  let embeddedIndex = 0;
  return (gltf.buffers ?? []).map((buffer, index) => {
    let bytes;
    if (!buffer.uri) {
      bytes = binaryChunks[embeddedIndex++];
    } else if (buffer.uri.startsWith('data:')) {
      const comma = buffer.uri.indexOf(',');
      bytes = comma >= 0 ? Buffer.from(buffer.uri.slice(comma + 1), 'base64') : undefined;
    } else {
      const external = resolve(dirname(filePath), decodeURIComponent(buffer.uri.split(/[?#]/u)[0]));
      if (existsSync(external)) bytes = readFileSync(external);
      else problems.push(issue('error', 'missing-buffer', `brak zewnętrznego bufora: ${buffer.uri}`));
    }
    if (!bytes) {
      problems.push(issue('error', 'missing-buffer', `brak danych bufora ${index}`));
      return undefined;
    }
    if (bytes.length < buffer.byteLength) {
      problems.push(issue('error', 'short-buffer', `bufor ${index} jest krótszy niż deklaracja`));
    }
    return bytes;
  });
}

const componentReaders = {
  5120: { bytes: 1, read: (view, offset) => view.getInt8(offset) },
  5121: { bytes: 1, read: (view, offset) => view.getUint8(offset) },
  5122: { bytes: 2, read: (view, offset) => view.getInt16(offset, true) },
  5123: { bytes: 2, read: (view, offset) => view.getUint16(offset, true) },
  5125: { bytes: 4, read: (view, offset) => view.getUint32(offset, true) },
  5126: { bytes: 4, read: (view, offset) => view.getFloat32(offset, true) },
};
const componentCounts = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

/** Bada pozycje wierzchołków i zgłasza wartości spoza bufora lub NaN. */
function inspectPositionAccessor(gltf, buffers, accessorIndex, problems) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) {
    problems.push(issue('error', 'missing-accessor', `brak accessora POSITION ${accessorIndex}`));
    return undefined;
  }
  const viewDefinition = gltf.bufferViews?.[accessor.bufferView];
  if (!viewDefinition) {
    problems.push(
      issue('error', 'missing-buffer-view', `POSITION ${accessorIndex} nie ma poprawnego bufferView`),
    );
    return undefined;
  }
  const buffer = buffers[viewDefinition.buffer];
  const reader = componentReaders[accessor.componentType];
  const components = componentCounts[accessor.type];
  if (!buffer || !reader || components !== 3) {
    problems.push(issue('error', 'invalid-position', `POSITION ${accessorIndex} ma nieobsługiwany format`));
    return undefined;
  }

  const stride = viewDefinition.byteStride ?? reader.bytes * components;
  const start = (viewDefinition.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const requiredEnd = start + Math.max(0, accessor.count - 1) * stride + reader.bytes * components;
  if (requiredEnd > buffer.length) {
    problems.push(issue('error', 'accessor-out-of-range', `POSITION ${accessorIndex} wychodzi poza bufor`));
    return undefined;
  }

  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let invalidValues = 0;
  for (let vertex = 0; vertex < accessor.count; vertex += 1) {
    const vertexOffset = start + vertex * stride;
    for (let axis = 0; axis < 3; axis += 1) {
      const value = reader.read(dataView, vertexOffset + axis * reader.bytes);
      if (!Number.isFinite(value)) invalidValues += 1;
      else {
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
  }
  if (invalidValues > 0) {
    problems.push(
      issue(
        'error',
        'non-finite-position',
        `POSITION ${accessorIndex} zawiera ${invalidValues} wartości NaN/Infinity`,
      ),
    );
  }
  return invalidValues === accessor.count * 3 ? undefined : { min, max, vertices: accessor.count };
}

/** Odczytuje zakres liczbowy dowolnego accessora używanego między innymi przez animacje. */
function inspectNumericAccessor(gltf, buffers, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  const viewDefinition = accessor && gltf.bufferViews?.[accessor.bufferView];
  const reader = accessor && componentReaders[accessor.componentType];
  const components = accessor && componentCounts[accessor.type];
  const buffer = viewDefinition && buffers[viewDefinition.buffer];
  if (!accessor || !viewDefinition || !reader || !components || !buffer) return undefined;
  const stride = viewDefinition.byteStride ?? reader.bytes * components;
  const start = (viewDefinition.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const end = start + Math.max(0, accessor.count - 1) * stride + reader.bytes * components;
  if (end > buffer.length) return undefined;
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let minimum = Infinity;
  let maximum = -Infinity;
  let absoluteMaximum = 0;
  const componentMaximum = Array.from({ length: components }, () => 0);
  for (let item = 0; item < accessor.count; item += 1) {
    for (let component = 0; component < components; component += 1) {
      const value = reader.read(dataView, start + item * stride + component * reader.bytes);
      if (!Number.isFinite(value)) continue;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
      absoluteMaximum = Math.max(absoluteMaximum, Math.abs(value));
      componentMaximum[component] = Math.max(componentMaximum[component], Math.abs(value));
    }
  }
  return { minimum, maximum, absoluteMaximum, componentMaximum };
}

/** Sprawdza, czy materiały i tekstury wskazują istniejące obrazy. */
function inspectTextureReferences(gltf, filePath, problems) {
  const textures = gltf.textures ?? [];
  const images = gltf.images ?? [];
  textures.forEach((texture, index) => {
    if (!Number.isInteger(texture.source) || !images[texture.source]) {
      problems.push(issue('error', 'missing-texture-source', `tekstura ${index} nie ma poprawnego obrazu`));
    }
  });
  images.forEach((image, index) => {
    if (Number.isInteger(image.bufferView)) {
      if (!gltf.bufferViews?.[image.bufferView]) {
        problems.push(issue('error', 'missing-image-buffer', `obraz ${index} wskazuje brakujący bufferView`));
      }
      return;
    }
    if (!image.uri) {
      problems.push(issue('error', 'missing-image-data', `obraz ${index} nie ma URI ani bufferView`));
      return;
    }
    if (!image.uri.startsWith('data:')) {
      const external = resolve(dirname(filePath), decodeURIComponent(image.uri.split(/[?#]/u)[0]));
      if (!existsSync(external)) {
        problems.push(issue('error', 'missing-image-file', `brak zewnętrznego obrazu: ${image.uri}`));
      }
    }
  });
  /** Rekurencyjnie sprawdza każde pole tekstury w strukturze materiału. */
  const visitMaterial = (value, path) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (key.endsWith('Texture') && child && typeof child === 'object') {
        if (!Number.isInteger(child.index) || !textures[child.index]) {
          problems.push(
            issue('error', 'missing-material-texture', `${childPath} wskazuje brakującą teksturę`),
          );
        }
      }
      visitMaterial(child, childPath);
    }
  };
  (gltf.materials ?? []).forEach((material, index) => visitMaterial(material, `materiał ${index}`));
}

/** Przeprowadza pełną walidację pojedynczego modelu GLB z katalogu assetów. */
function validateGlb(asset, filePath) {
  const problems = [];
  let parsed;
  try {
    parsed = parseGlb(filePath);
  } catch (error) {
    return {
      byteLength: existsSync(filePath) ? readFileSync(filePath).length : 0,
      problems: [issue('error', 'invalid-glb', error instanceof Error ? error.message : String(error))],
    };
  }

  const { json: gltf, binaryChunks, byteLength } = parsed;
  const meshes = gltf.meshes ?? [];
  const nodes = gltf.nodes ?? [];
  const skins = gltf.skins ?? [];
  const animations = gltf.animations ?? [];
  const materials = gltf.materials ?? [];
  const buffers = loadBuffers(gltf, binaryChunks, filePath, problems);
  if (meshes.length === 0) problems.push(issue('error', 'empty-model', 'model nie zawiera żadnego mesha'));

  nodes.forEach((node, index) => {
    if (node.mesh !== undefined && !meshes[node.mesh]) {
      problems.push(issue('error', 'missing-mesh', `node ${index} wskazuje brakujący mesh ${node.mesh}`));
    }
    if (node.skin !== undefined && !skins[node.skin]) {
      problems.push(issue('error', 'missing-skin', `node ${index} wskazuje brakujący skin ${node.skin}`));
    }
    const scale = node.scale ?? [1, 1, 1];
    if (scale.some((value) => !Number.isFinite(value) || Math.abs(value) < 1e-7 || Math.abs(value) > 1e4)) {
      problems.push(
        issue('error', 'extreme-node-scale', `node ${index} ma nieprawidłową skalę ${scale.join(', ')}`),
      );
    }
  });

  skins.forEach((skin, index) => {
    if (!Array.isArray(skin.joints) || skin.joints.length === 0) {
      problems.push(issue('error', 'empty-skin', `skin ${index} nie zawiera kości`));
    } else {
      skin.joints.forEach((joint) => {
        if (!nodes[joint])
          problems.push(
            issue('error', 'missing-joint', `skin ${index} wskazuje brakujący node kości ${joint}`),
          );
      });
    }
  });

  animations.forEach((animation, index) => {
    if (!animation.channels?.length || !animation.samplers?.length) {
      problems.push(
        issue('error', 'empty-animation', `animacja ${animation.name ?? index} nie ma kanałów lub samplerów`),
      );
    }
    animation.channels?.forEach((channel, channelIndex) => {
      if (!animation.samplers?.[channel.sampler]) {
        problems.push(
          issue(
            'error',
            'missing-animation-sampler',
            `animacja ${index}, kanał ${channelIndex}: brak samplera`,
          ),
        );
      }
      if (channel.target?.node !== undefined && !nodes[channel.target.node]) {
        problems.push(
          issue(
            'error',
            'missing-animation-node',
            `animacja ${index}, kanał ${channelIndex}: brak node celu`,
          ),
        );
      }
    });
    animation.samplers?.forEach((sampler, samplerIndex) => {
      if (!gltf.accessors?.[sampler.input] || !gltf.accessors?.[sampler.output]) {
        problems.push(
          issue(
            'error',
            'missing-animation-accessor',
            `animacja ${index}, sampler ${samplerIndex}: brak accessora wejścia lub wyjścia`,
          ),
        );
      }
    });
  });

  inspectTextureReferences(gltf, filePath, problems);
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], vertices: 0 };
  const positionAccessors = new Set();
  meshes.forEach((mesh, meshIndex) => {
    if (!mesh.primitives?.length)
      problems.push(issue('error', 'empty-mesh', `mesh ${meshIndex} nie ma primitives`));
    mesh.primitives?.forEach((primitive, primitiveIndex) => {
      const accessorIndex = primitive.attributes?.POSITION;
      if (!Number.isInteger(accessorIndex)) {
        problems.push(
          issue('error', 'missing-position', `mesh ${meshIndex}, primitive ${primitiveIndex}: brak POSITION`),
        );
      } else positionAccessors.add(accessorIndex);
      if (primitive.material !== undefined && !materials[primitive.material]) {
        problems.push(
          issue(
            'error',
            'missing-material',
            `mesh ${meshIndex}, primitive ${primitiveIndex}: brak materiału ${primitive.material}`,
          ),
        );
      }
    });
  });
  for (const accessorIndex of positionAccessors) {
    const inspected = inspectPositionAccessor(gltf, buffers, accessorIndex, problems);
    if (!inspected) continue;
    bounds.vertices += inspected.vertices;
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], inspected.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], inspected.max[axis]);
    }
  }
  const dimensions = bounds.min.every(Number.isFinite)
    ? bounds.max.map((value, axis) => value - bounds.min[axis])
    : undefined;
  if (!dimensions || dimensions.every((value) => value <= 1e-7)) {
    problems.push(issue('error', 'empty-bounds', 'nie udało się wyznaczyć niepustego bounding boxu'));
  } else if (Math.max(...dimensions) > 1e4) {
    problems.push(
      issue('error', 'extreme-bounds', `bounding box jest ekstremalny: ${dimensions.join(' × ')}`),
    );
  }

  const animationNames = animations.map((animation, index) => animation.name || `<bez nazwy ${index}>`);
  const animationMotion = {
    scale: { maximum: 0, clip: '', node: '' },
    translation: { maximum: 0, clip: '', node: '' },
  };
  animations.forEach((animation, animationIndex) => {
    animation.channels?.forEach((channel) => {
      const path = channel.target?.path;
      if (path !== 'scale' && path !== 'translation') return;
      const sampler = animation.samplers?.[channel.sampler];
      const range = sampler && inspectNumericAccessor(gltf, buffers, sampler.output);
      if (!range || range.absoluteMaximum <= animationMotion[path].maximum) return;
      animationMotion[path] = {
        maximum: range.absoluteMaximum,
        clip: animationNames[animationIndex],
        node: nodes[channel.target.node]?.name ?? String(channel.target.node ?? ''),
        nodeTranslation: nodes[channel.target.node]?.translation ?? [0, 0, 0],
        components: range.componentMaximum,
      };
    });
  });
  if (asset.kind === 'character-animation') {
    if (skins.length === 0)
      problems.push(issue('error', 'character-without-skin', 'paczka NPC nie ma skina'));
    const normalizedNames = new Set(animationNames.map((name) => name.toLowerCase()));
    requiredLocomotion.forEach((name) => {
      if (!normalizedNames.has(name.toLowerCase())) {
        problems.push(issue('error', 'missing-locomotion', `brak wymaganego klipu ${name}`));
      }
    });
  }
  if (materials.length === 0)
    problems.push(issue('warning', 'no-materials', 'model nie deklaruje materiałów'));

  const nodeScales = nodes.flatMap((node) => node.scale ?? [1, 1, 1]);
  return {
    byteLength,
    gltfVersion: gltf.asset?.version,
    generator: gltf.asset?.generator,
    meshes: meshes.length,
    vertices: bounds.vertices,
    skins: skins.length,
    joints: skins.reduce((maximum, skin) => Math.max(maximum, skin.joints?.length ?? 0), 0),
    animations: animationNames,
    animationMotion,
    materials: materials.length,
    textures: gltf.textures?.length ?? 0,
    bounds: dimensions ? { min: bounds.min, max: bounds.max, dimensions } : undefined,
    nodeScale: nodeScales.length ? { min: Math.min(...nodeScales), max: Math.max(...nodeScales) } : undefined,
    problems,
  };
}

const results = assets.map((asset) => {
  const filePath = join(publicAssets, ...asset.path.split('/'));
  if (!existsSync(filePath)) {
    return {
      ...asset,
      status: 'error',
      problems: [issue('error', 'missing-file', `brak pliku ${filePath}`)],
    };
  }
  const extension = extname(filePath).toLowerCase();
  let details;
  try {
    details =
      extension === '.glb'
        ? validateGlb(asset, filePath)
        : extension === '.wav'
          ? validateWav(filePath)
          : { byteLength: readFileSync(filePath).length, problems: [] };
  } catch (error) {
    details = {
      byteLength: readFileSync(filePath).length,
      problems: [issue('error', 'validation-crash', error instanceof Error ? error.message : String(error))],
    };
  }
  const allowedBlockers = knownBlockers[asset.id] ?? {};
  details.problems = details.problems.map((problem) => {
    const reason = allowedBlockers[problem.code];
    return problem.level === 'error' && reason
      ? { ...problem, level: 'blocker', message: `${problem.message}. ${reason}` }
      : problem;
  });
  const status = details.problems.some((problem) => problem.level === 'error')
    ? 'error'
    : details.problems.some((problem) => problem.level === 'blocker')
      ? 'blocked'
      : details.problems.length
        ? 'warning'
        : 'ok';
  return { ...asset, status, ...details };
});

const summary = {
  total: results.length,
  ok: results.filter((result) => result.status === 'ok').length,
  warnings: results.filter((result) => result.status === 'warning').length,
  blockers: results.filter((result) => result.status === 'blocked').length,
  errors: results.filter((result) => result.status === 'error').length,
};
const report = {
  generatedAt: new Date().toISOString(),
  catalog: 'src/game/assets/assetCatalog.json',
  summary,
  assets: results,
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

for (const result of results) {
  const marker =
    result.status === 'ok'
      ? 'OK'
      : result.status === 'warning'
        ? 'WARN'
        : result.status === 'blocked'
          ? 'BLOKER'
          : 'BLAD';
  const stats =
    result.meshes === undefined
      ? `${result.byteLength} B`
      : `${result.meshes} mesh, ${result.skins} skin, ${result.joints} kości, ${result.animations.length} animacji, ${result.materials} materiałów`;
  console.log(`[${marker}] ${result.label}: ${stats}`);
  result.problems.forEach((problem) =>
    console.log(`  - ${problem.level}: ${problem.code} — ${problem.message}`),
  );
}
console.log(`\nRaport: ${reportPath}`);
console.log(
  `Podsumowanie: ${summary.ok} OK, ${summary.warnings} ostrzeżeń, ${summary.blockers} blockerów, ${summary.errors} błędów.`,
);
if (summary.errors > 0) process.exit(1);
