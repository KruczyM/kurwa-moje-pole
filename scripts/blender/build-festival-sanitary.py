"""
Pol'and'Rock Festival 2026 - Sanitary & Water Infrastructure Generator
Generates high-fidelity, authentic, low-overhead 3D models for:
1. Grzybek Wodny (Iconic Water Mushroom Cooling Station) -> grzybek.glb
2. TOI TOI Blue Single Cabin -> toitoi_blue.glb
3. TOI TOI Row (Battery of 6 cabins with duckboard runner) -> toitoi_row.glb
4. Krany Festiwalowe (20-Tap Wash Station with Stainless Trough) -> krany_festiwalowe.glb
"""

import bpy
import bmesh
import math
import os
import sys
from pathlib import Path
from mathutils import Vector, Matrix

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parents[2]
TEXTURES_DIR = ROOT / 'public' / 'game-assets' / 'world' / 'festival' / 'textures'
OUT_DIR = ROOT / 'public' / 'game-assets' / 'world' / 'festival'

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img, do_unlink=True)

def create_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0,
                        texture_path=None, transmission=0.0, ior=1.45, alpha=1.0, emission_color=(0,0,0,1), emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    bsdf.inputs['Base Color'].default_value = base_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Transmission Weight' in bsdf.inputs:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    elif 'Transmission' in bsdf.inputs:
        bsdf.inputs['Transmission'].default_value = transmission
    bsdf.inputs['IOR'].default_value = ior
    bsdf.inputs['Alpha'].default_value = alpha

    if emission_strength > 0:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = emission_color
            bsdf.inputs['Emission Strength'].default_value = emission_strength
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = (emission_color[0]*emission_strength,
                                                    emission_color[1]*emission_strength,
                                                    emission_color[2]*emission_strength, 1.0)

    if alpha < 1.0 or transmission > 0:
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
        if hasattr(mat, 'shadow_method'):
            mat.shadow_method = 'HASHED'

    if texture_path and Path(texture_path).exists():
        tex_node = nodes.new(type='ShaderNodeTexImage')
        tex_node.image = bpy.data.images.load(str(texture_path))
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha < 1.0:
            links.new(tex_node.outputs['Alpha'], bsdf.inputs['Alpha'])

    return mat

def make_box(bm, center, size, mat_idx=0, uv_rect=None):
    cx, cy, cz = center
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    verts = [
        bm.verts.new((cx - sx, cy - sy, cz - sz)),
        bm.verts.new((cx + sx, cy - sy, cz - sz)),
        bm.verts.new((cx + sx, cy + sy, cz - sz)),
        bm.verts.new((cx - sx, cy + sy, cz - sz)),
        bm.verts.new((cx - sx, cy - sy, cz + sz)),
        bm.verts.new((cx + sx, cy - sy, cz + sz)),
        bm.verts.new((cx + sx, cy + sy, cz + sz)),
        bm.verts.new((cx - sx, cy + sy, cz + sz)),
    ]
    face_indices = [
        (0, 3, 2, 1), # Bottom (-Z)
        (4, 5, 6, 7), # Top (+Z)
        (0, 1, 5, 4), # Front (-Y)
        (2, 3, 7, 6), # Back (+Y)
        (0, 4, 7, 3), # Left (-X)
        (1, 2, 6, 5), # Right (+X)
    ]
    faces = []
    uv_layer = bm.loops.layers.uv.verify()
    for idxs in face_indices:
        f = bm.faces.new([verts[i] for i in idxs])
        f.material_index = mat_idx
        faces.append(f)

    if uv_rect:
        bm.normal_update()
        u0, v0, u1, v1 = uv_rect
        for f in faces:
            nx, ny, nz = f.normal
            for loop in f.loops:
                vx, vy, vz = loop.vert.co
                if abs(ny) >= abs(nx) and abs(ny) >= abs(nz):
                    if ny < 0:
                        u = u0 + (u1 - u0) * ((vx - (cx - sx)) / (2 * sx if sx > 0 else 1))
                    else:
                        u = u0 + (u1 - u0) * (((cx + sx) - vx) / (2 * sx if sx > 0 else 1))
                    v = v0 + (v1 - v0) * ((vz - (cz - sz)) / (2 * sz if sz > 0 else 1))
                elif abs(nx) >= abs(ny) and abs(nx) >= abs(nz):
                    if nx > 0:
                        u = u0 + (u1 - u0) * ((vy - (cy - sy)) / (2 * sy if sy > 0 else 1))
                    else:
                        u = u0 + (u1 - u0) * (((cy + sy) - vy) / (2 * sy if sy > 0 else 1))
                    v = v0 + (v1 - v0) * ((vz - (cz - sz)) / (2 * sz if sz > 0 else 1))
                else:
                    u = u0 + (u1 - u0) * ((vx - (cx - sx)) / (2 * sx if sx > 0 else 1))
                    v = v0 + (v1 - v0) * ((vy - (cy - sy)) / (2 * sy if sy > 0 else 1))
                loop[uv_layer].uv = (u, v)
    return faces

