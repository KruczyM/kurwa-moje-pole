"""Render baked runtime poses, not a separate Blender retarget approximation."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

folder = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
poses = json.loads((folder / 'poses.json').read_text())
columns = min(8, len(poses))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
mat = bpy.data.materials.new('Clay')
mat.diffuse_color = (.53, .65, .75, 1)
highlight = bpy.data.materials.new('Selected weights')
highlight.diffuse_color = (.95, .1, .2, 1)
for material in [mat, highlight]:
    material.use_nodes = True
    material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = material.diffuse_color
for i, pose in enumerate(poses):
    points = pose['vertices']
    low = [min(v[k] for v in points) for k in range(3)]
    high = [max(v[k] for v in points) for k in range(3)]
    scale = 2.4 / (high[1] - low[1])
    x, z = (i % columns) * 3.3, -(i // columns) * 3.3
    # Three Y-up -> Blender Z-up, model front faces camera -Y.
    verts = [((v[0]-(low[0]+high[0])/2)*scale+x, -v[2]*scale, (v[1]-low[1])*scale+z) for v in points]
    mesh = bpy.data.meshes.new(pose['name'])
    mesh.from_pydata(verts, [], pose['faces'])
    obj = bpy.data.objects.new(pose['name'], mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    mesh.materials.append(highlight)
    selected = set(pose.get('selected', []))
    for poly in mesh.polygons:
        poly.use_smooth = True
        if all(v in selected for v in poly.vertices):
            poly.material_index = 1
    curve = bpy.data.curves.new('label', 'FONT')
    curve.body = pose['name'][:24]
    curve.size = .14
    label = bpy.data.objects.new('label', curve)
    bpy.context.collection.objects.link(label)
    label.location = (x-1.35, -.8, z-.27)
    label.rotation_euler.x = 1.5707963268
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.world.color = (.3,.3,.3)
for loc, energy in [((7,-9,12),3500),((20,-8,-8),2200)]:
    data = bpy.data.lights.new('soft', 'AREA'); data.energy=energy; data.shape='DISK'; data.size=20
    ob=bpy.data.objects.new('soft',data); bpy.context.collection.objects.link(ob); ob.location=loc
    ob.rotation_euler=(Vector((12,0,-6))-ob.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('Camera'); camera_data.type='ORTHO'; camera_data.ortho_scale=columns*3.3+.6
camera=bpy.data.objects.new('Camera',camera_data); bpy.context.collection.objects.link(camera)
rows = (len(poses) + columns-1) // columns
center_z = (2.4 - (rows-1)*3.3)/2
center_x = (columns-1)*3.3/2
camera.location=(center_x,-40,center_z); camera.rotation_euler=(Vector((center_x,0,center_z))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera=camera
scene.render.resolution_x=2400; scene.render.resolution_y=max(650, round((rows*3.3+.5)/camera_data.ortho_scale*2400)); scene.render.resolution_percentage=100
scene.render.filepath=str(folder/'grid.png')
bpy.ops.render.render(write_still=True)
