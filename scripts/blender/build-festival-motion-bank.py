"""Compile user FBX files into one shared motion bank and auditable manifest.

Uses the project's existing importer/exporter; originals are never modified.
Deduplicates evaluated bone motion, preferring matching packs over loose files.
"""
import argparse
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

import bpy
import numpy as np


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    spec = importlib.util.spec_from_file_location('builder', Path(__file__).with_name('build-character-animation-library.py'))
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    api.reset()
    base = args.source / 'Locomotion Pack/pierscien-mixamo-upload.fbx'
    objects, initial_actions = api.import_asset(base)
    rig = api.armature_from(objects, base)
    kept = api.canonical_objects(objects, rig)
    api.remove_base_helpers(objects, kept, rig)
    rig.animation_data_clear()
    for action in initial_actions:
        bpy.data.actions.remove(action)
    names = api.bone_names(rig)
    rest = {b.name: np.array(b.matrix_local) for b in rig.data.bones}
    rig.name = '__MotionBank'
    paths = sorted(args.source.rglob('*.fbx'), key=lambda p: (0 if p.parent != args.source else 1, p.as_posix().lower()))
    rows, actions, fingerprints, used_names = [], [], {}, set()
    for path in paths:
        relative = path.relative_to(args.source).as_posix()
        if path.name.lower() == 'pierscien-mixamo-upload.fbx':
            rows.append({'source': relative, 'status': 'base-character'})
            continue
        imported, imported_actions = api.import_asset(path)
        donor = api.armature_from(imported, path)
        if not names.issubset(api.bone_names(donor)) or len(imported_actions) != 1:
            raise RuntimeError(f'Incompatible bones/action count: {relative}')
        retarget = any(not np.allclose(np.array(donor.data.bones[n].matrix_local), rest[n], atol=1e-3) for n in names)
        action = imported_actions[0]
        donor.animation_data_create().action = action
        start, end = action.frame_range
        samples = []
        bone_order = sorted(names)
        for frame in range(round(start), round(end) + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            samples.extend(float(value) for name in bone_order for row in donor.pose.bones[name].matrix for value in row)
        fingerprint = hashlib.sha256(np.round(np.array(samples), 5).astype('<f4').tobytes()).hexdigest()
        donor.animation_data.action = None
        if fingerprint in fingerprints:
            clip_name = fingerprints[fingerprint]
            bpy.data.actions.remove(action)
            status = 'duplicate'
        else:
            stem = re.sub(r'\((\d+)\)', r' Variant \1', path.stem)
            clip_name = ''.join(word[:1].upper() + word[1:] for word in re.findall(r'[A-Za-z0-9]+', stem))
            if path.parent.name == 'Locomotion Pack':
                clip_name = {'Walking': 'Walk', 'Running': 'Run'}.get(clip_name, clip_name)
            if clip_name in used_names:
                clip_name += 'Loose' if path.parent == args.source else 'Pack'
            if clip_name in used_names:
                raise RuntimeError(f'Name collision: {relative}')
            if retarget:
                original = action
                action = api.retarget_action(donor, original, rig, clip_name)
                bpy.data.actions.remove(original)
            action.name = clip_name
            action.use_fake_user = True
            actions.append(action)
            used_names.add(clip_name)
            fingerprints[fingerprint] = clip_name
            status = 'included'
        rows.append({'source': relative, 'clip': clip_name, 'status': status, 'motionHash': fingerprint,
                     'duration': float(end - start) / bpy.context.scene.render.fps})
        api.remove_imported_objects(imported)
        print(f'{relative}: {status} -> {clip_name}', flush=True)
    api.attach_actions(rig, actions)
    api.export_glb(args.output, kept, animations=True)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps({'clips': sorted(used_names), 'files': rows}, indent=2), encoding='utf-8')
    print(f'MOTION_BANK_OK clips={len(actions)} files={len(rows)}')


if __name__ == '__main__':
    main()