def make_cylinder(bm, center, radius, height, segments=16, mat_idx=0, uv_rect=None):
    cx, cy, cz = center
    half_h = height / 2.0
    bot_ring = []
    top_ring = []
    for i in range(segments):
        ang = (2.0 * math.pi * i) / segments
        x = cx + radius * math.cos(ang)
        y = cy + radius * math.sin(ang)
        bot_ring.append(bm.verts.new((x, y, cz - half_h)))
        top_ring.append(bm.verts.new((x, y, cz + half_h)))

    uv_layer = bm.loops.layers.uv.verify()
    # Side quads
    for i in range(segments):
        next_i = (i + 1) % segments
        f = bm.faces.new([bot_ring[i], bot_ring[next_i], top_ring[next_i], top_ring[i]])
        f.material_index = mat_idx
        if uv_rect:
            u0, v0, u1, v1 = uv_rect
            fu0 = u0 + (u1 - u0) * (i / segments)
            fu1 = u0 + (u1 - u0) * ((i + 1) / segments)
            f.loops[0][uv_layer].uv = (fu0, v0)
            f.loops[1][uv_layer].uv = (fu1, v0)
            f.loops[2][uv_layer].uv = (fu1, v1)
            f.loops[3][uv_layer].uv = (fu0, v1)

    # Caps
    f_bot = bm.faces.new(list(reversed(bot_ring)))
    f_bot.material_index = mat_idx
    f_top = bm.faces.new(top_ring)
    f_top.material_index = mat_idx

def make_tube_between(bm, p1, p2, radius, segments=8, mat_idx=0):
    v1 = Vector(p1)
    v2 = Vector(p2)
    axis = v2 - v1
    length = axis.length
    if length < 1e-5:
        return
    z_axis = axis.normalized()
    up = Vector((0, 0, 1)) if abs(z_axis.z) < 0.9 else Vector((0, 1, 0))
    x_axis = z_axis.cross(up).normalized()
    y_axis = z_axis.cross(x_axis).normalized()

    bot_verts = []
    top_verts = []
    for i in range(segments):
        ang = 2.0 * math.pi * i / segments
        offset = (x_axis * math.cos(ang) + y_axis * math.sin(ang)) * radius
        bot_verts.append(bm.verts.new(v1 + offset))
        top_verts.append(bm.verts.new(v2 + offset))

    for i in range(segments):
        next_i = (i + 1) % segments
        f = bm.faces.new([bot_verts[i], bot_verts[next_i], top_verts[next_i], top_verts[i]])
        f.material_index = mat_idx
def export_glb(filepath):
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format='GLB',
        use_selection=False,
        export_yup=True
    )
    print(f"Exported: {filepath} ({filepath.stat().st_size / 1024:.1f} KB)")


