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
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def arguments() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--clip", action="append", default=[])
    parser.add_argument("--library", action="append", default=[], type=Path)
    parser.add_argument("--exclude-library-clip", action="append", default=[])
    parser.add_argument("--retarget-library", action="append", default=[], type=Path)
    parser.add_argument("--retarget-clip", action="append", default=[])
    parser.add_argument("--exclude-retarget-clip", action="append", default=[])
    parser.add_argument("--base-unit-scale", type=float, default=1.0)
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


def canonical_objects(
    objects: list[bpy.types.Object],
    armature: bpy.types.Object,
) -> list[bpy.types.Object]:
    """Keep the rig and only meshes actually skinned to that rig."""
    skinned_meshes = [
        obj
        for obj in objects
        if obj.type == "MESH"
        and (
            obj.parent == armature
            or any(
                modifier.type == "ARMATURE" and modifier.object == armature
                for modifier in obj.modifiers
            )
        )
    ]
    if not skinned_meshes:
        raise RuntimeError("Base asset does not contain a mesh skinned to its armature")
    return [armature, *skinned_meshes]


def remove_base_helpers(
    imported: list[bpy.types.Object],
    kept: list[bpy.types.Object],
    armature: bpy.types.Object,
) -> None:
    """Remove cameras, lights and custom bone shapes that must not reach runtime GLB."""
    helpers = [obj for obj in imported if obj not in kept]
    helper_set = set(helpers)
    for pose_bone in armature.pose.bones:
        if pose_bone.custom_shape in helper_set:
            pose_bone.custom_shape = None
    remove_imported_objects(helpers)


def normalize_base_units(
    objects: list[bpy.types.Object],
    armature: bpy.types.Object,
    factor: float,
) -> None:
    """Scale mesh coordinates and rest bones together without changing skin weights."""
    if factor <= 0:
        raise RuntimeError("--base-unit-scale must be greater than zero")
    if abs(factor - 1.0) < 1e-9:
        return
    transform = Matrix.Scale(factor, 4)
    armature.data.transform(transform)
    transformed_meshes = set()
    for obj in objects:
        if obj.type == "MESH" and obj.data not in transformed_meshes:
            obj.data.transform(transform)
            transformed_meshes.add(obj.data)
    bpy.context.view_layer.update()


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


def action_source_name(action: bpy.types.Action, excluded: set[str]) -> str:
    """Recover a glTF clip name when Blender added a numeric collision suffix."""
    name = action.name
    base, separator, suffix = name.rpartition(".")
    if separator and suffix.isdigit() and base in excluded:
        return base
    return name


def bone_depth(bone: bpy.types.Bone) -> int:
    """Return hierarchy depth so parents are evaluated before their children."""
    depth = 0
    parent = bone.parent
    while parent:
        depth += 1
        parent = parent.parent
    return depth


def skeleton_span(armature: bpy.types.Object) -> float:
    """Measure a rig in armature space for proportional root translation."""
    points = [point for bone in armature.data.bones for point in (bone.head_local, bone.tail_local)]
    low = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    high = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return max((high - low).length, 1e-6)


