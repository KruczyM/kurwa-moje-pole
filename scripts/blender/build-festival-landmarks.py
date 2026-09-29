"""
Procedural 3D Generator for 5 Iconic Pol'and'Rock Festival Landmarks:
1. festival_gate.glb - Brama Główna Pol'and'Rock (Monumental Archway)
2. krishna_village.glb - Pokojowa Wioska Kryszny (Hare Krishna Food Marquee & Feast Pavilion)
3. mud_bath.glb - Strefa Kąpieli Błotnej (The Legendary Mud Bath)
4. fire_truck_osp.glb - Wóz Strażacki OSP (Volunteer Fire Engine Water Cannon)
5. delay_tower.glb - Wieża Nagłośnieniowa Delay (Concert Delay Speaker & Light Tower)
"""

import os
import math
from pathlib import Path
import bpy

def clear_scene():
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
                       texture_path=None, emission_color=(0, 0, 0, 1.0), emission_strength=0.0):
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
        if 'Alpha' in tex_node.outputs and 'Alpha' in bsdf.inputs:
            links.new(tex_node.outputs['Alpha'], bsdf.inputs['Alpha'])
            if hasattr(mat, 'blend_method'):
                mat.blend_method = 'OPAQUE'
            if hasattr(mat, 'shadow_method'):
                mat.shadow_method = 'OPAQUE'

    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def create_mesh(name, vertices, faces, material=None, uvs=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
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

def build_box(name, center, size, material=None, uv_tiling=1.0, uv_rect=None):
    """
    Builds a box centered at (cx, cy, cz) with dimensions (sx, sy, sz).
    If uv_rect is provided: (u0, v0, u1, v1) for the front/back faces.
    """
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
    if uv_rect:
        u0, v0, u1, v1 = uv_rect
        uvs = {
            0: (u0, v0), 1: (u1, v0), 2: (u1, v1), 3: (u0, v1),
            4: (u0, v1), 5: (u1, v1), 6: (u1, v1), 7: (u0, v1),
        }
    else:
        uvs = {
            0: (0.0, 0.0), 1: (uv_tiling, 0.0), 2: (uv_tiling, uv_tiling), 3: (0.0, uv_tiling),
            4: (0.0, 0.0), 5: (uv_tiling, 0.0), 6: (uv_tiling, uv_tiling), 7: (0.0, uv_tiling),
        }
    return create_mesh(name, vertices, faces, material, uvs)

def build_cylinder(name, center, radius, height, segments=12, material=None):
    cx, cy, cz = center
    hz = height / 2.0
    verts = []
    # Bottom ring
    for i in range(segments):
        a = (i / segments) * 2 * math.pi
        verts.append((cx + math.cos(a) * radius, cy + math.sin(a) * radius, cz - hz))
    # Top ring
    for i in range(segments):
        a = (i / segments) * 2 * math.pi
        verts.append((cx + math.cos(a) * radius, cy + math.sin(a) * radius, cz + hz))

    faces = []
    # Side quads
    for i in range(segments):
        next_i = (i + 1) % segments
        faces.append((i, next_i, segments + next_i, segments + i))
    # Bottom and top fan
    faces.append(list(range(segments - 1, -1, -1)))
    faces.append(list(range(segments, segments * 2)))

    return create_mesh(name, verts, faces, material)

def export_glb(output_path):
    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Exporting to {output_path}...")
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("Export successful!")

# =============================================================
# 1. BRAMA FESTIWALOWA (Main Festival Gate)
# =============================================================
def build_festival_gate(out_path, tex_dir):
    clear_scene()
    banner_tex = str(tex_dir / 'festival_gate_banner.png')

    mat_banner = make_pbr_material('Mat_Gate_Banner', texture_path=banner_tex, roughness=0.6)
    mat_truss = make_pbr_material('Mat_Gate_Truss', base_color=(0.78, 0.80, 0.84, 1.0), roughness=0.35, metallic=0.85)
    mat_concrete = make_pbr_material('Mat_Gate_Concrete', base_color=(0.58, 0.59, 0.58, 1.0), roughness=0.92)
    mat_dark = make_pbr_material('Mat_Gate_Dark', base_color=(0.12, 0.12, 0.14, 1.0), roughness=0.7)
    mat_light = make_pbr_material('Mat_Gate_Light', base_color=(0.95, 0.95, 0.95, 1.0), roughness=0.2, emission_color=(1.0, 0.95, 0.85, 1.0), emission_strength=5.0)

    # Dimensions
    span = 14.0       # Clear roadway span between inner edges of towers
    tower_w = 2.0     # Tower width X
    tower_d = 2.4     # Tower depth Y
    tower_h = 8.8     # Total height to top of towers
    clearance_h = 5.8 # Clearance under crossbeam
    cross_h = 2.6     # Height of the arch crossbeam (5.8 to 8.4)

    left_tx = -span / 2.0 - tower_w / 2.0   # -8.0
    right_tx = span / 2.0 + tower_w / 2.0   # +8.0

    # Concrete Ballast Foundations
    for tx in [left_tx, right_tx]:
        build_box(f'Footing_{tx:.0f}', (tx, 0, 0.2), (tower_w + 0.6, tower_d + 0.6, 0.4), mat_concrete)

    # 4 Vertical Columns & Cross-braces for each Tower
    for tx, side_name in [(left_tx, 'Left'), (right_tx, 'Right')]:
        for cx in [-tower_w/2.0 + 0.1, tower_w/2.0 - 0.1]:
            for cy in [-tower_d/2.0 + 0.1, tower_d/2.0 - 0.1]:
                build_box(f'TowerCol_{side_name}_{cx}_{cy}', (tx + cx, cy, tower_h / 2.0), (0.14, 0.14, tower_h), mat_truss)
        # Horizontal rungs every 1.5m
        for zh in range(1, 6):
            z = zh * 1.5
            build_box(f'TowerRungF_{side_name}_{zh}', (tx, -tower_d/2.0 + 0.1, z), (tower_w - 0.2, 0.08, 0.08), mat_truss)
            build_box(f'TowerRungB_{side_name}_{zh}', (tx, tower_d/2.0 - 0.1, z), (tower_w - 0.2, 0.08, 0.08), mat_truss)
            build_box(f'TowerRungL_{side_name}_{zh}', (tx - tower_w/2.0 + 0.1, 0, z), (0.08, tower_d - 0.2, 0.08), mat_truss)
            build_box(f'TowerRungR_{side_name}_{zh}', (tx + tower_w/2.0 - 0.1, 0, z), (0.08, tower_d - 0.2, 0.08), mat_truss)

    # Vertical Tower Banners (UV: left tower [0..0.48, 0..0.48], right tower [0.52..1.0, 0..0.48])
    # Texture layout: top half is main arch [0..1, 0.5..1.0 in V], bottom left is left banner, bottom right is right banner
    build_box('LeftTower_Banner', (left_tx, -tower_d/2.0 - 0.02, 3.4), (tower_w - 0.1, 0.04, 4.4), mat_banner, uv_rect=(0.02, 0.02, 0.48, 0.48))
    build_box('RightTower_Banner', (right_tx, -tower_d/2.0 - 0.02, 3.4), (tower_w - 0.1, 0.04, 4.4), mat_banner, uv_rect=(0.52, 0.02, 0.98, 0.48))

    # Overhead Crossbeam Bridge (spanning from -span/2 - tower_w to +span/2 + tower_w = 18m)
    total_w = span + tower_w * 2.0
    for cy in [-tower_d/2.0 + 0.1, tower_d/2.0 - 0.1]:
        build_box(f'Chord_Bottom_{cy}', (0, cy, clearance_h), (total_w, 0.14, 0.14), mat_truss)
        build_box(f'Chord_Top_{cy}', (0, cy, clearance_h + cross_h), (total_w, 0.14, 0.14), mat_truss)
    # Crossbeam web struts
    for sx in range(-6, 7, 2):
        build_box(f'WebStrut_F_{sx}', (sx, -tower_d/2.0 + 0.1, clearance_h + cross_h / 2.0), (0.08, 0.08, cross_h), mat_truss)
        build_box(f'WebStrut_B_{sx}', (sx, tower_d/2.0 - 0.1, clearance_h + cross_h / 2.0), (0.08, 0.08, cross_h), mat_truss)

    # Monumental Arch Header Banner (Front Face: UV [0.0, 0.5, 1.0, 1.0])
    banner_w = span + 1.2
    banner_h = cross_h - 0.2
    build_box('Main_Gate_Banner', (0, -tower_d/2.0 - 0.04, clearance_h + cross_h / 2.0), (banner_w, 0.05, banner_h), mat_banner, uv_rect=(0.0, 0.5, 1.0, 1.0))
    # Back Face Banner
    build_box('Main_Gate_Banner_Back', (0, tower_d/2.0 + 0.04, clearance_h + cross_h / 2.0), (banner_w, 0.05, banner_h), mat_banner, uv_rect=(0.0, 0.5, 1.0, 1.0))

    # Overhead Lighting: 4 Spotlights on Crossbeam
    for lx in [-5.0, -1.8, 1.8, 5.0]:
        build_box(f'Spot_Fixture_{lx}', (lx, -tower_d/2.0 - 0.35, clearance_h + cross_h + 0.2), (0.45, 0.5, 0.35), mat_dark)
        build_box(f'Spot_Lens_{lx}', (lx, -tower_d/2.0 - 0.61, clearance_h + cross_h + 0.2), (0.35, 0.04, 0.25), mat_light)

    # Ground Turnstile Entry Gates
    for gx in [-4.5, -1.5, 1.5, 4.5]:
        build_box(f'Turnstile_PostL_{gx}', (gx - 0.45, 0, 0.55), (0.08, 0.08, 1.1), mat_truss)
        build_box(f'Turnstile_PostR_{gx}', (gx + 0.45, 0, 0.55), (0.08, 0.08, 1.1), mat_truss)
        build_box(f'Turnstile_Rail_{gx}', (gx, 0, 0.95), (0.9, 0.04, 0.06), mat_truss)

    # Tower Mast Flags on top
    for tx in [left_tx, right_tx]:
        build_cylinder(f'Flagpole_{tx}', (tx, 0, tower_h + 1.2), 0.04, 2.4, material=mat_truss)
        build_box(f'Flag_{tx}', (tx + 0.45, 0, tower_h + 1.8), (0.9, 0.02, 0.55), mat_banner, uv_rect=(0.05, 0.7, 0.3, 0.95))

    export_glb(out_path)

# =============================================================
# 2. POKOJOWA WIOSKA KRYSZNY (Krishna Village)
# =============================================================
def build_krishna_village(out_path, tex_dir):
    clear_scene()
    tex_path = str(tex_dir / 'krishna_village_textures.png')

    mat_tent = make_pbr_material('Mat_Krishna_Tent', texture_path=tex_path, roughness=0.7)
    mat_saffron = make_pbr_material('Mat_Krishna_Saffron', base_color=(0.95, 0.48, 0.10, 1.0), roughness=0.65)
    mat_wood = make_pbr_material('Mat_Krishna_Wood', base_color=(0.60, 0.42, 0.25, 1.0), roughness=0.85)
    mat_steel = make_pbr_material('Mat_Krishna_Steel', base_color=(0.85, 0.86, 0.88, 1.0), roughness=0.25, metallic=0.9)
    mat_curry = make_pbr_material('Mat_Krishna_Curry', base_color=(0.85, 0.55, 0.05, 1.0), roughness=0.45)
    mat_blackboard = make_pbr_material('Mat_Krishna_Menu', texture_path=tex_path, roughness=0.85)

    tw = 14.0  # Width X
    td = 8.0   # Depth Y
    eave_h = 2.6
    ridge_h = 4.8

    # 1. Timber Support Columns (6 Perimeter Poles + 2 Center Ridge Poles)
    for px in [-tw/2 + 0.2, 0, tw/2 - 0.2]:
        for py in [-td/2 + 0.2, td/2 - 0.2]:
            build_cylinder(f'TentPole_{px}_{py}', (px, py, eave_h / 2.0), 0.12, eave_h, material=mat_wood)
    # Ridge Poles
    for px in [-tw/4, tw/4]:
        build_cylinder(f'RidgePole_{px}', (px, 0, ridge_h / 2.0), 0.14, ridge_h, material=mat_wood)
    # Ridge Beam
    build_box('RidgeBeam', (0, 0, ridge_h), (tw, 0.16, 0.16), mat_wood)

    # 2. Sloped Saffron Fabric Canopy
    # Front Slope (-td/2 to 0)
    v_front = [
        (-tw/2, -td/2, eave_h),
        (tw/2, -td/2, eave_h),
        (tw/2, 0, ridge_h),
        (-tw/2, 0, ridge_h),
    ]
    f_front = [(0, 1, 2, 3)]
    uv_f = {0: (0.52, 0.02), 1: (0.98, 0.02), 2: (0.98, 0.48), 3: (0.52, 0.48)}
    create_mesh('Canopy_Front', v_front, f_front, mat_tent, uv_f)

    # Back Slope (0 to td/2)
    v_back = [
        (-tw/2, 0, ridge_h),
        (tw/2, 0, ridge_h),
        (tw/2, td/2, eave_h),
        (-tw/2, td/2, eave_h),
    ]
    f_back = [(0, 1, 2, 3)]
    create_mesh('Canopy_Back', v_back, f_back, mat_tent, uv_f)

    # Left & Right Gables
    v_left = [(-tw/2, -td/2, eave_h), (-tw/2, 0, ridge_h), (-tw/2, td/2, eave_h)]
    create_mesh('Gable_Left', v_left, [(0, 1, 2)], mat_saffron)
    v_right = [(tw/2, -td/2, eave_h), (tw/2, td/2, eave_h), (tw/2, 0, ridge_h)]
    create_mesh('Gable_Right', v_right, [(0, 1, 2)], mat_saffron)

    # 3. Main Header Banner: "POKOJOWA WIOSKA KRYSZNY"
    # UV: top half [0.0, 0.5, 1.0, 1.0]
    build_box('Krishna_Banner', (0, -td/2 - 0.04, eave_h + 0.55), (tw - 0.4, 0.05, 1.1), mat_tent, uv_rect=(0.0, 0.5, 1.0, 1.0))

    # 4. Food Distribution Counter / Bar (Front Servicing Line)
    bar_w = 9.0
    bar_y = -td/2 + 1.2
    build_box('Counter_Top', (0, bar_y, 0.95), (bar_w, 0.85, 0.08), mat_steel)
    build_box('Counter_Front', (0, bar_y - 0.4, 0.45), (bar_w, 0.06, 0.9), mat_wood)
    # Counter Shelves and supports
    for bx in [-bar_w/2 + 0.1, 0, bar_w/2 - 0.1]:
        build_box(f'Counter_Leg_{bx}', (bx, bar_y, 0.45), (0.08, 0.7, 0.9), mat_steel)

    # 3 Giant Stainless Steel Cauldrons on Counter!
    for idx, cx in enumerate([-2.8, 0.0, 2.8]):
        build_cylinder(f'Cauldron_Pot_{idx}', (cx, bar_y, 1.35), 0.42, 0.7, segments=16, material=mat_steel)
        # Golden curry contents inside
        build_cylinder(f'Cauldron_Curry_{idx}', (cx, bar_y, 1.55), 0.39, 0.06, segments=16, material=mat_curry)
        # Big Soup Ladle handle sticking out
        build_cylinder(f'Ladle_{idx}', (cx + 0.2, bar_y + 0.1, 1.8), 0.02, 0.6, material=mat_steel)

    # Stacks of Eco Bio-Plates & Napkins
    for sx in [-4.0, 4.0]:
        build_cylinder(f'Plate_Stack_{sx}', (sx, bar_y, 1.15), 0.18, 0.3, material=mat_wood)

    # 5. Menu Blackboard Stand (UV: [0.02, 0.02, 0.48, 0.48])
    menu_x, menu_y = -tw/2 + 0.8, -td/2 - 1.2
    build_box('Menu_Board', (menu_x, menu_y, 1.3), (1.5, 0.08, 1.1), mat_blackboard, uv_rect=(0.02, 0.02, 0.48, 0.48))
    build_cylinder('Menu_Post_L', (menu_x - 0.7, menu_y, 0.9), 0.04, 1.8, material=mat_wood)
    build_cylinder('Menu_Post_R', (menu_x + 0.7, menu_y, 0.9), 0.04, 1.8, material=mat_wood)

    # 6. Wooden Dining Picnic Tables & Benches (Interior/Side)
    for dy in [0.5, 2.5]:
        for dx in [-3.5, 3.5]:
            # Table
            build_box(f'Dining_Table_{dx}_{dy}', (dx, dy, 0.75), (2.2, 0.8, 0.06), mat_wood)
            build_box(f'Table_LegL_{dx}_{dy}', (dx - 0.9, dy, 0.36), (0.08, 0.65, 0.72), mat_wood)
            build_box(f'Table_LegR_{dx}_{dy}', (dx + 0.9, dy, 0.36), (0.08, 0.65, 0.72), mat_wood)
            # Two benches
            build_box(f'BenchA_{dx}_{dy}', (dx, dy - 0.55, 0.45), (2.2, 0.28, 0.05), mat_wood)
            build_box(f'BenchB_{dx}_{dy}', (dx, dy + 0.55, 0.45), (2.2, 0.28, 0.05), mat_wood)

    # 7. Saffron Peace Flags on Bamboo Poles
    for fx in [-tw/2 - 0.4, tw/2 + 0.4]:
        build_cylinder(f'BambooPole_{fx}', (fx, -td/2, 2.6), 0.04, 5.2, material=mat_wood)
        build_box(f'SaffronFlag_{fx}', (fx + (0.5 if fx > 0 else -0.5), -td/2, 4.4), (1.0, 0.02, 0.6), mat_saffron)

    export_glb(out_path)

# =============================================================
# 3. KĄPIELISKO BŁOTNE (The Legendary Mud Bath)
# =============================================================
def build_mud_bath(out_path, tex_dir):
    clear_scene()
    tex_path = str(tex_dir / 'mud_bath_textures.png')

    mat_mud_sign = make_pbr_material('Mat_Mud_Sign', texture_path=tex_path, roughness=0.85)
    mat_mud_pool = make_pbr_material('Mat_Mud_Wet', base_color=(0.28, 0.18, 0.12, 1.0), roughness=0.18, metallic=0.08) # Glossy wet mud!
    mat_earthen_rim = make_pbr_material('Mat_Mud_Soil', base_color=(0.35, 0.24, 0.16, 1.0), roughness=0.92)
    mat_timber = make_pbr_material('Mat_Mud_Timber', base_color=(0.55, 0.38, 0.24, 1.0), roughness=0.9)
    mat_tape = make_pbr_material('Mat_Mud_Tape', texture_path=tex_path, roughness=0.5)
    mat_hydrant = make_pbr_material('Mat_Mud_Hydrant', base_color=(0.85, 0.12, 0.12, 1.0), roughness=0.35, metallic=0.6)
    mat_water = make_pbr_material('Mat_Mud_Spray', base_color=(0.85, 0.95, 1.0, 0.8), roughness=0.1, emission_color=(0.7, 0.9, 1.0, 1.0), emission_strength=1.5)

    mw = 12.0  # Overall width X
    md = 8.0   # Overall depth Y
    pit_w = 9.4
    pit_d = 5.6

    # 1. Outer Earthen Berm / Bank
    build_box('Earthen_Bank', (0, 0, 0.08), (mw, md, 0.16), mat_earthen_rim)

    # 2. Excavated Wet Mud Pit (Glossy brown puddle with slight depression)
    # We build the mud surface at Z = 0.04
    build_box('Mud_Pool_Surface', (0, 0, 0.04), (pit_w, pit_d, 0.08), mat_mud_pool)

    # Churned mud mounds inside the pit
    mud_mounds = [
        (-2.5, -1.2, 0.4), (2.0, -0.8, 0.35), (0.0, 1.0, 0.45),
        (-3.0, 1.2, 0.3), (3.2, 1.4, 0.38), (1.2, -1.5, 0.32)
    ]
    for idx, (mx, my, mr) in enumerate(mud_mounds):
        build_cylinder(f'Mud_Mound_{idx}', (mx, my, 0.06), mr, 0.12, segments=10, material=mat_earthen_rim)

    # 3. Wooden Boardwalk / Staging Deck on West Edge
    deck_w = 1.8
    deck_x = -mw/2 + deck_w/2 + 0.1
    build_box('Wooden_Deck', (deck_x, 0, 0.16), (deck_w, md - 0.6, 0.14), mat_timber)
    # Deck planks grooves
    for py in range(int(-md/2 + 0.5), int(md/2 - 0.5), 1):
        build_box(f'Plank_Groove_{py}', (deck_x, py, 0.23), (deck_w, 0.04, 0.02), mat_earthen_rim)

    # 4. Fire Hydrant & Water Spray Pipe
    hy_x, hy_y = deck_x, -md/2 + 1.2
    build_cylinder('Hydrant_Base', (hy_x, hy_y, 0.25), 0.16, 0.4, material=mat_hydrant)
    build_cylinder('Hydrant_Stem', (hy_x, hy_y, 0.7), 0.10, 0.6, material=mat_hydrant)
    build_cylinder('Hydrant_Cap', (hy_x, hy_y, 1.05), 0.14, 0.15, material=mat_hydrant)
    # Side outlets
    build_cylinder('Hydrant_OutletL', (hy_x - 0.15, hy_y, 0.75), 0.06, 0.2, material=mat_hydrant)
    # Coiled canvas fire hose on ground
    build_cylinder('Coiled_Hose', (hy_x + 0.4, hy_y, 0.1), 0.32, 0.18, material=mat_earthen_rim)
    # Spray Pipe aiming into the mud pit
    build_cylinder('Spray_Pipe', (hy_x + 0.9, hy_y + 0.5, 0.3), 0.03, 1.2, material=mat_hydrant)
    # Water jet spray arch
    build_cylinder('Water_Spray_Jet', (hy_x + 2.2, hy_y + 1.0, 0.55), 0.08, 2.0, material=mat_water)

    # 5. Perimeter Wooden Stakes & Safety Tape
    stake_coords = []
    # North & South lines
    for sx in range(int(-pit_w/2 - 0.4), int(pit_w/2 + 0.6), 2):
        stake_coords.append((sx, -md/2 + 0.3))
        stake_coords.append((sx, md/2 - 0.3))
    # East line
    for sy in range(int(-md/2 + 1), int(md/2), 2):
        stake_coords.append((mw/2 - 0.3, sy))

    for idx, (px, py) in enumerate(stake_coords):
        build_cylinder(f'Stake_{idx}', (px, py, 0.6), 0.06, 1.2, material=mat_timber)

    # Barrier Tape Strips (UV: [0.0, 0.51, 1.0, 0.61])
    # Connect top of perimeter with ribbon
    build_box('Tape_South', (0, -md/2 + 0.3, 0.9), (mw - 0.6, 0.02, 0.12), mat_tape, uv_rect=(0.0, 0.51, 1.0, 0.61))
    build_box('Tape_North', (0, md/2 - 0.3, 0.9), (mw - 0.6, 0.02, 0.12), mat_tape, uv_rect=(0.0, 0.51, 1.0, 0.61))
    build_box('Tape_East', (mw/2 - 0.3, 0, 0.9), (0.02, md - 0.6, 0.12), mat_tape, uv_rect=(0.0, 0.51, 1.0, 0.61))

    # 6. Iconic Mud Bath Wooden Signboard (UV: top half [0.0, 0.5, 1.0, 1.0])
    sign_x, sign_y = mw/2 - 1.2, -md/2 - 0.8
    build_cylinder('Sign_Post_L', (sign_x - 0.9, sign_y, 1.2), 0.07, 2.4, material=mat_timber)
    build_cylinder('Sign_Post_R', (sign_x + 0.9, sign_y, 1.2), 0.07, 2.4, material=mat_timber)
    build_box('Mud_Signboard', (sign_x, sign_y, 1.8), (2.4, 0.08, 1.2), mat_mud_sign, uv_rect=(0.0, 0.5, 1.0, 1.0))

    export_glb(out_path)

# =============================================================
# 4. WÓZ STRAŻACKI OSP (Fire Truck with Water Monitor)
# =============================================================
def build_fire_truck_osp(out_path, tex_dir):
    clear_scene()
    tex_path = str(tex_dir / 'fire_truck_textures.png')

    mat_truck = make_pbr_material('Mat_Truck_Livery', texture_path=tex_path, roughness=0.35, metallic=0.1)
    mat_red = make_pbr_material('Mat_Truck_Red', base_color=(0.82, 0.10, 0.10, 1.0), roughness=0.3)
    mat_white = make_pbr_material('Mat_Truck_White', base_color=(0.95, 0.95, 0.95, 1.0), roughness=0.4)
    mat_metal = make_pbr_material('Mat_Truck_Metal', base_color=(0.80, 0.82, 0.85, 1.0), roughness=0.3, metallic=0.85)
    mat_rubber = make_pbr_material('Mat_Truck_Rubber', base_color=(0.14, 0.14, 0.14, 1.0), roughness=0.85)
    mat_glass = make_pbr_material('Mat_Truck_Glass', base_color=(0.15, 0.25, 0.35, 1.0), roughness=0.1, metallic=0.2)
    mat_beacon = make_pbr_material('Mat_Truck_BlueLight', base_color=(0.1, 0.5, 1.0, 1.0), roughness=0.2, emission_color=(0.2, 0.6, 1.0, 1.0), emission_strength=4.0)

    truck_len = 7.2
    truck_w = 2.5
    cab_len = 2.4
    body_len = truck_len - cab_len # 4.8
    chassis_z = 0.65
    body_h = 2.1

    # 1. Wheels (Front axle Y = -2.2, Rear dual axles Y = 1.4, 2.6)
    wheel_r = 0.52
    wheel_w = 0.32
    wheel_positions = [
        (-truck_w/2 - 0.05, -2.2), (truck_w/2 + 0.05, -2.2), # Front
        (-truck_w/2 - 0.05, 1.4), (truck_w/2 + 0.05, 1.4),   # Rear 1
        (-truck_w/2 - 0.05, 2.6), (truck_w/2 + 0.05, 2.6),   # Rear 2
    ]
    for idx, (wx, wy) in enumerate(wheel_positions):
        # Build wheel cylinder rotated along X axis
        build_box(f'Wheel_{idx}', (wx, wy, wheel_r), (wheel_w, wheel_r * 1.8, wheel_r * 1.8), mat_rubber)
        build_cylinder(f'WheelRim_{idx}', (wx, wy, wheel_r), wheel_r * 0.55, wheel_w + 0.04, segments=12, material=mat_metal)

    # 2. Chassis Frame & Fuel Tank
    build_box('Chassis_Frame', (0, 0.2, chassis_z), (truck_w - 0.5, truck_len - 0.6, 0.25), mat_rubber)

    # 3. Driver Cabin (Y in [-3.6, -1.2])
    cab_y = -3.6 + cab_len / 2.0
    cab_h = 2.2
    build_box('Cabin_Body', (0, cab_y, chassis_z + cab_h / 2.0), (truck_w, cab_len, cab_h), mat_red)
    # White cab roof
    build_box('Cabin_Roof', (0, cab_y, chassis_z + cab_h + 0.05), (truck_w + 0.04, cab_len + 0.04, 0.1), mat_white)

    # Windshield & Windows
    build_box('Windshield', (0, -3.62, chassis_z + 1.4), (truck_w - 0.3, 0.06, 0.85), mat_glass)
    build_box('SideWindow_L', (-truck_w/2 - 0.02, cab_y - 0.2, chassis_z + 1.4), (0.06, 1.1, 0.8), mat_glass)
    build_box('SideWindow_R', (truck_w/2 + 0.02, cab_y - 0.2, chassis_z + 1.4), (0.06, 1.1, 0.8), mat_glass)

    # Front Grille & Bumper (UV: [0.52, 0.0, 1.0, 0.4])
    build_box('Front_Grille', (0, -3.63, chassis_z + 0.5), (truck_w - 0.2, 0.06, 0.75), mat_truck, uv_rect=(0.52, 0.0, 1.0, 0.4))
    build_box('Front_Bumper', (0, -3.65, chassis_z + 0.1), (truck_w + 0.1, 0.25, 0.3), mat_truck, uv_rect=(0.0, 0.0, 0.5, 0.2))

    # Dual Blue Emergency Beacons on Roof
    for bx in [-0.8, 0.8]:
        build_box(f'Beacon_{bx}', (bx, cab_y - 0.6, chassis_z + cab_h + 0.22), (0.35, 0.25, 0.22), mat_beacon)

    # 4. Tanker Body & Equipment Compartments (Y in [-1.2, +3.6])
    body_y = -1.2 + body_len / 2.0
    build_box('Tanker_Body', (0, body_y, chassis_z + body_h / 2.0), (truck_w, body_len, body_h), mat_red)

    # Left & Right Livery / Shutter Doors (UV: livery [0.0, 0.5, 0.5, 1.0], shutters [0.5, 0.5, 1.0, 1.0])
    build_box('Livery_Left', (-truck_w/2 - 0.02, body_y, chassis_z + body_h / 2.0), (0.04, body_len - 0.2, body_h - 0.2), mat_truck, uv_rect=(0.0, 0.5, 0.5, 1.0))
    build_box('Livery_Right', (truck_w/2 + 0.02, body_y, chassis_z + body_h / 2.0), (0.04, body_len - 0.2, body_h - 0.2), mat_truck, uv_rect=(0.5, 0.5, 1.0, 1.0))

    # 5. Roof Walkway & Equipment (Ladders, Hoses)
    roof_z = chassis_z + body_h
    build_box('Roof_Walkway', (0, body_y, roof_z + 0.04), (truck_w - 0.4, body_len - 0.4, 0.06), mat_metal)
    # Rescue Ladders
    build_box('Ladder_L', (-0.6, body_y, roof_z + 0.18), (0.38, body_len - 0.8, 0.12), mat_metal)
    build_box('Ladder_R', (0.6, body_y, roof_z + 0.18), (0.38, body_len - 0.8, 0.12), mat_metal)

    # 6. Rooftop High-Pressure Water Monitor Cannon (Działko Wodne)!
    cannon_y = -0.6
    build_cylinder('Cannon_Pedestal', (0, cannon_y, roof_z + 0.25), 0.18, 0.45, material=mat_metal)
    build_cylinder('Cannon_Pivot', (0, cannon_y, roof_z + 0.52), 0.12, 0.25, material=mat_red)
    # Double barrel nozzles pointing forward towards the crowd
    build_cylinder('Cannon_Barrel1', (-0.1, cannon_y - 0.5, roof_z + 0.62), 0.06, 0.9, segments=10, material=mat_metal)
    build_cylinder('Cannon_Barrel2', (0.1, cannon_y - 0.5, roof_z + 0.62), 0.06, 0.9, segments=10, material=mat_metal)
    # Control handles
    build_box('Cannon_Handle', (0, cannon_y + 0.25, roof_z + 0.65), (0.45, 0.06, 0.06), mat_rubber)

    export_glb(out_path)

# =============================================================
# 5. WIEŻA DELAY (Concert Delay Speaker & Light Tower)
# =============================================================
def build_delay_tower(out_path, tex_dir):
    clear_scene()
    tex_path = str(tex_dir / 'delay_tower_banner.png')

    mat_banner = make_pbr_material('Mat_Delay_Banner', texture_path=tex_path, roughness=0.6)
    mat_truss = make_pbr_material('Mat_Delay_Truss', base_color=(0.76, 0.78, 0.82, 1.0), roughness=0.35, metallic=0.88)
    mat_deck = make_pbr_material('Mat_Delay_Deck', base_color=(0.52, 0.38, 0.24, 1.0), roughness=0.88)
    mat_speaker = make_pbr_material('Mat_Delay_Speaker', texture_path=tex_path, roughness=0.7)
    mat_flightcase = make_pbr_material('Mat_Delay_Case', base_color=(0.14, 0.15, 0.18, 1.0), roughness=0.45, metallic=0.3)
    mat_light = make_pbr_material('Mat_Delay_Light', base_color=(0.95, 0.95, 0.95, 1.0), roughness=0.2, emission_color=(1.0, 0.95, 0.85, 1.0), emission_strength=6.0)
    mat_dark = make_pbr_material('Mat_Delay_Dark', base_color=(0.1, 0.1, 0.12, 1.0), roughness=0.7)

    tw = 3.6   # Tower footprint X
    td = 3.6   # Tower footprint Y
    th = 11.4  # Total height Z

    # 1. 4 Corner Uprights (Legs)
    for cx in [-tw/2 + 0.1, tw/2 - 0.1]:
        for cy in [-td/2 + 0.1, td/2 - 0.1]:
            build_cylinder(f'DelayLeg_{cx}_{cy}', (cx, cy, th / 2.0), 0.08, th, segments=10, material=mat_truss)
            # Base screw jack foot
            build_box(f'JackFoot_{cx}_{cy}', (cx, cy, 0.04), (0.35, 0.35, 0.08), mat_dark)

    # 2. Horizontal Ledgers every 2.0 m
    for zh in range(1, 6):
        z = zh * 2.0
        build_box(f'Ledger_F_{zh}', (0, -td/2 + 0.1, z), (tw - 0.2, 0.07, 0.07), mat_truss)
        build_box(f'Ledger_B_{zh}', (0, td/2 - 0.1, z), (tw - 0.2, 0.07, 0.07), mat_truss)
        build_box(f'Ledger_L_{zh}', (-tw/2 + 0.1, 0, z), (0.07, td - 0.2, 0.07), mat_truss)
        build_box(f'Ledger_R_{zh}', (tw/2 - 0.1, 0, z), (0.07, td - 0.2, 0.07), mat_truss)

    # 3. Diagonal Bracing on 4 faces
    for zh in [1, 3, 5]:
        z_mid = (zh - 0.5) * 2.0
        build_box(f'Diag_F_{zh}', (0, -td/2 + 0.1, z_mid), (tw * 0.9, 0.05, 1.8), mat_truss)
        build_box(f'Diag_B_{zh}', (0, td/2 - 0.1, z_mid), (tw * 0.9, 0.05, 1.8), mat_truss)

    # 4. Timber Decks (Mid platform at Z=4.0m, Top platform at Z=10.0m)
    build_box('Deck_Mid', (0, 0, 4.04), (tw - 0.2, td - 0.2, 0.08), mat_deck)
    build_box('Deck_Top', (0, 0, 10.04), (tw - 0.2, td - 0.2, 0.08), mat_deck)
    # Top Guardrails
    for gy in [-td/2 + 0.1, td/2 - 0.1]:
        build_box(f'Guardrail_{gy}', (0, gy, 11.0), (tw - 0.2, 0.05, 0.05), mat_truss)

    # 5. Hanging Curved Line-Array Speaker Cluster (J-Array)
    # Outrigger beam extending forward in front of the tower (-Y)
    outrigger_y = -td/2 - 0.8
    build_box('Speaker_Outrigger', (0, ((-td/2) + outrigger_y) / 2.0, 9.8), (0.16, 1.6, 0.16), mat_truss)
    build_box('Rigging_Frame', (0, outrigger_y, 9.5), (1.2, 0.8, 0.12), mat_dark)

    # Cluster of 6 Line-Array speaker enclosures angled down
    for idx in range(6):
        box_z = 9.2 - idx * 0.48
        # Curved displacement forward & angle
        curve_angle = idx * 0.08
        box_y = outrigger_y + math.sin(curve_angle) * 0.35
        # Front speaker grille face mapped with UV: [0.0, 0.0, 0.48, 0.48]
        build_box(f'LineArray_{idx}', (0, box_y, box_z), (1.1, 0.65, 0.42), mat_speaker, uv_rect=(0.0, 0.0, 0.48, 0.48))

    # 6. Scaffolding Sound Mesh Banner (UV: top half [0.0, 0.5, 1.0, 1.0])
    build_box('Delay_Banner_Front', (0, -td/2 - 0.04, 4.5), (tw - 0.4, 0.04, 5.0), mat_banner, uv_rect=(0.0, 0.5, 1.0, 1.0))

    # 7. Ground Equipment: Flight Cases & 400V Power Distro Box (UV: [0.52, 0.0, 0.98, 0.48])
    build_box('Power_Distro', (-0.9, 0.5, 0.7), (0.9, 0.7, 1.2), mat_speaker, uv_rect=(0.52, 0.0, 0.98, 0.48))
    build_box('Rack_Case_1', (0.8, -0.4, 0.5), (0.8, 0.8, 0.9), mat_flightcase)
    build_box('Rack_Case_2', (0.8, 0.6, 0.5), (0.8, 0.8, 0.9), mat_flightcase)

    # 8. Top Spotlights / Floodlights
    for lx in [-1.1, 1.1]:
        build_box(f'Floodlight_{lx}', (lx, -td/2 + 0.1, 11.2), (0.5, 0.4, 0.35), mat_dark)
        build_box(f'Floodlight_Lens_{lx}', (lx, -td/2 - 0.12, 11.2), (0.42, 0.04, 0.28), mat_light)

    export_glb(out_path)

if __name__ == '__main__':
    repo_root = Path(__file__).resolve().parents[2]
    tex_dir = repo_root / 'public' / 'game-assets' / 'world' / 'festival' / 'textures'
    out_dir = repo_root / 'public' / 'game-assets' / 'world' / 'festival'
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Building Festival Gate...")
    build_festival_gate(out_dir / 'festival_gate.glb', tex_dir)

    print("Building Krishna Village...")
    build_krishna_village(out_dir / 'krishna_village.glb', tex_dir)

    print("Building Mud Bath...")
    build_mud_bath(out_dir / 'mud_bath.glb', tex_dir)

    print("Building Fire Truck OSP...")
    build_fire_truck_osp(out_dir / 'fire_truck_osp.glb', tex_dir)

    print("Building Delay Tower...")
    build_delay_tower(out_dir / 'delay_tower.glb', tex_dir)

    print("All 5 festival landmarks generated successfully!")