# ==============================================================================
# 1. GRZYBEK WODNY (Authentic Pol'and'Rock Standpipe - Red Steel Pole with Water Canopy)
# ==============================================================================
def build_grzybek():
    print("Building Grzybek Wodny (Authentic Pol'and'Rock Standpipe - Red Steel Pole with Water Canopy)...")
    clear_scene()

    tex_path = TEXTURES_DIR / 'grzybek_texture.png'

    mat_cap = create_pbr_material("Mat_Grzybek_Cap", base_color=(0.85, 0.65, 0.18, 1.0), roughness=0.25, metallic=0.9, texture_path=tex_path)
    mat_deck = create_pbr_material("Mat_Grzybek_Mud", base_color=(0.22, 0.18, 0.14, 1.0), roughness=0.95, metallic=0.0, texture_path=tex_path)
    mat_steel_mast = create_pbr_material("Mat_Steel_Mast", base_color=(0.78, 0.08, 0.08, 1.0), roughness=0.35, metallic=0.3, texture_path=tex_path) # Iconic red standpipe
    mat_galv = create_pbr_material("Mat_Black_Collar", base_color=(0.12, 0.12, 0.12, 1.0), roughness=0.7, metallic=0.2, texture_path=tex_path)
    mat_pipe_red = create_pbr_material("Mat_Water_Pipe_Red", base_color=(0.78, 0.08, 0.08, 1.0), roughness=0.35, metallic=0.3, texture_path=tex_path)
    mat_brass = create_pbr_material("Mat_Brass_Nozzles", base_color=(0.85, 0.65, 0.18, 1.0), roughness=0.25, metallic=0.9, texture_path=tex_path)
    mat_water = create_pbr_material("Mat_Water_Cascade", base_color=(0.85, 0.95, 1.0, 0.35), roughness=0.05, metallic=0.0,
                                    transmission=0.92, alpha=0.45, ior=1.333, texture_path=tex_path)

    mesh = bpy.data.meshes.new("Grzybek_Mesh")
    bm = bmesh.new()

    # --- 1. Mud Puddle / Wet Ground Depression (Radius 5.5m) ---
    make_cylinder(bm, (0, 0, 0.02), 5.5, 0.04, segments=32, mat_idx=1)
    make_cylinder(bm, (0, 0, 0.035), 3.2, 0.03, segments=24, mat_idx=1)

    # --- 2. Ground Anchor Collar / Sleeve (Black industrial boot, H: 0.55m, R: 0.12m) ---
    make_cylinder(bm, (0, 0, 0.28), 0.12, 0.55, segments=16, mat_idx=3)
    make_cylinder(bm, (0, 0, 0.06), 0.24, 0.06, segments=16, mat_idx=3)

    # --- 3. Main Vertical Red Steel Standpipe (Height 4.2m, Radius 0.085m) ---
    mast_h = 4.2
    make_cylinder(bm, (0, 0, mast_h / 2.0), 0.085, mast_h, segments=20, mat_idx=2)

    # Couplings / welded seams along the pipe
    for seam_z in [1.4, 2.8]:
        make_cylinder(bm, (0, 0, seam_z), 0.098, 0.08, segments=16, mat_idx=4)

    # --- 4. Top Spray Head & High-Pressure Nozzle Cluster ---
    top_z = mast_h
    make_cylinder(bm, (0, 0, top_z + 0.06), 0.13, 0.12, segments=16, mat_idx=5)
    make_cylinder(bm, (0, 0, top_z + 0.15), 0.07, 0.08, segments=12, mat_idx=0)

    # Upward geyser core burst (vertical mist column from photo)
    core_verts_bot = []
    core_verts_top = []
    geyser_h = 2.4
    for i in range(12):
        ang = i * 2.0 * math.pi / 12
        core_verts_bot.append(bm.verts.new((0.10 * math.cos(ang), 0.10 * math.sin(ang), top_z + 0.15)))
        core_verts_top.append(bm.verts.new((0.75 * math.cos(ang), 0.75 * math.sin(ang), top_z + geyser_h)))
    for i in range(12):
        next_i = (i + 1) % 12
        f = bm.faces.new([core_verts_bot[i], core_verts_bot[next_i], core_verts_top[next_i], core_verts_top[i]])
        f.material_index = 6

    # --- 5. 360-Degree Cascading Parabolic Water Ribbons (16 outward streams) ---
    num_streams = 16
    outer_radius = 5.2
    stream_subdivs = 6
    for s_i in range(num_streams):
        ang = s_i * 2.0 * math.pi / num_streams
        dir_x = math.cos(ang)
        dir_y = math.sin(ang)

        ribbon_left = []
        ribbon_right = []
        for step in range(stream_subdivs + 1):
            t = step / stream_subdivs
            # Parabolic trajectory
            r = t * outer_radius
            z = top_z + 0.12 + 0.5 * (t - t * t * 2.2) * mast_h
            if z < 0.05:
                z = 0.05
            width = 0.08 + t * 0.45
            # Perpendicular vector to radius
            px = -dir_y * (width / 2.0)
            py = dir_x * (width / 2.0)

            cx = dir_x * r
            cy = dir_y * r
            ribbon_left.append(bm.verts.new((cx + px, cy + py, z)))
            ribbon_right.append(bm.verts.new((cx - px, cy - py, z)))

        for step in range(stream_subdivs):
            f = bm.faces.new([
                ribbon_left[step],
                ribbon_right[step],
                ribbon_right[step + 1],
                ribbon_left[step + 1]
            ])
            f.material_index = 6

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Festival_Grzybek_Wodny", mesh)
    bpy.context.collection.objects.link(obj)

    # Assign materials in exact index order
    mats = [mat_cap, mat_deck, mat_steel_mast, mat_galv, mat_pipe_red, mat_brass, mat_water]
    for m in mats:
        obj.data.materials.append(m)

    out_file = OUT_DIR / 'grzybek.glb'
    export_glb(out_file)


