"""Local draft T-pose auto-rig. Preserves textures; never changes the input file.

Fits a Mixamo-compatible body rig, uses Blender bone-heat weights, and fills
unweighted islands with smooth nearest-segment weights. No external services.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector


def library():
    path = Path(__file__).with_name('build-character-animation-library.py')
    spec = importlib.util.spec_from_file_location('animation_builder', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def bind(meshes, rig):
    bpy.ops.object.select_all(action='DESELECT')
    for mesh in meshes:
        mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    heat_error = None
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except RuntimeError as error:
        heat_error = str(error)
    bones = list(rig.data.bones)
    starts = np.array([list(b.head_local) for b in bones])
    ends = np.array([list(b.tail_local) for b in bones])
    segments = ends - starts
    head_index = next(i for i, b in enumerate(bones) if b.name == 'mixamorig:Head')
    head_start = starts[head_index, 2]
    repaired = 0
    total = 0
    for mesh in meshes:
        if not any(m.type == 'ARMATURE' for m in mesh.modifiers):
            modifier = mesh.modifiers.new('NPC skin', 'ARMATURE')
            modifier.object = rig
        mesh.parent = rig
        groups = [mesh.vertex_groups.get(b.name) or mesh.vertex_groups.new(name=b.name) for b in bones]
        valid_indices = {g.index for g in groups}
        for vertex in mesh.data.vertices:
            weights = [(g.group, g.weight) for g in vertex.groups if g.group in valid_indices and np.isfinite(g.weight) and g.weight > 1e-7]
            if not weights:
                p = np.array(vertex.co)
                t = np.clip(np.sum((p - starts) * segments, axis=1) / np.sum(segments * segments, axis=1), 0, 1)
                distance = np.linalg.norm(p - (starts + t[:, None] * segments), axis=1)
                nearest = np.argsort(distance)[:4]
                raw = 1 / np.maximum(distance[nearest], .015) ** 4
                raw /= raw.sum()
                # Keep hats/hair/upper accessories with the head instead of
                # stretching them towards nearby moving upper-arm bones.
                # Do not capture the upper surface of thick T-pose sleeves.
                head_blend = float(np.clip((p[2] - (head_start + .13)) / .12, 0, 1))
                merged = {int(i): float(w) * (1 - head_blend) for i, w in zip(nearest, raw)}
                merged[head_index] = merged.get(head_index, 0) + head_blend
                weights = [(groups[i].index, w) for i, w in merged.items() if w > 1e-7]
                repaired += 1
            weights = sorted(weights, key=lambda entry: entry[1], reverse=True)[:4]
            normalizer = sum(w for _, w in weights)
            for group in list(vertex.groups):
                mesh.vertex_groups[group.group].remove([vertex.index])
            for group, weight in weights:
                mesh.vertex_groups[group].add([vertex.index], weight / normalizer, 'REPLACE')
            total += 1
    # Validate all vertices, not just existence of a skin in the GLB header.
    for mesh in meshes:
        for vertex in mesh.data.vertices:
            weights = [g.weight for g in vertex.groups]
            if not weights or len(weights) > 4 or not all(np.isfinite(w) and w > 0 for w in weights) or abs(sum(weights) - 1) > 1e-5:
                raise RuntimeError(f'Invalid weights: {mesh.name}, vertex {vertex.index}')
    return {'vertices': total, 'fallbackVertices': repaired,
            'heatWarning': heat_error or ('Bone heat left unweighted vertices; geometric fallback used' if repaired else None)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--donor', type=Path)
    parser.add_argument('--first-view', action='store_true', help='Explicit repair of the four-view dino source')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    if args.input.resolve() == args.output.resolve():
        raise RuntimeError('Refusing to overwrite the source')
    api = library()
    api.reset()
    objects, actions = api.import_asset(args.input)
    meshes = [o for o in objects if o.type == 'MESH']
    if not meshes:
        raise RuntimeError('No mesh')
    if any(o.type == 'ARMATURE' for o in objects):
        raise RuntimeError('Already rigged: preserve existing rig')
    for mesh in meshes:
        matrix = mesh.matrix_world.copy()
        mesh.parent = None
        mesh.matrix_world.identity()
        mesh.data.transform(matrix)
    points = np.array([tuple(v.co) for mesh in meshes for v in mesh.data.vertices])
    if args.first_view:
        if np.ptp(points[:, 0]) < np.ptp(points[:, 2]) * 1.7:
            raise RuntimeError('Dino repair expects the known wide four-view source, not a single character')
        # Source is a four-view turntable baked into a single mesh. Keep only
        # the leftmost, front-facing figure; originals remain in the backup.
        threshold = points[:, 0].min() + np.ptp(points[:, 0]) * .255
        feet = points[(points[:, 0] < threshold) & (points[:, 2] < points[:, 2].min() + np.ptp(points[:, 2]) * .18)]
        center_x = float((feet[:, 0].min() + feet[:, 0].max()) / 2)
        for mesh in meshes:
            bm = bmesh.new()
            bm.from_mesh(mesh.data)
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > threshold], context='VERTS')
            # Front/back figures have fused hands. Reconstruct the missing
            # right half from the intact left half of this symmetric costume,
            # instead of exporting a severed arm from a rectangular crop.
            for vertex in bm.verts:
                vertex.co.x -= center_x
            bmesh.ops.symmetrize(bm, input=list(bm.verts) + list(bm.edges) + list(bm.faces), direction='-X', dist=1e-5)
            bm.to_mesh(mesh.data)
            bm.free()
        points = np.array([tuple(v.co) for mesh in meshes for v in mesh.data.vertices])
    low, high = points.min(axis=0), points.max(axis=0)
    height = high[2] - low[2]
    if not np.isfinite(height) or height <= 0:
        raise RuntimeError('Invalid bounds')
    # Fixed physical height, centered X/Y and grounded. Preserve UV/materials.
    center = np.array([(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, low[2]])
    factor = 2.45 / height
    for mesh in meshes:
        for vertex in mesh.data.vertices:
            vertex.co = Vector((np.array(vertex.co) - center) * factor)
    points = (points - center) * factor
    half_width = np.quantile(np.abs(points[:, 0]), .995)
    outer = points[np.abs(points[:, 0]) > half_width * .7]
    shoulder = float(np.clip(np.median(outer[:, 2]), 1.35, 1.9))
    arm_y = float(np.median(outer[:, 1]))
    hip = shoulder * .57
    leg_x = min(.25, half_width * .19)
    data = bpy.data.armatures.new('FestivalBodyRig')
    rig = bpy.data.objects.new('FestivalBodyRig', data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')

    def bone(name, head, tail, parent=None):
        b = data.edit_bones.new('mixamorig:' + name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = data.edit_bones['mixamorig:' + parent]
        return b

    bone('Hips', (0, 0, hip), (0, 0, hip + .12))
    bone('Spine', (0, 0, hip + .12), (0, 0, hip + (shoulder - hip) * .45), 'Hips')
    bone('Spine1', (0, 0, hip + (shoulder - hip) * .45), (0, 0, shoulder - .14), 'Spine')
    bone('Spine2', (0, 0, shoulder - .14), (0, 0, shoulder), 'Spine1')
    bone('Neck', (0, 0, shoulder), (0, 0, shoulder + .17), 'Spine2')
    bone('Head', (0, 0, shoulder + .17), (0, 0, 2.4), 'Neck')
    for side, sign in [('Left', 1), ('Right', -1)]:
        a, e, w, h = [sign * half_width * f for f in (.34, .62, .84, .99)]
        bone(side + 'Shoulder', (sign * .08, 0, shoulder), (a, arm_y, shoulder), 'Spine2')
        bone(side + 'Arm', (a, arm_y, shoulder), (e, arm_y, shoulder), side + 'Shoulder')
        bone(side + 'ForeArm', (e, arm_y, shoulder), (w, arm_y, shoulder), side + 'Arm')
        bone(side + 'Hand', (w, arm_y, shoulder), (h, arm_y, shoulder), side + 'ForeArm')
        x = sign * leg_x
        bone(side + 'UpLeg', (x, 0, hip), (x, -.025, hip * .52), 'Hips')
        bone(side + 'Leg', (x, -.025, hip * .52), (x, 0, .16), side + 'UpLeg')
        bone(side + 'Foot', (x, 0, .16), (x, -.19, .075), side + 'Leg')
        bone(side + 'ToeBase', (x, -.19, .075), (x, -.32, .06), side + 'Foot')
    bpy.ops.object.mode_set(mode='OBJECT')
    stats = bind(meshes, rig)
    kept = [rig, *meshes]
    api.export_glb(args.output, kept, animations=False)
    clips = []
    if args.donor:
        excluded = {'Breakdance1990', 'Capoeira', 'DrunkWalkingTurn', 'Floating', 'HipHopDancing', 'LowCrawl', 'SittingLaughing', 'SneakWalk', 'SwimmingToEdge', 'SwingToLand'}
        clips = api.collect_retargeted_library(args.donor, rig, excluded)
        api.attach_actions(rig, clips)
        api.export_glb(args.output.with_name('npc-animations.glb'), kept, animations=True)
    report = {'input': str(args.input), 'output': str(args.output), 'bones': len(data.bones),
              'clips': [a.name for a in clips], 'firstViewExtracted': args.first_view,
              'quality': 'automatic-draft-needs-visual-review', **stats}
    args.output.with_suffix('.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
