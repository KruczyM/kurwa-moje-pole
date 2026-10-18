"""Rig static NPCs locally with Blender; retain existing skins and back up originals.

Default: inventory only. --execute builds drafts, --install also installs validated
outputs into the existing catalog paths. No network, paid services or API keys.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import shutil
import struct
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from animate_all_npcs import ROOT, glb_document, has_skin, inventory, validate_result


def validate_skin(path: Path) -> dict:
    """Check every exported vertex influence, including normalized integer data."""
    document = glb_document(path)
    if not has_skin(document):
        raise ValueError('Missing skeleton/skin')
    raw = path.read_bytes()
    json_length = struct.unpack_from('<I', raw, 12)[0]
    binary = memoryview(raw)[20 + json_length + 8:]
    formats = {5121: ('B', 1, 255), 5123: ('H', 2, 65535), 5126: ('f', 4, 1)}

    def accessor(index):
        a = document['accessors'][index]
        if a['type'] != 'VEC4' or a.get('sparse'):
            raise ValueError('Unsupported skin accessor')
        fmt, size, denominator = formats[a['componentType']]
        view = document['bufferViews'][a['bufferView']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = view.get('byteStride', size * 4)
        if offset + max(0, a['count'] - 1) * stride + size * 4 > len(binary):
            raise ValueError('Skin accessor outside buffer')
        return [tuple(v / denominator if a.get('normalized') else v for v in struct.unpack_from('<' + fmt * 4, binary, offset + i * stride)) for i in range(a['count'])]

    vertices = 0
    joints_used = set()
    for node in document.get('nodes', []):
        if 'mesh' not in node:
            continue
        if 'skin' not in node:
            raise ValueError('Unskinned mesh remains')
        joint_count = len(document['skins'][node['skin']]['joints'])
        for primitive in document['meshes'][node['mesh']]['primitives']:
            attributes = primitive['attributes']
            if not {'JOINTS_0', 'WEIGHTS_0'} <= attributes.keys():
                raise ValueError('Unweighted primitive')
            indices, weights = accessor(attributes['JOINTS_0']), accessor(attributes['WEIGHTS_0'])
            if len(indices) != len(weights) or len(weights) != document['accessors'][attributes['POSITION']]['count']:
                raise ValueError('Mismatched vertex counts')
            for ids, values in zip(indices, weights):
                if not all(math.isfinite(w) and 0 <= w <= 1 for w in values) or abs(sum(values) - 1) > 1e-4:
                    raise ValueError('Invalid or unnormalized weights')
                for joint, weight in zip(ids, values):
                    if int(joint) != joint or not 0 <= joint < joint_count:
                        raise ValueError('Invalid joint index')
                    if weight > .01:
                        joints_used.add(joint)
            vertices += len(weights)
    if vertices == 0 or len(joints_used) < 10:
        raise ValueError('Degenerate skin: insufficient weighted body joints')
    return {'weightedVertices': vertices, 'weightedJoints': len(joints_used)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--only', action='append', default=[])
    parser.add_argument('--jobs', type=int, choices=(1, 2), default=2)
    parser.add_argument('--blender', type=Path, default=Path(r'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe'))
    args = parser.parse_args()
    if args.install and not args.execute:
        parser.error('--install requires --execute')
    assets = inventory(json.loads((ROOT / 'src/game/assets/assetCatalog.json').read_text(encoding='utf-8')))
    if set(args.only) - {a['id'] for a in assets}:
        parser.error('Unknown asset id')
    if args.only:
        assets = [a for a in assets if a['id'] in args.only]
    if args.execute and not args.blender.is_file():
        parser.error('Missing local Blender')
    run = ROOT / 'reports/npc-rig-batch' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    run.mkdir(parents=True)
    report = {'visualVerification': 'VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN', 'results': []}

    def process(asset):
        source = ROOT / 'public/game-assets' / asset['source']
        row = {**asset, 'status': 'planned'}
        try:
            if has_skin(glb_document(source)):
                row.update(status='existing-rig-preserved', **validate_skin(source))
                return row
            if not args.execute:
                return row
            folder = run / asset['category'] / asset['id']
            folder.mkdir(parents=True)
            backup = folder / 'original.glb'
            shutil.copy2(source, backup)
            output = folder / 't-pose.glb'
            command = [str(args.blender), '--background', '--factory-startup', '--threads', '4', '--python-exit-code', '1',
                       '--python', str(ROOT / 'scripts/blender/rig-festival-npc.py'), '--', '--input', str(backup),
                       '--output', str(output), '--donor', str(ROOT / 'source-assets/animations/mixamo-motion-library.glb')]
            if asset['id'] == 'dino':
                command.append('--first-view')
            with (folder / 'blender.log').open('w', encoding='utf-8') as log:
                process_result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=600,
                                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            if process_result.returncode:
                raise RuntimeError(f'Blender exit {process_result.returncode}; see {folder}')
            animated = folder / 'npc-animations.glb'
            row.update(validate_skin(output))
            row.update(validate_skin(animated))
            row.update(validate_result(animated))
            row.update(rigReport=json.loads(output.with_suffix('.json').read_text()), backup=str(backup), output=str(animated), status='rigged-draft')
            if args.install:
                if source.read_bytes() != backup.read_bytes():
                    raise RuntimeError('Runtime source changed during rigging; preserving concurrent edits')
                # Validate before replacing. Copy through a sibling for atomic
                # replacement; the exact old runtime file is retained above.
                pending = source.with_suffix('.pending.glb')
                shutil.copy2(animated, pending)
                pending.replace(source)
                canonical = ROOT / 'source-assets/rigged-festival' / asset['id'] / 't-pose.glb'
                if not canonical.exists():
                    canonical.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(output, canonical)
                row['status'] = 'installed-draft'
        except (OSError, ValueError, RuntimeError, KeyError, struct.error, subprocess.TimeoutExpired) as error:
            row.update(status='failed', reason=str(error))
        return row

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for row in pool.map(process, assets):
            report['results'].append(row)
            (run / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
            print(f"{row['id']}: {row['status']}", flush=True)
    print(f'Report: {run / "report.json"}', flush=True)
    return 2 if any(r['status'] == 'failed' for r in report['results']) else 0


if __name__ == '__main__':
    raise SystemExit(main())