# ==============================================================================
# 2. TOI TOI BLUE & TOI TOI ROW (Portable Toilet Cabins)
# ==============================================================================
def create_toitoi_cabin_geometry(bm, cabin_center, rot_z=0.0, door_open_angle=0.0,
                                 mat_blue_idx=0, mat_door_idx=1, mat_roof_idx=2, mat_black_idx=3, mat_interior_idx=4):
    """Generates an authentic 1.15m x 1.20m x 2.30m DIXI/TOI-TOI cabin."""
    cx, cy, cz = cabin_center
    w = 1.15
    d = 1.20
    h = 2.30

    uv_layer = bm.loops.layers.uv.verify()

    rot_mat = Matrix.Rotation(rot_z, 4, 'Z')
    trans_mat = Matrix.Translation(Vector((cx, cy, cz)))
    transform = trans_mat @ rot_mat

    def local_box(center, size, mat_idx, uv_rect=None):
        faces = make_box(bm, center, size, mat_idx=mat_idx, uv_rect=uv_rect)
        for v in set(v for f in faces for v in f.verts):
            v.co = transform @ v.co

    def local_cyl(center, radius, height, segments, mat_idx):
        cx, cy, cz = center
        half_h = height / 2.0
        bot_ring = []
        top_ring = []
        for i in range(segments):
            ang = (2.0 * math.pi * i) / segments
            x = cx + radius * math.cos(ang)
            y = cy + radius * math.sin(ang)
            p_bot = transform @ Vector((x, y, cz - half_h))
            p_top = transform @ Vector((x, y, cz + half_h))
            bot_ring.append(bm.verts.new(p_bot))
            top_ring.append(bm.verts.new(p_top))
        for i in range(segments):
            next_i = (i + 1) % segments
            f = bm.faces.new([bot_ring[i], bot_ring[next_i], top_ring[next_i], top_ring[i]])
            f.material_index = mat_idx
        bm.faces.new(list(reversed(bot_ring))).material_index = mat_idx
        bm.faces.new(top_ring).material_index = mat_idx

    # 1. Base HDPE Skid (0.12m high with forklift pockets)
    local_box((0, 0, 0.06), (w, d, 0.12), mat_black_idx)

    # 2. Side and Back Walls (Plastic Blue Ribbed)
    wall_t = 0.04
    # Left wall
    local_box((-w/2 + wall_t/2, 0, h/2), (wall_t, d, h - 0.12), mat_blue_idx, uv_rect=(0.5, 0.5, 1.0, 1.0))
    # Right wall
    local_box((w/2 - wall_t/2, 0, h/2), (wall_t, d, h - 0.12), mat_blue_idx, uv_rect=(0.5, 0.5, 1.0, 1.0))
    # Back wall
    local_box((0, d/2 - wall_t/2, h/2), (w - wall_t*2, wall_t, h - 0.12), mat_blue_idx, uv_rect=(0.5, 0.5, 1.0, 1.0))

    # 3. Corner structural posts (thick blue pillars)
    post_w = 0.08
    for px in [-w/2 + post_w/2, w/2 - post_w/2]:
        for py in [-d/2 + post_w/2, d/2 - post_w/2]:
            local_box((px, py, h/2), (post_w, post_w, h - 0.12), mat_blue_idx)

    # 4. Translucent White Arched Roof (height 2.22m to 2.38m)
    local_box((0, 0, h - 0.04), (w + 0.06, d + 0.06, 0.08), mat_roof_idx, uv_rect=(0.5, 0.0, 1.0, 0.5))

    # 5. Roof PVC Ventilation Pipe (emerging from rear right corner)
    local_cyl((w/2 - 0.18, d/2 - 0.18, h + 0.15), radius=0.05, height=0.45, segments=12, mat_idx=mat_black_idx)

    # 6. Front Door (Single hinged swinging door)
    door_w = w - post_w * 2.0
    door_h = h - 0.18
    door_t = 0.035
    hinge_x = -door_w / 2.0

    door_rot = Matrix.Rotation(door_open_angle, 4, 'Z')
    door_hinge_trans = Matrix.Translation(Vector((hinge_x, -d/2 + door_t/2, 0.12 + door_h/2.0)))
    door_pivot_back = Matrix.Translation(Vector((-hinge_x, 0, 0)))

    # Door vertices in local cabin space
    door_center_local = Vector((0, -d/2 + door_t/2, 0.12 + door_h/2.0))
    door_verts_local = [
        Vector((-door_w/2, -d/2, 0.12)),
        Vector((door_w/2, -d/2, 0.12)),
        Vector((door_w/2, -d/2, 0.12 + door_h)),
        Vector((-door_w/2, -d/2, 0.12 + door_h)),
        Vector((-door_w/2, -d/2 + door_t, 0.12)),
        Vector((door_w/2, -d/2 + door_t, 0.12)),
        Vector((door_w/2, -d/2 + door_t, 0.12 + door_h)),
        Vector((-door_w/2, -d/2 + door_t, 0.12 + door_h)),
    ]

    transformed_door_verts = []
    for dv in door_verts_local:
        # Rotate around hinge
        rel = dv - Vector((hinge_x, -d/2, 0))
        rot_v = door_rot @ rel + Vector((hinge_x, -d/2, 0))
        # Global transform
        transformed_door_verts.append(bm.verts.new(transform @ rot_v))

    # Door faces
    d_indices = [
        (0, 1, 2, 3), # Front exterior
        (5, 4, 7, 6), # Back interior
        (0, 4, 7, 3), # Left edge
        (1, 5, 6, 2), # Right edge
        (3, 2, 6, 7), # Top edge
        (0, 1, 5, 4), # Bottom edge
    ]
    for fi, idxs in enumerate(d_indices):
        f = bm.faces.new([transformed_door_verts[i] for i in idxs])
        if fi == 0:
            f.material_index = mat_door_idx # Door face texture atlas (0, 0, 0.5, 1.0)
            f.loops[0][uv_layer].uv = (0.0, 0.0)
            f.loops[1][uv_layer].uv = (0.5, 0.0)
            f.loops[2][uv_layer].uv = (0.5, 1.0)
            f.loops[3][uv_layer].uv = (0.0, 1.0)
        else:
            f.material_index = mat_blue_idx

    # 7. Interior Amenities (Toilet tank, seat, toilet paper roll)
    # Toilet waste holding tank at rear
    local_box((0, d/2 - 0.35, 0.12 + 0.25), (0.75, 0.55, 0.48), mat_interior_idx)
    # Toilet seat ring on tank
    local_cyl((0, d/2 - 0.35, 0.62), radius=0.22, height=0.04, segments=16, mat_idx=mat_black_idx)
    # Hand sanitizer pump on left interior wall
    local_box((-w/2 + 0.08, 0, 1.25), (0.08, 0.12, 0.22), mat_interior_idx)

