"""Build one GLB animation library on top of a canonical Mixamo character.

The canonical FBX supplies the mesh, materials, skin weights and armature.
Animation files may contain skin; their duplicate meshes are discarded. Actions
are assigned to the canonical armature by matching Mixamo bone names.

Example:
  blender --background --factory-startup --python this-file.py -- \
    --base T-Pose.fbx --clip "Idle=Neutral Idle.fbx" \
    --clip "Walk=Walking.fbx" --output npc-animations.glb
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--clip", action="append", default=[])
    parser.add_argument("--library", action="append", default=[], type=Path)
    parser.add_argument("--exclude-library-clip", action="append", default=[])
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--t-pose-output", type=Path)
    return parser.parse_args(argv)


def reset() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def import_asset(path: Path) -> tuple[list[bpy.types.Object], list[bpy.types.Action]]:
    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    suffix = path.suffix.lower()
    if suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path.resolve()))
    elif suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    else:
        raise RuntimeError(f"Unsupported input format: {path}")
    return (
        [obj for obj in bpy.data.objects if obj not in before_objects],
        [action for action in bpy.data.actions if action not in before_actions],
    )


def armature_from(objects: list[bpy.types.Object], source: Path) -> bpy.types.Object:
    armatures = [obj for obj in objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"{source}: expected one armature, found {len(armatures)}")
    return armatures[0]


def bone_names(armature: bpy.types.Object) -> set[str]:
    return {bone.name for bone in armature.data.bones}


def remove_imported_objects(objects: list[bpy.types.Object]) -> None:
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


def collect_action(
    path: Path,
    wanted_name: str,
    canonical_bones: set[str],
) -> bpy.types.Action:
    objects, actions = import_asset(path)
    imported_armature = armature_from(objects, path)
    imported_bones = bone_names(imported_armature)
    if imported_bones != canonical_bones:
        missing = sorted(canonical_bones - imported_bones)
        extra = sorted(imported_bones - canonical_bones)
        raise RuntimeError(f"{path}: incompatible rig; missing={missing}, extra={extra}")
    if len(actions) != 1:
        raise RuntimeError(f"{path}: expected one action, found {len(actions)}")
    action = actions[0]
    action.name = wanted_name
    action.use_fake_user = True
    remove_imported_objects(objects)
    return action


def collect_library(
    path: Path,
    canonical_bones: set[str],
    excluded: set[str],
) -> list[bpy.types.Action]:
    objects, actions = import_asset(path)
    imported_armature = armature_from(objects, path)
    if bone_names(imported_armature) != canonical_bones:
        raise RuntimeError(f"{path}: library armature is incompatible with canonical rig")
    kept = []
    for action in actions:
        if action.name in excluded:
            bpy.data.actions.remove(action)
            continue
        action.use_fake_user = True
        kept.append(action)
    remove_imported_objects(objects)
    return kept


def select_canonical(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        if obj.name in bpy.data.objects:
            obj.select_set(True)


def attach_actions(armature: bpy.types.Object, actions: list[bpy.types.Action]) -> None:
    animation_data = armature.animation_data_create()
    animation_data.action = None
    for track in list(animation_data.nla_tracks):
        animation_data.nla_tracks.remove(track)
    for action in actions:
        # Assigning each action once binds its Blender 5 action slot to the
        # canonical armature. The glTF ACTIONS exporter can then serialize the
        # clips independently, without evaluating overlapping NLA tracks.
        animation_data.action = action
    animation_data.action = None


def export_glb(path: Path, objects: list[bpy.types.Object], animations: bool) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    select_canonical(objects)
    options = dict(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_animations=animations,
        export_apply=False,
    )
    if animations:
        options.update(
            export_animation_mode="ACTIONS",
            export_nla_strips=False,
            export_force_sampling=True,
        )
    bpy.ops.export_scene.gltf(**options)


def main() -> None:
    args = arguments()
    reset()
    base_objects, base_actions = import_asset(args.base)
    base_armature = armature_from(base_objects, args.base)
    canonical_bones = bone_names(base_armature)
    canonical_armature_name = base_armature.name
    for action in base_actions:
        bpy.data.actions.remove(action)

    if args.t_pose_output:
        export_glb(args.t_pose_output, base_objects, animations=False)

    # Keep the original armature name free while importing clips. Blender 5
    # action slots encode the target object name (for example OBArmature). If
    # the canonical object occupied that name, imported actions would target
    # Armature.001 and could be evaluated against the wrong slot after merge.
    base_armature.name = "__CanonicalArmature"

    named_actions: dict[str, bpy.types.Action] = {}
    excluded = set(args.exclude_library_clip)
    for library_path in args.library:
        for action in collect_library(library_path, canonical_bones, excluded):
            if action.name in named_actions:
                raise RuntimeError(f"Duplicate action: {action.name}")
            named_actions[action.name] = action

    for item in args.clip:
        if "=" not in item:
            raise RuntimeError(f"Invalid --clip value: {item}; expected Name=path")
        name, raw_path = item.split("=", 1)
        if name in named_actions:
            bpy.data.actions.remove(named_actions[name])
        named_actions[name] = collect_action(Path(raw_path), name, canonical_bones)

    actions = [named_actions[name] for name in sorted(named_actions)]
    base_armature.name = canonical_armature_name
    attach_actions(base_armature, actions)
    export_glb(args.output, base_objects, animations=True)
    print(json.dumps({
        "status": "ok",
        "bones": len(canonical_bones),
        "clips": [action.name for action in actions],
        "output": str(args.output.resolve()),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
