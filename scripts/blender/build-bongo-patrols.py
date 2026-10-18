"""Fit a lowered-arm rig to the existing Bongo mesh and author root-motion-free local gait.

No generators, downloads or API keys. Preserve the source and shared After models.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]


def material_variant(meshes, kind):
    """Recolor only strongly red fabric through shader nodes, preserving painted surface detail."""
    if kind == 'patrol-red-v3':
        return
    target = (0.07, 0.28, 0.8, 1) if kind == 'patrol-blue-v3' else (0.13, 0.16, 0.2, 1)
    for mesh in meshes:
        for slot in mesh.material_slots:
            material = slot.material
            if not material or not material.use_nodes:
                continue
            material = material.copy()
            slot.material = material
            nodes, links = material.node_tree.nodes, material.node_tree.links
            shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
            color = shader.inputs['Base Color']
            if not color.links:
                continue
            source = color.links[0].from_socket
            split = nodes.new('ShaderNodeSeparateColor')
            links.new(source, split.inputs['Color'])
            # Image colors are linear in the shader: skin can have a large R/G ratio.
            # Only the highly saturated red fabric qualifies, never warm skin tones.
            green = nodes.new('ShaderNodeMath'); green.operation = 'MULTIPLY'; green.inputs[1].default_value = 10
            links.new(split.outputs['Green'], green.inputs[0])
            red = nodes.new('ShaderNodeMath'); red.operation = 'SUBTRACT'
            links.new(split.outputs['Red'], red.inputs[0]); links.new(green.outputs[0], red.inputs[1])
            mask = nodes.new('ShaderNodeMath'); mask.operation = 'GREATER_THAN'; mask.inputs[1].default_value = .04
            links.new(red.outputs[0], mask.inputs[0])
            shade = nodes.new('ShaderNodeMixRGB'); shade.blend_type = 'MULTIPLY'; shade.inputs[0].default_value = 1
            shade.inputs[2].default_value = target
            links.new(split.outputs['Red'], shade.inputs[1])
            mix = nodes.new('ShaderNodeMixRGB')
            links.new(mask.outputs[0], mix.inputs[0]); links.new(source, mix.inputs[1]); links.new(shade.outputs[0], mix.inputs[2])
            links.new(mix.outputs[0], color)
        # glTF cannot serialize arbitrary color-mixing shader graphs. Bake only diffuse
        # color to a new local texture, then export the supported image connection.
        bpy.context.scene.render.engine = 'CYCLES'
        bpy.context.scene.cycles.samples = 1
        baked = bpy.data.images.new(kind+'-fabric', width=1024, height=1024, alpha=True)
        targets = []
        for slot in mesh.material_slots:
            if not slot.material or not slot.material.use_nodes: continue
            nodes = slot.material.node_tree.nodes
            links = slot.material.node_tree.links
            shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
            output = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
            emit = nodes.new('ShaderNodeEmission')
            links.new(shader.inputs['Base Color'].links[0].from_socket, emit.inputs['Color'])
            links.new(emit.outputs[0], output.inputs['Surface'])
            target_node = nodes.new('ShaderNodeTexImage'); target_node.image = baked
            nodes.active = target_node
            targets.append((slot.material, target_node))
        bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.bake(type='EMIT', margin=8)
        directory = ROOT / f'source-assets/bongo-rush/models-v3/{kind}'
        directory.mkdir(parents=True, exist_ok=True)
        baked.filepath_raw = str(directory/'fabric.png'); baked.file_format = 'PNG'; baked.save()
        for material, node in targets:
            shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            output = next(n for n in material.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
            material.node_tree.links.new(shader.outputs[0], output.inputs['Surface'])
            material.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])


def make_rig(meshes):
    """The source has hanging arms, not a T-pose: fit elbows/wrists to that reviewed silhouette."""
    data = bpy.data.armatures.new('BongoPatrolRig')
    rig = bpy.data.objects.new('BongoPatrolRig', data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name, head, tail, parent=None):
        item = data.edit_bones.new(name); item.head = head; item.tail = tail
        if parent: item.parent = data.edit_bones[parent]
    bone('Hips', (0, 0, .92), (0, 0, 1.07))
    bone('Spine', (0, 0, 1.07), (0, 0, 1.4), 'Hips')
    bone('Chest', (0, 0, 1.4), (0, 0, 1.7), 'Spine')
    bone('Neck', (0, 0, 1.7), (0, 0, 1.88), 'Chest')
    bone('Head', (0, 0, 1.88), (0, 0, 2.43), 'Neck')
    for side, sign in [('L', 1), ('R', -1)]:
        bone(side+'Shoulder', (sign*.10, 0, 1.67), (sign*.34, 0, 1.63), 'Chest')
        bone(side+'Arm', (sign*.34, 0, 1.63), (sign*.45, -.015, 1.34), side+'Shoulder')
        bone(side+'ForeArm', (sign*.45, -.015, 1.34), (sign*.48, -.04, 1.12), side+'Arm')
        bone(side+'Hand', (sign*.48, -.04, 1.12), (sign*.49, -.04, .98), side+'ForeArm')
        bone(side+'UpLeg', (sign*.20, 0, .92), (sign*.20, -.02, .5), 'Hips')
        bone(side+'Leg', (sign*.20, -.02, .5), (sign*.20, 0, .16), side+'UpLeg')
        bone(side+'Foot', (sign*.20, 0, .16), (sign*.20, -.23, .075), side+'Leg')
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for mesh in meshes: mesh.select_set(True)
    rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    # All vertices must be normalized and weighted; never publish unbound leg/hand islands.
    repaired = 0
    bones = [b for b in data.bones if b.use_deform]
    for mesh in meshes:
        groups = [mesh.vertex_groups.get(b.name) or mesh.vertex_groups.new(name=b.name) for b in bones]
        for vertex in mesh.data.vertices:
            weights = [(g.group, g.weight) for g in vertex.groups if g.weight > 1e-7]
            if not weights:
                p = vertex.co
                distances = []
                for i, b in enumerate(bones):
                    start, end = b.head_local, b.tail_local
                    segment = end-start
                    t = max(0, min(1, (p-start).dot(segment)/segment.length_squared))
                    distances.append(((p-(start+segment*t)).length, groups[i].index))
                weights = [(index, 1/max(distance, .02)**4) for distance, index in sorted(distances)[:4]]
                repaired += 1
            weights = sorted(weights, key=lambda x:x[1], reverse=True)[:4]
            total = sum(w for _,w in weights)
            for g in list(vertex.groups): mesh.vertex_groups[g.group].remove([vertex.index])
            for group, weight in weights: mesh.vertex_groups[group].add([vertex.index], weight/total, 'REPLACE')
            if abs(sum(g.weight for g in vertex.groups)-1) > 1e-5: raise RuntimeError('Unnormalized skin')
    return rig, repaired


def accessory(rig, name, location, scale, color):
    """Actual small garment geometry differentiates silhouettes, not only a global sprite tint."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object; obj.name = name; obj.scale = scale
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy(); obj.data.transform(matrix); obj.matrix_world = Matrix.Identity(4)
    bevel = obj.modifiers.new('Soft sewn edge', 'BEVEL'); bevel.width = .04; bevel.segments = 3
    obj.modifiers.new('Normals', 'WEIGHTED_NORMAL')
    material = bpy.data.materials.new(name); material.use_nodes = True
    material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*color, 1)
    material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .8
    obj.data.materials.append(material)
    obj.parent = rig
    group = obj.vertex_groups.new(name='Chest'); group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    skin = obj.modifiers.new('Garment skin', 'ARMATURE'); skin.object = rig
    return obj