def build_toitoi_blue():
    print("Building TOI TOI Blue Single Cabin...")
    clear_scene()

    tex_path = TEXTURES_DIR / 'toitoi_texture.png'

    mat_blue = create_pbr_material("Mat_TOI_Blue", base_color=(0.05, 0.36, 0.66, 1.0), roughness=0.45, metallic=0.05)
    mat_door = create_pbr_material("Mat_TOI_Door", base_color=(0.05, 0.36, 0.66, 1.0), roughness=0.45, metallic=0.05, texture_path=tex_path)
    mat_roof = create_pbr_material("Mat_TOI_Roof", base_color=(0.95, 0.96, 0.98, 0.9), roughness=0.35, metallic=0.0, transmission=0.4, alpha=0.9)
    mat_black = create_pbr_material("Mat_TOI_Black_Skid", base_color=(0.12, 0.14, 0.18, 1.0), roughness=0.7, metallic=0.1)
    mat_interior = create_pbr_material("Mat_TOI_Interior_Grey", base_color=(0.82, 0.85, 0.88, 1.0), roughness=0.5, metallic=0.05)

    mesh = bpy.data.meshes.new("TOI_TOI_Blue_Mesh")
    bm = bmesh.new()

    create_toitoi_cabin_geometry(bm, (0, 0, 0), rot_z=0.0, door_open_angle=0.0,
                                 mat_blue_idx=0, mat_door_idx=1, mat_roof_idx=2, mat_black_idx=3, mat_interior_idx=4)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Festival_TOI_TOI_Blue", mesh)
    bpy.context.collection.objects.link(obj)

    mats = [mat_blue, mat_door, mat_roof, mat_black, mat_interior]
    for m in mats:
        obj.data.materials.append(m)

    out_file = OUT_DIR / 'toitoi_blue.glb'
    export_glb(out_file)

