"""Bake user-supplied Mixamo motion to lightweight, fixed-pivot 2D atlases.

Run with Blender --background --python this-file.py -- --source DIR --models DIR
--output DIR [--characters amper korba] [--samples 8]. Never edits source models.
Rest-relative retargeting follows the existing character animation library builder.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

CLIPS = {
    "idle": "Fighting Idle.fbx",
    "jab": "Punching.fbx",
    "cross": "Cross Punch.fbx",
    "hook": "Hook.fbx",
    "elbow": "Illegal Elbow Punch.fbx",
    "kick": "Mma Kick.fbx",
    "heavy_kick": "Inside Crescent Kick.fbx",
    "uppercut": "Uppercut.fbx",
    "air_kick": "Drop Kick.fbx",
    "hit_head": "Head Hit.fbx",
    "hit_body": "Rib Hit.fbx",
    "fall": "Flying Back Death.fbx",
    "get_up": "Getting Up.fbx",
    "block": "Fighting Idle.fbx",
    "walk": "@Walk",
    "crouch": "@SneakWalk",
}


def key(name):
    return name.lower().replace("mixamorig", "").replace(":", "").split(".")[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--models", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--characters", nargs="+", default=["amper", "korba"])
    parser.add_argument("--samples", type=int, default=8)
    parser.add_argument("--size", type=int, default=192)
    parser.add_argument("--inspect", action="store_true")
    parser.add_argument("--clips", nargs="+", choices=list(CLIPS))
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if not 4 <= args.samples <= 12 or not 128 <= args.size <= 256:
        raise ValueError("samples must be 4..12; size must be 128..256")
    spec = importlib.util.spec_from_file_location("animation_builder", Path(__file__).parents[1] / "blender/build-character-animation-library.py")
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    api.reset()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = args.size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.fps = 30
    scene.view_settings.view_transform = "Standard"
    # PIL is not bundled with Blender; atlases are assembled using Blender pixels.
    import numpy as np
    camera_data = bpy.data.cameras.new("CombatCamera")
    camera_data.type = "ORTHO"
    camera = bpy.data.objects.new("CombatCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    for name, rotation, energy in [("Key", (40, -20, 30), 2.5), ("Fill", (65, 20, -120), 1.3)]:
        data = bpy.data.lights.new(name, "SUN")
        data.energy = energy
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.rotation_euler = tuple(math.radians(v) for v in rotation)
    donors = {}
    for filename in sorted(set(CLIPS.values())):
        if filename.startswith("@"):
            continue
        path = args.source / filename
        imported, actions = api.import_asset(path)
        arm = api.armature_from(imported, path)
        if len(actions) != 1:
            raise RuntimeError(f"Expected exactly one action: {path}")
        for obj in imported:
            obj.hide_render = True
        arm.animation_data_create().action = actions[0]
        donors[filename] = (arm, actions[0], {key(b.name): b for b in arm.data.bones})
    # A shared existing locomotion donor also covers characters with sparse clips.
    locomotion_path = args.models / "amper/npc-animations.glb"
    loco_objects, loco_actions = api.import_asset(locomotion_path)
    loco = api.armature_from(loco_objects, locomotion_path)
    for obj in loco_objects:
        obj.hide_render = True
    for clip in ["Walk", "SneakWalk"]:
        action = next(a for a in loco_actions if a.name.split(".")[0] == clip)
        donors[f"@{clip}"] = (loco, action, {key(b.name): b for b in loco.data.bones})
    for char_id in args.characters:
        source = args.models / char_id / "npc-animations.glb"
        imported, original_actions = api.import_asset(source)
        target = api.armature_from(imported, source)
        kept = api.canonical_objects(imported, target)
        api.remove_base_helpers(imported, kept, target)
        imported = kept
        if args.inspect:
            print(f"COMBAT_ACTIONS {[(a.name, tuple(a.frame_range)) for a in original_actions]}", flush=True)
        for obj in imported:
            obj.animation_data_clear()
        bones = sorted(target.data.bones, key=api.bone_depth)
        target.animation_data_create().action = None
        for bone in target.pose.bones:
            bone.matrix_basis.identity()
        bpy.context.view_layer.update()
        meshes = [o for o in imported if o.type == "MESH"]
        roots = {o: o.location.copy() for o in imported if o.parent not in imported}
        ground_z = None
        depsgraph = bpy.context.evaluated_depsgraph_get()
        points = []
        for obj in meshes:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            points.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
            evaluated.to_mesh_clear()
        low = min(v.z for v in points)
        high = max(v.z for v in points)
        height = high - low
        print(f"COMBAT_BOUNDS {char_id} height={height} low={low} arm_scale={tuple(target.scale)}", flush=True)
        center = Vector(((min(v.x for v in points) + max(v.x for v in points)) / 2,
                         (min(v.y for v in points) + max(v.y for v in points)) / 2, low))
        # Fixed camera and scale for ALL clips, including fall/get-up. No frame fitting.
        camera_data.ortho_scale = height * 1.85
        yaw = math.radians(78)
        camera.location = center + Vector((10 * math.sin(yaw), -10 * math.cos(yaw), height * .66))
        camera.rotation_euler = (Vector((center.x, center.y, low + height * .66)) - camera.location).to_track_quat("-Z", "Y").to_euler()
        out = args.output / char_id
        out.mkdir(parents=True, exist_ok=True)
        metadata = {"version": 1, "characterId": char_id, "size": args.size, "columns": args.samples,
                    "pivot": [0.5, 0.5 + .66 / 1.85], "worldSize": 140 * 1.85, "facing": -1,
                    "modelSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "clips": {}}
        if args.clips and (out / "manifest.json").exists():
            metadata = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
        for clip, filename in CLIPS.items():
            if args.clips and clip not in args.clips and clip != "idle":
                continue
            donor, action, source_bones = donors[filename]
            basis = target.matrix_world.to_quaternion().inverted() @ donor.matrix_world.to_quaternion()
            ratio = api.skeleton_span(target) / api.skeleton_span(donor)
            start, end = action.frame_range
            pixels = np.zeros((args.size, args.size * args.samples, 4), dtype=np.float32)
            for sample in range(args.samples):
                for obj, location in roots.items():
                    obj.location = location.copy()
                donor.animation_data_create().action = action
                frame = start + (end - start) * sample / (args.samples - 1)
                scene.frame_set(math.floor(frame), subframe=frame % 1)
                bpy.context.view_layer.update()
                poses = {k: donor.pose.bones[b.name].matrix.copy() for k, b in source_bones.items()}
                if donor == target:
                    target.animation_data.action = None
                for bone in target.pose.bones:
                    bone.matrix_basis.identity()
                    bone.rotation_mode = "QUATERNION"
                bpy.context.view_layer.update()
                common = 0
                for bone in bones:
                    sb = source_bones.get(key(bone.name))
                    if sb is None:
                        continue
                    common += 1
                    sm = poses[key(bone.name)]
                    delta = basis @ (sm.to_quaternion() @ sb.matrix_local.to_quaternion().inverted()) @ basis.inverted()
                    pb = target.pose.bones[bone.name]
                    location = pb.matrix.translation.copy()
                    if bone.parent is None:
                        displacement = (basis @ (sm.translation - sb.head_local)) * ratio
                        # Simulation owns travel and jumps; preserve vertical pose only.
                        world_displacement = target.matrix_world.to_quaternion() @ displacement
                        world_displacement.x = world_displacement.y = 0
                        location = bone.head_local + target.matrix_world.to_quaternion().inverted() @ world_displacement
                    pb.matrix = Matrix.LocRotScale(location, delta @ bone.matrix_local.to_quaternion(), Vector((1, 1, 1)))
                    bpy.context.view_layer.update()
                if common < 15:
                    raise RuntimeError(f"Insufficient matching bones for {char_id}: {common}")
                # Remove baked root travel, not the pose: feet share one ground plane.
                evaluated_points = []
                depsgraph = bpy.context.evaluated_depsgraph_get()
                for obj in meshes:
                    evaluated = obj.evaluated_get(depsgraph)
                    mesh = evaluated.to_mesh()
                    evaluated_points.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
                    evaluated.to_mesh_clear()
                pose_floor = min(v.z for v in evaluated_points)
                if ground_z is None:
                    ground_z = pose_floor
                for obj in roots:
                    obj.location.z += ground_z - pose_floor
                bpy.context.view_layer.update()
                if sample == 0 and clip == "idle":
                    print(f"COMBAT_POSE {char_id} {[(b.name, tuple(b.matrix.translation)) for b in target.pose.bones if key(b.name) == 'hips']}", flush=True)
                    print(f"COMBAT_REST {[(b.name, tuple(b.matrix_local.to_scale()), tuple(target.pose.bones[b.name].scale)) for b in bones[:3]]}", flush=True)
                    ev = meshes[0].evaluated_get(bpy.context.evaluated_depsgraph_get())
                    em = ev.to_mesh()
                    ep = [ev.matrix_world @ v.co for v in em.vertices]
                    print(f"COMBAT_EVALUATED low={tuple(min(v[i] for v in ep) for i in range(3))} high={tuple(max(v[i] for v in ep) for i in range(3))}", flush=True)
                    camera.location.z = ground_z + height * .66
                    ev.to_mesh_clear()
                    if args.inspect:
                        return
                if args.clips and clip not in args.clips:
                    break
                # Guard is derived explicitly from fighting idle, not a nonexistent block FBX.
                if clip == "block":
                    for bone in target.pose.bones:
                        if "forearm" in key(bone.name):
                            bone.rotation_quaternion = bone.rotation_quaternion @ Vector((1, 0, 0)).rotation_difference(Vector((.4, 0, .9)))
                    bpy.context.view_layer.update()
                # Render Result pixels may be empty in background mode; reload the frame.
                temporary = out / "__frame.png"
                scene.render.filepath = str(temporary)
                bpy.ops.render.render(write_still=True)
                image = bpy.data.images.load(str(temporary), check_existing=False)
                buffer = np.empty(args.size * args.size * 4, dtype=np.float32)
                image.pixels.foreach_get(buffer)
                pixels[:, sample * args.size:(sample + 1) * args.size, :] = buffer.reshape(args.size, args.size, 4)
                bpy.data.images.remove(image)
            if args.clips and clip not in args.clips:
                continue
            atlas = bpy.data.images.new(f"{char_id}_{clip}", width=args.size * args.samples, height=args.size, alpha=True)
            atlas.pixels.foreach_set(pixels.ravel())
            atlas.filepath_raw = str(out / f"{clip}.png")
            atlas.file_format = "PNG"
            atlas.save()
            bpy.data.images.remove(atlas)
            temporary.unlink(missing_ok=True)
            metadata["clips"][clip] = {"file": f"{clip}.png", "frames": args.samples,
                "durationTicks": max(1, round((end - start) * 2)),
                "source": filename, "sourceSha256": hashlib.sha256((locomotion_path if filename.startswith("@") else args.source / filename).read_bytes()).hexdigest(),
                "derivedGuard": clip == "block"}
            print(f"COMBAT_CLIP_READY {char_id} {clip}", flush=True)
        (out / "manifest.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
        for action in original_actions:
            if action.users == 0:
                bpy.data.actions.remove(action)
        print(f"COMBAT_CHARACTER_READY {char_id}", flush=True)


if __name__ == "__main__":
    main()