def animate(rig):
    """Two breathing poses and eight phased walk poses, without translating the model root."""
    rig.animation_data_create()
    for name, count in [('Idle', 2), ('Walk', 8)]:
        rig.animation_data.action = None
        action = bpy.data.actions.new(name); rig.animation_data.action = action; action.use_fake_user = True
        for index in range(count + 1):
            phase = index/count * math.tau
            for b in rig.pose.bones:
                b.rotation_mode = 'XYZ'; b.rotation_euler = (0, 0, 0); b.location = (0, 0, 0); b.scale = (1, 1, 1)
            if name == 'Walk':
                for side, offset in [('L', 0), ('R', math.pi)]:
                    stride = math.sin(phase+offset)
                    upper = stride*.28; knee = max(0, -stride)*.30 + .06*(1-math.cos(phase+offset))
                    rig.pose.bones[side+'UpLeg'].rotation_euler.x = upper
                    rig.pose.bones[side+'Leg'].rotation_euler.x = knee
                    rig.pose.bones[side+'Foot'].rotation_euler.x = -upper-knee
                    rig.pose.bones[side+'Arm'].rotation_euler.x = -stride*.18
                    rig.pose.bones[side+'ForeArm'].rotation_euler.x = -.035
                rig.pose.bones['Hips'].location.y = -.012 * (1-math.cos(phase*2))
            else:
                rig.pose.bones['Chest'].scale.y = 1 + .012*math.cos(phase)
                rig.pose.bones['Head'].rotation_euler.z = .012*math.cos(phase)
            frame = 1 + index*3
            for b in rig.pose.bones:
                for path in ['rotation_euler', 'location', 'scale']: b.keyframe_insert(data_path=path, frame=frame)
    rig.animation_data.action = None


def build(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'source-assets/bongo-rush/models/patrol-textured.glb'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for mesh in meshes:
        matrix = mesh.matrix_world.copy(); mesh.parent = None; mesh.matrix_world = Matrix.Identity(4); mesh.data.transform(matrix)
    points = [v.co.copy() for mesh in meshes for v in mesh.data.vertices]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = Vector(((low.x+high.x)/2, (low.y+high.y)/2, low.z)); factor = 2.45/(high.z-low.z)
    for mesh in meshes:
        for vertex in mesh.data.vertices: vertex.co = (vertex.co-center)*factor
        mesh.data.update()
    material_variant(meshes, kind)
    rig, repaired = make_rig(meshes)
    if kind == 'patrol-blue-v3':
        for sign in [-1,1]: accessory(rig, 'Vest pocket', (sign*.16, -.30, 1.37), (.17,.04,.19), (.015,.06,.16))
    if kind == 'undercover-v3':
        for sign in [-1,1]: accessory(rig, 'Civilian jacket panel', (sign*.14,-.30,1.48), (.27,.06,.50), (.045,.055,.07))
        accessory(rig, 'Civilian jacket back', (0,.27,1.45), (.55,.055,.50), (.045,.055,.07))
    animate(rig)
    directory = ROOT / f'source-assets/bongo-rush/models-v3/{kind}'
    directory.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(directory/'npc-animations.glb'), export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=True)
    (directory/'rig-report.json').write_text(json.dumps({'source':'patrol-textured.glb', 'bones':len(rig.data.bones),
       'vertices':sum(len(m.data.vertices) for m in meshes), 'fallbackVertices':repaired,
       'actions':['Idle','Walk'], 'rootMotion':False, 'pose':'lowered-arms', 'quality':'requires-visual-deformation-review'}, indent=2), encoding='utf-8')
    print(f'BONGO_PATROL_BUILT {kind}', flush=True)


if __name__ == '__main__':
    for name in ['patrol-red-v3','patrol-blue-v3','undercover-v3']: build(name)