def build_toitoi_row():
    print("Building TOI TOI Row (Battery of 6 cabins)...")
    clear_scene()

    tex_path = TEXTURES_DIR / 'toitoi_texture.png'

    mat_blue = create_pbr_material("Mat_TOI_Blue", base_color=(0.05, 0.36, 0.66, 1.0), roughness=0.45, metallic=0.05)
    mat_door = create_pbr_material("Mat_TOI_Door", base_color=(0.05, 0.36, 0.66, 1.0), roughness=0.45, metallic=0.05, texture_path=tex_path)
    mat_roof = create_pbr_material("Mat_TOI_Roof", base_color=(0.95, 0.96, 0.98, 0.9), roughness=0.35, metallic=0.0, transmission=0.4, alpha=0.9)
    mat_black = create_pbr_material("Mat_TOI_Black_Skid", base_color=(0.12, 0.14, 0.18, 1.0), roughness=0.7, metallic=0.1)
    mat_interior = create_pbr_material("Mat_TOI_Interior_Grey", base_color=(0.82, 0.85, 0.88, 1.0), roughness=0.5, metallic=0.05)
    mat_runner = create_pbr_material("Mat_Duckboard_Runner", base_color=(0.35, 0.28, 0.22, 1.0), roughness=0.85, metallic=0.0)
    mat_barrier = create_pbr_material("Mat_Galv_Barrier", base_color=(0.75, 0.78, 0.82, 1.0), roughness=0.35, metallic=0.85)

    mesh = bpy.data.meshes.new("TOI_TOI_Row_Mesh")
    bm = bmesh.new()

    num_cabins = 6
    cabin_w = 1.15
    cabin_spacing = 1.20
    total_w = num_cabins * cabin_spacing

    # 1. Wooden duckboard runner deck underneath
    make_box(bm, (0, 0, 0.025), (total_w + 0.6, 2.2, 0.05), mat_idx=5)
    # Runner slats lines
    for sl_x in range(int(-(total_w + 0.6)/2 * 10), int((total_w + 0.6)/2 * 10), 2):
        x_m = sl_x / 10.0
        make_box(bm, (x_m, 0, 0.052), (0.015, 2.18, 0.005), mat_idx=3)

    # 2. Battery of 6 cabins side by side
    start_x = -((num_cabins - 1) * cabin_spacing) / 2.0
    for c_i in range(num_cabins):
        cx = start_x + c_i * cabin_spacing
        # Organic micro-offsets
        cz_offset = (c_i % 2) * 0.01
        door_open = math.radians(22) if c_i == 3 else 0.0 # One cabin open showing interior
        rot_y_noise = (math.sin(c_i * 1.5)) * 0.01

        create_toitoi_cabin_geometry(
            bm, (cx, 0, 0.05 + cz_offset),
            rot_z=rot_y_noise,
            door_open_angle=door_open,
            mat_blue_idx=0, mat_door_idx=1, mat_roof_idx=2, mat_black_idx=3, mat_interior_idx=4
        )

    # 3. Flanking crowd barriers on left and right ends
    for side_x in [-(total_w + 0.5)/2, (total_w + 0.5)/2]:
        make_tube_between(bm, (side_x, -1.0, 0.05), (side_x, -1.0, 1.1), radius=0.025, mat_idx=6)
        make_tube_between(bm, (side_x, 1.0, 0.05), (side_x, 1.0, 1.1), radius=0.025, mat_idx=6)
        make_tube_between(bm, (side_x, -1.0, 1.1), (side_x, 1.0, 1.1), radius=0.025, mat_idx=6)
        make_tube_between(bm, (side_x, -1.0, 0.55), (side_x, 1.0, 0.55), radius=0.02, mat_idx=6)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Festival_TOI_TOI_Row", mesh)
    bpy.context.collection.objects.link(obj)

    mats = [mat_blue, mat_door, mat_roof, mat_black, mat_interior, mat_runner, mat_barrier]
    for m in mats:
        obj.data.materials.append(m)

    out_file = OUT_DIR / 'toitoi_row.glb'
    export_glb(out_file)