def retarget_action(
    source_armature: bpy.types.Object,
    source_action: bpy.types.Action,
    target_armature: bpy.types.Object,
    wanted_name: str,
) -> bpy.types.Action:
    """Bake rest-pose-relative world rotations onto a differently proportioned rig."""
    source_data = source_armature.animation_data_create()
    source_data.action = source_action
    target_data = target_armature.animation_data_create()
    target_data.action = None

    source_action.name = f"__RetargetSource_{wanted_name}"
    result = bpy.data.actions.new(wanted_name)
    result.use_fake_user = True
    target_data.action = result

    target_bones = sorted(target_armature.data.bones, key=bone_depth)
    common_bones = [bone for bone in target_bones if bone.name in source_armature.pose.bones]
    if not common_bones:
        raise RuntimeError(f"{wanted_name}: source and target rigs have no common bones")

    scale_ratio = skeleton_span(target_armature) / skeleton_span(source_armature)
    source_start, source_end = source_action.frame_range
    sample_count = max(1, round(source_end - source_start))
    scene = bpy.context.scene

    for sample in range(sample_count + 1):
        source_frame = source_start + min(sample, source_end - source_start)
        output_frame = sample + 1
        integer_frame = math.floor(source_frame)
        scene.frame_set(integer_frame, subframe=source_frame - integer_frame)
        bpy.context.view_layer.update()

        source_pose_matrices = {
            bone.name: source_armature.pose.bones[bone.name].matrix.copy() for bone in common_bones
        }
        for pose_bone in target_armature.pose.bones:
            pose_bone.matrix_basis.identity()
            pose_bone.rotation_mode = "QUATERNION"
        bpy.context.view_layer.update()

        for bone in common_bones:
            source_bone = source_armature.data.bones[bone.name]
            source_matrix = source_pose_matrices[bone.name]
            rest_delta = (
                source_matrix.to_quaternion()
                @ source_bone.matrix_local.to_quaternion().inverted()
            )
            desired_rotation = rest_delta @ bone.matrix_local.to_quaternion()
            pose_bone = target_armature.pose.bones[bone.name]
            desired_location = pose_bone.matrix.translation.copy()
            if bone.parent is None:
                source_displacement = source_matrix.translation - source_bone.head_local
                desired_location = bone.head_local + source_displacement * scale_ratio
            pose_bone.matrix = Matrix.LocRotScale(
                desired_location,
                desired_rotation,
                Vector((1.0, 1.0, 1.0)),
            )
            bpy.context.view_layer.update()

        for bone in common_bones:
            pose_bone = target_armature.pose.bones[bone.name]
            pose_bone.keyframe_insert("location", frame=output_frame, group=bone.name)
            pose_bone.keyframe_insert("rotation_quaternion", frame=output_frame, group=bone.name)
            pose_bone.keyframe_insert("scale", frame=output_frame, group=bone.name)

    source_data.action = None
    target_data.action = None
    return result


def collect_retargeted_library(
    path: Path,
    target_armature: bpy.types.Object,
    excluded: set[str],
) -> list[bpy.types.Action]:
    """Import a donor library and bake its clips onto the canonical target rig."""
    objects, actions = import_asset(path)
    source_armature = armature_from(objects, path)
    target_bones = bone_names(target_armature)
    source_bones = bone_names(source_armature)
    missing = sorted(target_bones - source_bones)
    if missing:
        raise RuntimeError(f"{path}: donor rig is missing target bones: {missing}")

    kept = []
    for action in actions:
        source_name = action_source_name(action, excluded)
        if source_name in excluded:
            bpy.data.actions.remove(action)
            continue
        kept.append(retarget_action(source_armature, action, target_armature, source_name))
        bpy.data.actions.remove(action)

    remove_imported_objects(objects)
    return kept


def collect_retargeted_action(
    path: Path,
    wanted_name: str,
    target_armature: bpy.types.Object,
) -> bpy.types.Action:
    """Import one clip and bake it onto the target rig, including unit conversion."""
    objects, actions = import_asset(path)
    source_armature = armature_from(objects, path)
    missing = sorted(bone_names(target_armature) - bone_names(source_armature))
    if missing:
        raise RuntimeError(f"{path}: donor rig is missing target bones: {missing}")
    if len(actions) != 1:
        raise RuntimeError(f"{path}: expected one action, found {len(actions)}")
    source_action = actions[0]
    result = retarget_action(source_armature, source_action, target_armature, wanted_name)
    bpy.data.actions.remove(source_action)
    remove_imported_objects(objects)
    return result


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
    imported_base_objects, base_actions = import_asset(args.base)
    base_armature = armature_from(imported_base_objects, args.base)
    base_objects = canonical_objects(imported_base_objects, base_armature)
    remove_base_helpers(imported_base_objects, base_objects, base_armature)
    normalize_base_units(base_objects, base_armature, args.base_unit_scale)
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

    retarget_excluded = set(args.exclude_retarget_clip)
    for library_path in args.retarget_library:
        for action in collect_retargeted_library(
            library_path,
            base_armature,
            retarget_excluded,
        ):
            if action.name in named_actions:
                bpy.data.actions.remove(named_actions[action.name])
            named_actions[action.name] = action

    for item in args.retarget_clip:
        if "=" not in item:
            raise RuntimeError(f"Invalid --retarget-clip value: {item}; expected Name=path")
        name, raw_path = item.split("=", 1)
        if name in named_actions:
            bpy.data.actions.remove(named_actions[name])
        named_actions[name] = collect_retargeted_action(
            Path(raw_path),
            name,
            base_armature,
        )

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
