"""
Build script for Monumental Scena ASP (Namiot ASP / Akademia Sztuk Przepięknych)
for Pol'and'Rock Festival 2026.

Sized to match the monumental scale of Duża Scena:
- Width: 34.0 meters (X in [-17.0, +17.0])
- Height: 16.5 meters peak (curved arched polygon marquee pavilion)
- Length: 44.0 meters tent pavilion (Y in [-6.0, +38.0]) + 4.0m front entrance plaza (total depth 48.0m)
- Wide open entrance portal (ground to 5.2m height, 26m wide opening)
- Front branded gable wall with authentic mBank speech bubble, "zaprasza do",
  zebra-striped "ASP", WOŚP heart, "Pol'and'Rock FESTIVAL POLAND"
- Interior grand Scena ASP:
  * 22m wide x 6m deep x 1.6m high raised oak stage deck
  * 10m x 4.5m authentic Persian/oriental concert rug
  * 20m wide x 10.9m high stage backdrop with folk mandala, zebra ASP, heart,
    bold yellow "MAŁA SCENA TYLKO Z NAZWY", blinder truss, and ATMOSPHERE concert screen
  * Discussion armchairs (1 red, 1 blue), boom mic stand, 6 full guitar amp stacks, stage monitor wedges
  * Overhead lighting truss with concert spotlights
- Front lawn plaza:
  * Monumental 9.5m tall Woodstock folk art totems flanking the pavilion with guy-wires
  * 2.6m tall freestanding 3D zebra-striped "ASP" letters on the grass
  * 2.6m tall freestanding 3D mBank segmented speech bubble totem
  * Steel crowd control barricades
"""

import os
import sys
import math
from pathlib import Path
import bpy

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img, do_unlink=True)

def make_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0,
                      texture_path=None, emission_color=(0, 0, 0, 1.0), emission_strength=0.0,
                      use_alpha=False):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = base_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic

    if emission_strength > 0:
        bsdf.inputs['Emission Color'].default_value = emission_color
        bsdf.inputs['Emission Strength'].default_value = emission_strength

    if texture_path and os.path.exists(texture_path):
        img = bpy.data.images.load(str(Path(texture_path).resolve()))
        img.colorspace_settings.name = 'sRGB'
        tex_node = nodes.new(type='ShaderNodeTexImage')
        tex_node.image = img
        links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
        if use_alpha and 'Alpha' in tex_node.outputs and 'Alpha' in bsdf.inputs:
            links.new(tex_node.outputs['Alpha'], bsdf.inputs['Alpha'])
            if hasattr(mat, 'blend_method'):
                mat.blend_method = 'BLEND'
            if hasattr(mat, 'shadow_method'):
                mat.shadow_method = 'HASHED'
        else:
            if hasattr(mat, 'blend_method'):
                mat.blend_method = 'OPAQUE'
            if hasattr(mat, 'shadow_method'):
                mat.shadow_method = 'OPAQUE'

    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def get_profile_point(x):
    """
    Returns (x, z) for the curved arched cross section of the monumental ASP tent.
    Width: 34.0 meters (x signed in [-17.0, +17.0]).
    Peak at x=0 is z=16.5m.
    Roof slopes down to z=8.5m at |x|=13.0m.
    Then curved eave eases down to ground z=0 at |x|=17.0m.
    """
    sign = 1.0 if x >= 0 else -1.0
    ax = abs(x)
    if ax <= 13.0:
        t = ax / 13.0
        z = 16.5 - 8.0 * t
        return (x, z)
    else:
        theta = ((ax - 13.0) / 4.0) * (math.pi / 2.0)
        theta = min(max(theta, 0.0), math.pi / 2.0)
        z = 8.5 * math.cos(theta)
        return (sign * ax, z)