# ==============================================================================
# 3. KRANY FESTIWALOWE (20-Tap Festival Wash Station)
# ==============================================================================
def build_krany_festiwalowe():
    print("Building Krany Festiwalowe (20-Tap Stainless Wash Station)...")
    clear_scene()

    tex_path = TEXTURES_DIR / 'krany_texture.png'

    mat_inox = create_pbr_material("Mat_Stainless_Trough", base_color=(0.85, 0.88, 0.92, 1.0), roughness=0.25, metallic=0.92)
    mat_sign = create_pbr_material("Mat_Wash_Sign", base_color=(0.9, 0.9, 0.9, 1.0), roughness=0.35, metallic=0.05, texture_path=tex_path)
    mat_galv = create_pbr_material("Mat_Galv_Rail", base_color=(0.72, 0.75, 0.78, 1.0), roughness=0.35, metallic=0.85)
    mat_deck = create_pbr_material("Mat_Deck_Planks", base_color=(0.42, 0.32, 0.22, 1.0), roughness=0.8, metallic=0.0)
    mat_chrome = create_pbr_material("Mat_Chrome_Taps", base_color=(0.95, 0.96, 0.98, 1.0), roughness=0.15, metallic=0.98)
    mat_water = create_pbr_material("Mat_Tap_Water", base_color=(0.85, 0.95, 1.0, 0.4), roughness=0.05, metallic=0.0,
                                    transmission=0.95, alpha=0.4, ior=1.333)

    mesh = bpy.data.meshes.new("Krany_Mesh")
    bm = bmesh.new()

    deck_w = 6.2
    deck_d = 2.4
    deck_h = 0.12

    # --- 1. Staging Duckboard Deck & Railings ---
    # Concrete / timber foundation runners
    for ry in [-0.9, 0.0, 0.9]:
        make_box(bm, (0, ry, 0.03), (deck_w, 0.15, 0.06), mat_idx=2)
    # Timber duckboard platform
    make_box(bm, (0, 0, 0.09), (deck_w, deck_d, 0.06), mat_idx=3)
    # Slats plank lines
    for sx in range(int(-deck_w/2 * 8), int(deck_w/2 * 8), 2):
        xm = sx / 8.0
        make_box(bm, (xm, 0, 0.122), (0.015, deck_d - 0.04, 0.005), mat_idx=2)

    # Galvanized safety handrail on rear and short sides
    # 6 Vertical upright stanchions
    for hx in [-deck_w/2 + 0.1, 0, deck_w/2 - 0.1]:
        make_tube_between(bm, (hx, deck_d/2 - 0.08, 0.12), (hx, deck_d/2 - 0.08, 1.15), radius=0.024, mat_idx=2)
    # Short side stanchions
    make_tube_between(bm, (-deck_w/2 + 0.1, -deck_d/2 + 0.1, 0.12), (-deck_w/2 + 0.1, -deck_d/2 + 0.1, 1.15), radius=0.024, mat_idx=2)
    make_tube_between(bm, (deck_w/2 - 0.1, -deck_d/2 + 0.1, 0.12), (deck_w/2 - 0.1, -deck_d/2 + 0.1, 1.15), radius=0.024, mat_idx=2)

    # Horizontal top rails (1.1m) and knee rails (0.55m)
    make_tube_between(bm, (-deck_w/2 + 0.1, deck_d/2 - 0.08, 1.12), (deck_w/2 - 0.1, deck_d/2 - 0.08, 1.12), radius=0.022, mat_idx=2)
    make_tube_between(bm, (-deck_w/2 + 0.1, deck_d/2 - 0.08, 0.58), (deck_w/2 - 0.1, deck_d/2 - 0.08, 0.58), radius=0.020, mat_idx=2)
    # Side rails
    make_tube_between(bm, (-deck_w/2 + 0.1, deck_d/2 - 0.08, 1.12), (-deck_w/2 + 0.1, -deck_d/2 + 0.1, 1.12), radius=0.022, mat_idx=2)
    make_tube_between(bm, (-deck_w/2 + 0.1, deck_d/2 - 0.08, 0.58), (-deck_w/2 + 0.1, -deck_d/2 + 0.1, 0.58), radius=0.020, mat_idx=2)
    make_tube_between(bm, (deck_w/2 - 0.1, deck_d/2 - 0.08, 1.12), (deck_w/2 - 0.1, -deck_d/2 + 0.1, 1.12), radius=0.022, mat_idx=2)
    make_tube_between(bm, (deck_w/2 - 0.1, deck_d/2 - 0.08, 0.58), (deck_w/2 - 0.1, -deck_d/2 + 0.1, 0.58), radius=0.020, mat_idx=2)

    # --- 2. Double-Sided Stainless Steel Wash Trough ---
    trough_l = 5.2
    trough_w = 0.72
    trough_h = 0.24
    rim_z = 0.88

    # Heavy galvanized support trestles (legs)
    for leg_x in [-2.0, 0.0, 2.0]:
        make_tube_between(bm, (leg_x, -trough_w/2 + 0.05, 0.12), (leg_x, -trough_w/2 + 0.05, rim_z - trough_h), radius=0.025, mat_idx=2)
        make_tube_between(bm, (leg_x, trough_w/2 - 0.05, 0.12), (leg_x, trough_w/2 - 0.05, rim_z - trough_h), radius=0.025, mat_idx=2)
        make_tube_between(bm, (leg_x, -trough_w/2 + 0.05, rim_z - trough_h), (leg_x, trough_w/2 - 0.05, rim_z - trough_h), radius=0.025, mat_idx=2)

    # Trough outer box body
    make_box(bm, (0, 0, rim_z - trough_h/2), (trough_l, trough_w, trough_h), mat_idx=0)
    # Center longitudinal stainless splashback divider
    make_box(bm, (0, 0, rim_z + 0.24), (trough_l, 0.04, 0.48), mat_idx=0)

    # --- 3. Overhead Supply Manifold Pipe & Chrome Push Taps ---
    # Top water manifold pipe running above divider (DN40)
    manifold_z = rim_z + 0.50
    make_tube_between(bm, (-trough_l/2, 0, manifold_z), (trough_l/2, 0, manifold_z), radius=0.03, mat_idx=2)

    # 10 push taps on Front side (-Y) and 10 on Back side (+Y)
    num_taps = 10
    start_tap_x = -2.25
    tap_spacing = 0.50

    for side in [-1, 1]:
        for ti in range(num_taps):
            tx = start_tap_x + ti * tap_spacing
            ty_start = side * 0.025
            ty_end = side * 0.22
            tap_z = rim_z + 0.32
            # Tap bracket from manifold down to tap height
            make_tube_between(bm, (tx, ty_start, manifold_z), (tx, ty_start, tap_z), radius=0.015, mat_idx=4)
            # Tap horizontal arm
            make_tube_between(bm, (tx, ty_start, tap_z), (tx, ty_end, tap_z), radius=0.014, mat_idx=4)
            # Push-button top cylinder
            make_cylinder(bm, (tx, ty_end - side * 0.04, tap_z + 0.035), radius=0.018, height=0.045, segments=8, mat_idx=4)
            # Downward curved spout
            make_tube_between(bm, (tx, ty_end, tap_z), (tx, ty_end, tap_z - 0.06), radius=0.012, mat_idx=4)

            # A couple of running taps with translucent water streams
            if ti in [2, 5, 8] and side == -1:
                make_cylinder(bm, (tx, ty_end, (tap_z - 0.06 + rim_z - trough_h + 0.04)/2.0),
                              radius=0.008, height=(tap_z - 0.06) - (rim_z - trough_h + 0.04), segments=6, mat_idx=5)

    # --- 4. Overhead Signage Structure ---
    # 2 Vertical steel poles for header sign
    sign_pole_x = trough_l/2 + 0.15
    sign_h = 2.45
    make_tube_between(bm, (-sign_pole_x, 0, 0.12), (-sign_pole_x, 0, sign_h), radius=0.03, mat_idx=2)
    make_tube_between(bm, (sign_pole_x, 0, 0.12), (sign_pole_x, 0, sign_h), radius=0.03, mat_idx=2)

    # Horizontal sign beam
    make_tube_between(bm, (-sign_pole_x, 0, sign_h - 0.05), (sign_pole_x, 0, sign_h - 0.05), radius=0.025, mat_idx=2)

    # Double-sided header banner sign
    banner_w = trough_l
    banner_h = 0.55
    banner_z = sign_h - 0.35
    make_box(bm, (0, 0, banner_z), (banner_w, 0.02, banner_h), mat_idx=1, uv_rect=(0.0, 0.5, 1.0, 1.0))

    # Side warning sign on left pole
    make_box(bm, (-sign_pole_x, -0.25, 1.55), (0.02, 0.50, 0.45), mat_idx=1, uv_rect=(0.0, 0.0, 0.5, 0.5))

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Festival_Krany_Festiwalowe", mesh)
    bpy.context.collection.objects.link(obj)

    mats = [mat_inox, mat_sign, mat_galv, mat_deck, mat_chrome, mat_water]
    for m in mats:
        obj.data.materials.append(m)

    out_file = OUT_DIR / 'krany_festiwalowe.glb'
    export_glb(out_file)


def main():
    build_grzybek()
    build_toitoi_blue()
    build_toitoi_row()
    build_krany_festiwalowe()

if __name__ == '__main__':
    main()