def create_mesh(name, vertices, faces, material=None, uvs=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    if smooth:
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.update()

    if uvs:
        uv_layer = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            for loop_index in poly.loop_indices:
                v_idx = mesh.loops[loop_index].vertex_index
                if v_idx in uvs:
                    uv_layer.data[loop_index].uv = uvs[v_idx]

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj

def build_box(name, center, size, material=None, uv_tiling=1.0):
    cx, cy, cz = center
    sx, sy, sz = size
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0

    vertices = [
        (cx - hx, cy - hy, cz - hz),  # 0
        (cx + hx, cy - hy, cz - hz),  # 1
        (cx + hx, cy + hy, cz - hz),  # 2
        (cx - hx, cy + hy, cz - hz),  # 3
        (cx - hx, cy - hy, cz + hz),  # 4
        (cx + hx, cy - hy, cz + hz),  # 5
        (cx + hx, cy + hy, cz + hz),  # 6
        (cx - hx, cy + hy, cz + hz),  # 7
    ]
    faces = [
        (0, 3, 2, 1),  # bottom
        (4, 5, 6, 7),  # top
        (0, 1, 5, 4),  # front
        (2, 3, 7, 6),  # back
        (0, 4, 7, 3),  # left
        (1, 2, 6, 5),  # right
    ]
    uvs = {
        0: (0.0, 0.0), 1: (uv_tiling, 0.0), 2: (uv_tiling, uv_tiling), 3: (0.0, uv_tiling),
        4: (0.0, 0.0), 5: (uv_tiling, 0.0), 6: (uv_tiling, uv_tiling), 7: (0.0, uv_tiling),
    }
    return create_mesh(name, vertices, faces, material, uvs)

def build_segment_box(name, p0, p1, y_pos, width_y=0.14, thickness=0.14, material=None):
    """Creates a clean extruded structural beam along the 2D segment (p0 -> p1)."""
    x0, z0 = p0
    x1, z1 = p1
    dx = x1 - x0
    dz = z1 - z0
    L = math.hypot(dx, dz)
    if L < 1e-4:
        return None

    mx = (x0 + x1) / 2.0
    mz = (z0 + z1) / 2.0
    ux, uz = dx / L, dz / L
    nx, nz = -uz, ux
    if mz * nz + mx * nx > 0:
        nx, nz = -nx, -nz

    mx += nx * (thickness / 2.0 + 0.015)
    mz += nz * (thickness / 2.0 + 0.015)
    mz = max(mz, thickness / 2.0)

    hy = width_y / 2.0
    ht = thickness / 2.0
    hl = L / 2.0

    verts = []
    for s_l in [-hl, hl]:
        for s_y in [-hy, hy]:
            for s_n in [-ht, ht]:
                vx = mx + s_l * ux + s_n * nx
                vy = y_pos + s_y
                vz = max(mz + s_l * uz + s_n * nz, 0.0)
                verts.append((vx, vy, vz))

    faces = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    return create_mesh(name, verts, faces, material)

def build_cylinder(name, base_pos, radius, height, segments=12, material=None):
    bx, by, bz = base_pos
    vertices = []
    for ring in [0.0, height]:
        for i in range(segments):
            angle = (2.0 * math.pi * i) / segments
            x = bx + radius * math.cos(angle)
            y = by + radius * math.sin(angle)
            z = bz + ring
            vertices.append((x, y, z))

    faces = []
    for i in range(segments):
        ni = (i + 1) % segments
        faces.append((i, ni, segments + ni, segments + i))
    faces.append([i for i in range(segments - 1, -1, -1)])
    faces.append([segments + i for i in range(segments)])

    return create_mesh(name, vertices, faces, material)

def build_asp_stage(output_path, textures_dir):
    clear_scene()

    print("Building Monumental Scena ASP...")

    # Materials
    mat_canopy = make_pbr_material('Mat_Tent_Canopy', (0.96, 0.96, 0.96, 1.0), roughness=0.45,
                                   texture_path=str(textures_dir / 'asp_tent_canopy.png'))
    mat_front_gable = make_pbr_material('Mat_Tent_Front', (1.0, 1.0, 1.0, 1.0), roughness=0.5,
                                        texture_path=str(textures_dir / 'asp_tent_front_gable.png'))
    mat_backdrop = make_pbr_material('Mat_Backdrop', (1.0, 1.0, 1.0, 1.0), roughness=0.45,
                                     texture_path=str(textures_dir / 'asp_backdrop.png'))
    mat_rug = make_pbr_material('Mat_Rug', (0.8, 0.2, 0.2, 1.0), roughness=0.85,
                                texture_path=str(textures_dir / 'asp_rug.png'))
    mat_deck = make_pbr_material('Mat_Deck', (0.6, 0.45, 0.3, 1.0), roughness=0.35,
                                 texture_path=str(textures_dir / 'asp_wood_deck.png'))
    mat_totem = make_pbr_material('Mat_Totem', (1.0, 1.0, 1.0, 1.0), roughness=0.5,
                                  texture_path=str(textures_dir / 'asp_totem.png'))
    mat_letters = make_pbr_material('Mat_Letters', (1.0, 1.0, 1.0, 1.0), roughness=0.3,
                                    texture_path=str(textures_dir / 'asp_letters.png'))

    mat_aluminum = make_pbr_material('Mat_Aluminum', (0.85, 0.87, 0.90, 1.0), roughness=0.25, metallic=0.9)
    mat_dark_metal = make_pbr_material('Mat_Dark_Metal', (0.12, 0.12, 0.14, 1.0), roughness=0.4, metallic=0.6)
    mat_chair_red = make_pbr_material('Mat_Chair_Red', (0.84, 0.08, 0.14, 1.0), roughness=0.75)
    mat_chair_blue = make_pbr_material('Mat_Chair_Blue', (0.08, 0.28, 0.80, 1.0), roughness=0.75)
    mat_light_lens = make_pbr_material('Mat_Light_Lens', (1.0, 0.95, 0.8, 1.0), roughness=0.1,
                                       emission_color=(1.0, 0.92, 0.75, 1.0), emission_strength=3.5)

    mat_mbank_red = make_pbr_material('Mat_mBank_Red', (0.88, 0.06, 0.13, 1.0), roughness=0.35)
    mat_mbank_orange = make_pbr_material('Mat_mBank_Orange', (0.95, 0.45, 0.0, 1.0), roughness=0.35)
    mat_mbank_yellow = make_pbr_material('Mat_mBank_Yellow', (1.0, 0.78, 0.0, 1.0), roughness=0.35)
    mat_mbank_green = make_pbr_material('Mat_mBank_Green', (0.0, 0.65, 0.32, 1.0), roughness=0.35)

    # -------------------------------------------------------------
    # 1. HANGAR PAVILION GEOMETRY
    # -------------------------------------------------------------
    # Width = 34.0m (X: -17.0 to +17.0)
    # Peak height = 16.5m
    # Length = 44.0m (Y: -6.0m front gable to +38.0m rear wall)
    # 12 structural bay arch frames spaced every 4.0m

    x_samples_half = [0.0, 2.6, 5.2, 7.8, 10.4, 13.0, 13.8, 14.7, 15.6, 16.3, 17.0]
    x_samples = [-x for x in reversed(x_samples_half[1:])] + x_samples_half
    profile_pts = [get_profile_point(x) for x in x_samples]

    y_frames = [-6.0, -2.0, 2.0, 6.0, 10.0, 14.0, 18.0, 22.0, 26.0, 30.0, 34.0, 38.0]

    # 1A. Internal Aluminum Arch Ribs
    for fi, yf in enumerate(y_frames):
        for pi in range(len(profile_pts) - 1):
            build_segment_box(f'ArchRib_{fi}_{pi}', profile_pts[pi], profile_pts[pi + 1], yf,
                              width_y=0.14, thickness=0.14, material=mat_aluminum)

    # 1B. White Canopy Membrane (Continuous tension PVC)
    canopy_verts = []
    canopy_faces = []
    canopy_uvs = {}

    nx = len(profile_pts)
    ny = len(y_frames)

    for yi, yf in enumerate(y_frames):
        v_coord = yi / (ny - 1) * 10.0
        for xi, pt in enumerate(profile_pts):
            canopy_verts.append((pt[0], yf, pt[1]))
            u_coord = xi / (nx - 1) * 6.0
            canopy_uvs[len(canopy_verts) - 1] = (u_coord, v_coord)

    for yi in range(ny - 1):
        for xi in range(nx - 1):
            i0 = yi * nx + xi
            i1 = yi * nx + (xi + 1)
            i2 = (yi + 1) * nx + (xi + 1)
            i3 = (yi + 1) * nx + xi
            canopy_faces.append((i0, i1, i2, i3))

    create_mesh('ASP_Tent_Canopy', canopy_verts, canopy_faces, mat_canopy, canopy_uvs, smooth=True)

    # 1C. Side Rollup Openings (Along lower sides near the lawn)
    for side in [-1.0, 1.0]:
        sx = side * 17.0
        for yi in range(len(y_frames) - 1):
            y_start = y_frames[yi]
            y_end = y_frames[yi + 1]
            mid_y = (y_start + y_end) / 2.0
            span_y = y_end - y_start
            build_box(f'SidePost_{side}_{yi}', (sx, y_start, 1.8), (0.12, 0.12, 3.6), mat_aluminum)
            build_box(f'SideRollup_{side}_{yi}', (sx, mid_y, 3.55), (0.18, span_y - 0.2, 0.25), mat_canopy)

    # 1D. Rear Wall (Enclosing the back of the pavilion at Y = +38.0m)
    # Outer rear wall (faces outwards into the meadow, towards +Y)
    rear_verts_out = [(pt[0], 38.0, pt[1]) for pt in reversed(profile_pts)] + [(profile_pts[0][0], 38.0, 0.0), (profile_pts[-1][0], 38.0, 0.0)]
    rear_faces_out = [[i for i in range(len(rear_verts_out))]]
    rear_uvs_out = {i: ((v[0] + 17.0) / 34.0, v[2] / 16.5) for i, v in enumerate(rear_verts_out)}
    create_mesh('ASP_Rear_Wall_Outer', rear_verts_out, rear_faces_out, mat_canopy, rear_uvs_out)

    # Inner rear wall (faces inwards towards the backstage, towards -Y)
    rear_verts_in = [(pt[0], 37.92, pt[1]) for pt in profile_pts] + [(profile_pts[-1][0], 37.92, 0.0), (profile_pts[0][0], 37.92, 0.0)]
    rear_faces_in = [[i for i in range(len(rear_verts_in))]]
    rear_uvs_in = {i: ((v[0] + 17.0) / 34.0, v[2] / 16.5) for i, v in enumerate(rear_verts_in)}
    create_mesh('ASP_Rear_Wall_Inner', rear_verts_in, rear_faces_in, mat_canopy, rear_uvs_in)

    # -------------------------------------------------------------
    # 2. FRONT GABLE WALL & MONUMENTAL OPEN PORTAL (At Y = -6.0m)
    # -------------------------------------------------------------
    # Lower section (Z: 0 to 5.2m) is wide open across the lawn with vertical columns.
    # Upper section (Z: 5.2m to 16.5m) is the branded gable wall.

    # 2A. Vertical Support Columns in the entrance opening
    post_x_positions = [-12.0, -8.0, -4.0, 0.0, 4.0, 8.0, 12.0]
    for px in post_x_positions:
        build_box(f'FrontPost_{px}', (px, -6.0, 2.6), (0.15, 0.15, 5.2), mat_aluminum)

    # Horizontal aluminum header lintel beam at Z = 5.2m
    build_box('FrontLintel', (0.0, -6.0, 5.2), (28.0, 0.18, 0.18), mat_aluminum)

    # 2B. Upper Gable Wall with Official Branding
    upper_profile = [pt for pt in profile_pts if pt[1] >= 5.18]
    left_pt = upper_profile[0]
    right_pt = upper_profile[-1]

    gable_verts = [(left_pt[0], -6.0, 5.2)] + [(pt[0], -6.0, pt[1]) for pt in upper_profile] + [(right_pt[0], -6.0, 5.2)]
    gable_faces = [[i for i in range(len(gable_verts))]]

    gable_uvs = {}
    for i, v in enumerate(gable_verts):
        # Map X in [-15.0, +15.0] -> U in [0.0, 1.0]
        u = (v[0] + 15.0) / 30.0
        # Map Z in [5.2, 16.5] -> V in [0.0, 1.0]
        v_coord = (v[2] - 5.2) / 11.3
        gable_uvs[i] = (min(max(u, 0.0), 1.0), min(max(v_coord, 0.0), 1.0))

    create_mesh('ASP_Front_Gable_Banner', gable_verts, gable_faces, mat_front_gable, gable_uvs)

    # Corner skirts closing the lower curved eaves on the far left and right
    for side in [-1.0, 1.0]:
        c_verts = [
            (side * 13.5, -6.0, 0.0),
            (side * 13.5, -6.0, 5.2),
            (side * 17.0, -6.0, 0.0),
        ]
        c_faces = [(0, 1, 2) if side > 0 else (0, 2, 1)]
        c_uvs = {0: (0.1, 0.0), 1: (0.1, 0.45), 2: (0.0, 0.0)}
        create_mesh(f'ASP_Corner_Skirt_{side}', c_verts, c_faces, mat_canopy, c_uvs)

    # -------------------------------------------------------------
    # 3. INTERIOR SCENA ASP (MALA SCENA)
    # -------------------------------------------------------------
    # Raised stage deck seated deep inside at Y = 28.0m to 35.0m
    deck_w, deck_d, deck_h = 22.0, 6.0, 1.6
    deck_cx, deck_cy, deck_cz = 0.0, 31.5, deck_h / 2.0

    # Subdeck base
    build_box('ASP_Stage_Subdeck', (deck_cx, deck_cy, deck_cz), (deck_w, deck_d, deck_h), mat_dark_metal)

    # Polished oak top deck surface
    deck_top_verts = [
        (-deck_w / 2.0, deck_cy - deck_d / 2.0, deck_h),
        (deck_w / 2.0, deck_cy - deck_d / 2.0, deck_h),
        (deck_w / 2.0, deck_cy + deck_d / 2.0, deck_h),
        (-deck_w / 2.0, deck_cy + deck_d / 2.0, deck_h),
    ]
    deck_top_faces = [(0, 1, 2, 3)]
    deck_top_uvs = {0: (0.0, 0.0), 1: (6.0, 0.0), 2: (6.0, 3.0), 3: (0.0, 3.0)}
    create_mesh('ASP_Stage_Floor', deck_top_verts, deck_top_faces, mat_deck, deck_top_uvs)

    # Front stage edge skirting
    build_box('ASP_Stage_Skirt', (deck_cx, deck_cy - deck_d / 2.0 - 0.03, deck_cz), (deck_w, 0.06, deck_h), mat_dark_metal)

    # Stage access steps on left and right
    for side in [-1.0, 1.0]:
        st_x = side * (deck_w / 2.0 + 0.9)
        for si in range(4):
            sh = (si + 1) * (deck_h / 4.0)
            sy = deck_cy - 1.0 + si * 0.5
            build_box(f'StageStep_{side}_{si}', (st_x, sy, sh / 2.0), (1.6, 0.5, sh), mat_deck)

    # 3B. Persian / Oriental Concert Rug
    rug_w, rug_d = 10.0, 4.5
    rug_y = deck_cy
    rug_verts = [
        (-rug_w / 2.0, rug_y - rug_d / 2.0, deck_h + 0.02),
        (rug_w / 2.0, rug_y - rug_d / 2.0, deck_h + 0.02),
        (rug_w / 2.0, rug_y + rug_d / 2.0, deck_h + 0.02),
        (-rug_w / 2.0, rug_y + rug_d / 2.0, deck_h + 0.02),
    ]
    rug_faces = [(0, 1, 2, 3)]
    rug_uvs = {0: (0.0, 0.0), 1: (1.0, 0.0), 2: (1.0, 1.0), 3: (0.0, 1.0)}
    create_mesh('ASP_Stage_Rug', rug_verts, rug_faces, mat_rug, rug_uvs)

    # 3C. Authentic Stage Backdrop ("MALA SCENA TYLKO Z NAZWY")
    bd_w = 17.0
    bd_bottom = deck_h
    bd_top = 9.8
    bd_h = bd_top - bd_bottom
    bd_y = 36.8  # In front of rear wall at 38.0m (1.2m backstage clearance)

    bd_verts = [
        (-bd_w / 2.0, bd_y, bd_bottom),
        (bd_w / 2.0, bd_y, bd_bottom),
        (bd_w / 2.0, bd_y, bd_top),
        (-bd_w / 2.0, bd_y, bd_top),
    ]
    bd_faces = [(0, 1, 2, 3)]
    bd_uvs = {0: (0.0, 0.0), 1: (1.0, 0.0), 2: (1.0, 1.0), 3: (0.0, 1.0)}
    create_mesh('ASP_Stage_Backdrop_Art', bd_verts, bd_faces, mat_backdrop, bd_uvs)

    # Aluminum backdrop framing & support structure
    build_box('ASP_Backdrop_Frame_Top', (0.0, bd_y + 0.05, bd_top), (bd_w + 0.4, 0.15, 0.15), mat_aluminum)
    build_box('ASP_Backdrop_Frame_L', (-bd_w / 2.0, bd_y + 0.05, (bd_bottom + bd_top) / 2.0), (0.15, 0.15, bd_h), mat_aluminum)
    build_box('ASP_Backdrop_Frame_R', (bd_w / 2.0, bd_y + 0.05, (bd_bottom + bd_top) / 2.0), (0.15, 0.15, bd_h), mat_aluminum)

    # 3D Blinder Halos along the backdrop divider
    blinder_y = bd_y - 0.05
    blinder_z = bd_bottom + 4.2
    for bi in range(20):
        bx = -7.5 + bi * (15.0 / 19.0)
        build_box(f'BackdropBlinder_{bi}', (bx, blinder_y, blinder_z), (0.35, 0.08, 0.35), mat_light_lens)

    # 3D. ASP Debate Armchairs on the Persian Carpet
    build_box('ASP_Chair_Red_Seat', (-1.8, rug_y, deck_h + 0.45), (1.2, 1.1, 0.4), mat_chair_red)
    build_box('ASP_Chair_Red_Back', (-1.8, rug_y + 0.45, deck_h + 1.0), (1.2, 0.25, 0.9), mat_chair_red)
    build_box('ASP_Chair_Red_ArmL', (-2.45, rug_y, deck_h + 0.65), (0.2, 1.1, 0.55), mat_chair_red)
    build_box('ASP_Chair_Red_ArmR', (-1.15, rug_y, deck_h + 0.65), (0.2, 1.1, 0.55), mat_chair_red)

    build_box('ASP_Chair_Blue_Seat', (1.8, rug_y, deck_h + 0.45), (1.2, 1.1, 0.4), mat_chair_blue)
    build_box('ASP_Chair_Blue_Back', (1.8, rug_y + 0.45, deck_h + 1.0), (1.2, 0.25, 0.9), mat_chair_blue)
    build_box('ASP_Chair_Blue_ArmL', (1.15, rug_y, deck_h + 0.65), (0.2, 1.1, 0.55), mat_chair_blue)
    build_box('ASP_Chair_Blue_ArmR', (2.45, rug_y, deck_h + 0.65), (0.2, 1.1, 0.55), mat_chair_blue)

    # Dynamic microphone on boom stand
    build_cylinder('ASP_Mic_Base', (0.0, rug_y - 1.4, deck_h), 0.24, 0.05, 12, mat_dark_metal)
    build_cylinder('ASP_Mic_Pole', (0.0, rug_y - 1.4, deck_h + 0.05), 0.02, 1.45, 8, mat_dark_metal)
    build_box('ASP_Mic_Capsule', (0.0, rug_y - 1.4, deck_h + 1.55), (0.08, 0.18, 0.08), mat_aluminum)

    # 3E. Concert Equipment (Guitar Amps & Stage Monitors)
    amp_x_positions = [-7.0, -5.2, 5.2, 7.0]
    for idx, ax in enumerate(amp_x_positions):
        ay = 34.5
        build_box(f'ASP_Amp_Bot_{idx}', (ax, ay, deck_h + 0.55), (1.3, 0.65, 0.95), mat_dark_metal)
        build_box(f'ASP_Amp_Top_{idx}', (ax, ay, deck_h + 1.5), (1.26, 0.62, 0.90), mat_dark_metal)
        build_box(f'ASP_Amp_Head_{idx}', (ax, ay, deck_h + 2.15), (1.1, 0.52, 0.42), mat_chair_red if ax < 0 else mat_chair_blue)

    for mx in [-6.0, -3.0, 0.0, 3.0, 6.0]:
        build_box(f'StageMonitor_{mx}', (mx, deck_cy - deck_d / 2.0 + 0.5, deck_h + 0.22), (0.9, 0.6, 0.4), mat_dark_metal)

    # 3F. Overhead Stage Lighting Truss
    truss_z = 9.8
    build_box('StageTruss_Front', (0.0, deck_cy - deck_d / 2.0 + 0.8, truss_z), (16.0, 0.2, 0.2), mat_aluminum)
    build_box('StageTruss_Mid', (0.0, deck_cy, truss_z), (16.0, 0.2, 0.2), mat_aluminum)

    for li in range(10):
        lx = -6.5 + li * (13.0 / 9.0)
        build_cylinder(f'StageSpot_Can_{li}', (lx, deck_cy - deck_d / 2.0 + 0.8, truss_z - 0.45), 0.2, 0.45, 10, mat_dark_metal)
        build_cylinder(f'StageSpot_Lens_{li}', (lx, deck_cy - deck_d / 2.0 + 0.8, truss_z - 0.48), 0.18, 0.04, 10, mat_light_lens)

    # -------------------------------------------------------------
    # 4. FRONT PLAZA ON THE LAWN (Y = -7.0m to -10.0m)
    # -------------------------------------------------------------
    # 4B. Freestanding 3D Zebra-Striped "ASP" Letters (Height 2.6m)
    ax, ay = -1.2, -8.2
    build_box('ASP_Letter_A_Left', (ax - 0.6, ay, 1.3), (0.35, 0.55, 2.6), mat_letters)
    build_box('ASP_Letter_A_Right', (ax + 0.6, ay, 1.3), (0.35, 0.55, 2.6), mat_letters)
    build_box('ASP_Letter_A_Top', (ax, ay, 2.45), (1.3, 0.55, 0.35), mat_letters)
    build_box('ASP_Letter_A_Mid', (ax, ay, 1.25), (1.0, 0.55, 0.3), mat_letters)

    sx, sy = 0.8, -8.2
    build_box('ASP_Letter_S_Top', (sx, sy, 2.45), (1.3, 0.55, 0.35), mat_letters)
    build_box('ASP_Letter_S_Mid', (sx, sy, 1.3), (1.3, 0.55, 0.32), mat_letters)
    build_box('ASP_Letter_S_Bot', (sx, sy, 0.18), (1.3, 0.55, 0.35), mat_letters)
    build_box('ASP_Letter_S_SideT', (sx - 0.5, sy, 1.88), (0.32, 0.55, 0.9), mat_letters)
    build_box('ASP_Letter_S_SideB', (sx + 0.5, sy, 0.72), (0.32, 0.55, 0.9), mat_letters)

    px, py = 2.8, -8.2
    build_box('ASP_Letter_P_Stem', (px - 0.5, py, 1.3), (0.35, 0.55, 2.6), mat_letters)
    build_box('ASP_Letter_P_Top', (px + 0.12, py, 2.45), (1.0, 0.55, 0.35), mat_letters)
    build_box('ASP_Letter_P_Mid', (px + 0.12, py, 1.35), (1.0, 0.55, 0.32), mat_letters)
    build_box('ASP_Letter_P_Loop', (px + 0.5, py, 1.9), (0.32, 0.55, 0.85), mat_letters)

    # 4C. Freestanding 3D mBank Totem (Segmented speech bubble, height 2.6m)
    mx, my = -4.2, -8.2
    mb_h = 2.6
    build_box('mBank_Totem_Red', (mx - 0.65, my, mb_h / 2.0), (0.42, 0.55, mb_h), mat_mbank_red)
    build_box('mBank_Totem_Orange', (mx - 0.22, my, mb_h / 2.0), (0.42, 0.55, mb_h), mat_mbank_orange)
    build_box('mBank_Totem_Yellow', (mx + 0.22, my, mb_h / 2.0), (0.42, 0.55, mb_h), mat_mbank_yellow)
    build_box('mBank_Totem_Green', (mx + 0.65, my, mb_h / 2.0), (0.42, 0.55, mb_h), mat_mbank_green)
    build_box('mBank_Totem_Tail', (mx + 0.65, my, 0.22), (0.35, 0.55, 0.45), mat_mbank_green)

    # -------------------------------------------------------------
    # 5. GLTF EXPORT
    # -------------------------------------------------------------
    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Exporting Monumental Scena ASP to {output_path}...")
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("Monumental Scena ASP export successful!")

if __name__ == '__main__':
    repo_root = Path(__file__).resolve().parents[2]
    stages_dir = repo_root / 'source-assets' / 'stages'
    out_glb = repo_root / 'public' / 'game-assets' / 'world' / 'festival' / 'small_stage.glb'
    build_asp_stage(out_glb, stages_dir)
