#!/usr/bin/env python3
"""
Official Pol'and'Rock Festival Duża Scena (Model 2 - Polish Woodstock Main Stage V2)
Updated with official 32. Pol'and'Rock graphic facade branding from blueprint/photo:
- 80m total width x 21m apex height x 30m stage depth.
- Front facade walls on left and right wings (ściany po prawej i lewej stronie).
- Exactly ONE single widescreen telebim per wing (zamiast po dwa telebimy, po jednym na stronę).
- Official 32. Pol'and'Rock front facade artwork applied across the front elevation:
  * Roof gable fascia with '32. Pol'and'Rock'
  * Left guitarist column
  * Right guitarist column
  * Stage apron skirt with 'SIEMANKO' + '32. POL'AND'ROCK WOŚP'
  * Left and right wing walls with '32. Pol'and'Rock', '32. POL AND ROCK', orange telebim frames, and sponsor strips.
- Enclosing outer side walls (X = +/-40m) and inner portal walls (X = +/-9.5m).
- 2x 16-enclosure J-shaped Line Array clusters (L-Acoustics K1/K2 style) with acoustic metal grilles.
- Full performance backline: drum riser & kit, guitar amp stacks, wedge monitors, mics, monitor desk.
- Curved Mojo crowd barricades in the fosa.
- Central backdrop LED screen with festival sunburst & heart.
- Excludes: truck ramps, power generators, FOH tower.
"""

import sys
import os
import math
from pathlib import Path
import bpy
from mathutils import Vector, Euler, Matrix

# -------------------------------------------------------------
# HELPERS & UTILITIES
# -------------------------------------------------------------
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def get_or_create_collection(name, parent=None):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    if parent:
        parent.children.link(col)
    else:
        bpy.context.scene.collection.children.link(col)
    return col

# Three.js (X, Y up, Z front) -> Blender (X, -Z, Y up)
def t3(x, y, z):
    return (float(x), -float(z), float(y))

def make_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0,
                       emission_color=(0, 0, 0, 1.0), emission_strength=0.0, texture_path=None,
                       use_alpha=False, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic

    if texture_path and Path(texture_path).exists():
        try:
            img = bpy.data.images.load(str(texture_path))
            tex_node = nodes.new(type='ShaderNodeTexImage')
            tex_node.image = img
            links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
            if use_alpha and 'Alpha' in tex_node.outputs and 'Alpha' in bsdf.inputs:
                links.new(tex_node.outputs['Alpha'], bsdf.inputs['Alpha'])
                if hasattr(mat, 'blend_method'):
                    mat.blend_method = 'CLIP'
            if emission_strength > 0:
                links.new(tex_node.outputs['Color'], bsdf.inputs['Emission Color'])
                bsdf.inputs['Emission Strength'].default_value = emission_strength
            links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
            return mat
        except Exception as e:
            print(f"Warning: could not load texture {texture_path}: {e}")

    bsdf.inputs['Base Color'].default_value = base_color
    if emission_strength > 0:
        bsdf.inputs['Emission Color'].default_value = emission_color
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'

    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def create_mesh(name, vertices, faces, material=None, collection=None, uvs=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    if uvs and len(uvs) == len(mesh.polygons):
        uv_layer = mesh.uv_layers.new(name="UVMap")
        for p_idx, poly in enumerate(mesh.polygons):
            poly_uv = uvs[p_idx]
            for l_idx, loop in enumerate(poly.loop_indices):
                uv_layer.data[loop].uv = poly_uv[l_idx]

    obj = bpy.data.objects.new(name, mesh)
    if material:
        obj.data.materials.append(material)

    if collection:
        collection.objects.link(obj)
    else:
        bpy.context.scene.collection.objects.link(obj)
    return obj

def build_box(name, center_t3, size_t3, material, collection=None):
    cx, cy, cz = center_t3
    sx, sy, sz = size_t3
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    pts = [
        (cx - hx, cy - hy, cz - hz),
        (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz),
        (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz),
        (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz),
        (cx - hx, cy + hy, cz + hz),
    ]
    b_verts = [t3(*p) for p in pts]
    faces = [
        (0, 1, 2, 3), # rear
        (4, 5, 6, 7), # front
        (0, 4, 7, 3), # left
        (1, 2, 6, 5), # right
        (3, 2, 6, 7), # top
        (0, 1, 5, 4), # bottom
    ]
    uv_box = [
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
    ]
    return create_mesh(name, b_verts, faces, material, collection, uvs=uv_box)

def build_textured_quad(name, p0, p1, p2, p3, material, collection=None, uvs=((0,0),(1,0),(1,1),(0,1))):
    b_verts = [t3(*p0), t3(*p1), t3(*p2), t3(*p3)]
    faces = [(0, 1, 2, 3)]
    return create_mesh(name, b_verts, faces, material, collection, uvs=[uvs])

def build_tube(name, p1_t, p2_t, radius, material, collection=None, segments=6):
    b1 = t3(*p1_t)
    b2 = t3(*p2_t)
    dx = b2[0] - b1[0]
    dy = b2[1] - b1[1]
    dz = b2[2] - b1[2]
    L = math.sqrt(dx*dx + dy*dy + dz*dz)
    if L < 1e-4:
        return None
    dir_v = (dx/L, dy/L, dz/L)
    up = (0, 0, 1) if abs(dir_v[2]) < 0.95 else (0, 1, 0)
    px = dir_v[1]*up[2] - dir_v[2]*up[1]
    py = dir_v[2]*up[0] - dir_v[0]*up[2]
    pz = dir_v[0]*up[1] - dir_v[1]*up[0]
    pl = math.sqrt(px*px + py*py + pz*pz)
    u_v = (px/pl, py/pl, pz/pl)
    qx = dir_v[1]*u_v[2] - dir_v[2]*u_v[1]
    qy = dir_v[2]*u_v[0] - dir_v[0]*u_v[2]
    qz = dir_v[0]*u_v[1] - dir_v[1]*u_v[0]
    v_v = (qx, qy, qz)

    verts = []
    faces = []
    for ring_base in [b1, b2]:
        for i in range(segments):
            ang = (i / segments) * math.pi * 2
            rx = ring_base[0] + radius * (math.cos(ang)*u_v[0] + math.sin(ang)*v_v[0])
            ry = ring_base[1] + radius * (math.cos(ang)*u_v[1] + math.sin(ang)*v_v[1])
            rz = ring_base[2] + radius * (math.cos(ang)*u_v[2] + math.sin(ang)*v_v[2])
            verts.append((rx, ry, rz))

    for i in range(segments):
        i_next = (i + 1) % segments
        faces.append((i, i_next, segments + i_next, segments + i))

    return create_mesh(name, verts, faces, material, collection)

def build_square_truss(name, p_start, p_end, width, chord_r, diag_r, material, collection=None, bay_len=1.4):
    dx = p_end[0] - p_start[0]
    dy = p_end[1] - p_start[1]
    dz = p_end[2] - p_start[2]
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    if length < 0.05:
        return None

    hw = width / 2.0
    dir_v = (dx/length, dy/length, dz/length)
    up = (0, 1, 0) if abs(dir_v[1]) < 0.9 else (1, 0, 0)
    rx = dir_v[1]*up[2] - dir_v[2]*up[1]
    ry = dir_v[2]*up[0] - dir_v[0]*up[2]
    rz = dir_v[0]*up[1] - dir_v[1]*up[0]
    rl = math.sqrt(rx*rx + ry*ry + rz*rz)
    u_v = (rx/rl, ry/rl, rz/rl)
    ux = dir_v[1]*u_v[2] - dir_v[2]*u_v[1]
    uy = dir_v[2]*u_v[0] - dir_v[0]*u_v[2]
    uz = dir_v[0]*u_v[1] - dir_v[1]*u_v[0]
    v_v = (ux, uy, uz)

    corners = [
        (-hw*u_v[0] - hw*v_v[0], -hw*u_v[1] - hw*v_v[1], -hw*u_v[2] - hw*v_v[2]),
        ( hw*u_v[0] - hw*v_v[0],  hw*u_v[1] - hw*v_v[1],  hw*u_v[2] - hw*v_v[2]),
        ( hw*u_v[0] + hw*v_v[0],  hw*u_v[1] + hw*v_v[1],  hw*u_v[2] + hw*v_v[2]),
        (-hw*u_v[0] + hw*v_v[0], -hw*u_v[1] + hw*v_v[1], -hw*u_v[2] + hw*v_v[2]),
    ]

    bays = max(1, int(round(length / bay_len)))

    # Main 4 longitudinal chords
    for c_idx, c_off in enumerate(corners):
        c_start = (p_start[0] + c_off[0], p_start[1] + c_off[1], p_start[2] + c_off[2])
        c_end = (p_end[0] + c_off[0], p_end[1] + c_off[1], p_end[2] + c_off[2])
        build_tube(f"{name}_chord_{c_idx}", c_start, c_end, chord_r, material, collection, segments=6)

    # Bays: horizontal rungs & diagonal cross braces
    for b in range(bays):
        t0 = b / bays
        t1 = (b + 1) / bays
        for i in range(4):
            i_next = (i + 1) % 4
            c1_0 = (p_start[0] + t0*dx + corners[i][0], p_start[1] + t0*dy + corners[i][1], p_start[2] + t0*dz + corners[i][2])
            c2_0 = (p_start[0] + t0*dx + corners[i_next][0], p_start[1] + t0*dy + corners[i_next][1], p_start[2] + t0*dz + corners[i_next][2])
            c2_1 = (p_start[0] + t1*dx + corners[i_next][0], p_start[1] + t1*dy + corners[i_next][1], p_start[2] + t1*dz + corners[i_next][2])
            build_tube(f"{name}_rung_{b}_{i}", c1_0, c2_0, diag_r * 0.9, material, collection, segments=4)
            build_tube(f"{name}_diag_{b}_{i}", c1_0, c2_1, diag_r, material, collection, segments=4)

    for i in range(4):
        i_next = (i + 1) % 4
        c1_1 = (p_end[0] + corners[i][0], p_end[1] + corners[i][1], p_end[2] + corners[i][2])
        c2_1 = (p_end[0] + corners[i_next][0], p_end[1] + corners[i_next][1], p_end[2] + corners[i_next][2])
        build_tube(f"{name}_end_rung_{i}", c1_1, c2_1, diag_r * 0.9, material, collection, segments=4)

def build_circular_tube(name, tf, radius, tube_r, material, collection=None, segments=48, tube_segments=6):
    verts = []
    faces = []

    for i in range(segments):
        theta = 2.0 * math.pi * i / segments
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        for j in range(tube_segments):
            phi = 2.0 * math.pi * j / tube_segments
            cos_p, sin_p = math.cos(phi), math.sin(phi)
            lx = (radius + tube_r * cos_p) * cos_t
            ly = (radius + tube_r * cos_p) * sin_t
            lz = tube_r * sin_p
            verts.append(t3(*tf((lx, ly, lz))))

    for i in range(segments):
        i_next = (i + 1) % segments
        for j in range(tube_segments):
            j_next = (j + 1) % tube_segments
            v0 = i * tube_segments + j
            v1 = i_next * tube_segments + j
            v2 = i_next * tube_segments + j_next
            v3 = i * tube_segments + j_next
            faces.append((v0, v1, v2, v3))

    return create_mesh(name, verts, faces, material, collection)

def build_annular_disk(name, tf, r_in, r_out, z_depth, material, collection=None, segments=48):
    verts = []
    faces = []
    uvs = []

    for i in range(segments):
        theta0 = 2.0 * math.pi * i / segments
        theta1 = 2.0 * math.pi * (i + 1) / segments

        v0 = (r_in  * math.cos(theta0), r_in  * math.sin(theta0), z_depth)
        v1 = (r_in  * math.cos(theta1), r_in  * math.sin(theta1), z_depth)
        v2 = (r_out * math.cos(theta1), r_out * math.sin(theta1), z_depth)
        v3 = (r_out * math.cos(theta0), r_out * math.sin(theta0), z_depth)

        base_idx = len(verts)
        verts.extend([t3(*tf(v0)), t3(*tf(v1)), t3(*tf(v2)), t3(*tf(v3))])
        faces.append((base_idx, base_idx + 1, base_idx + 2, base_idx + 3))

        def uv_map(lx, ly):
            u = 0.5 + 0.5 * (lx / 7.5)
            v = 0.5 + 0.5 * (ly / 7.5)
            return (u, v)

        uvs.append((uv_map(v0[0], v0[1]), uv_map(v1[0], v1[1]), uv_map(v2[0], v2[1]), uv_map(v3[0], v3[1])))

    return create_mesh(name, verts, faces, material, collection, uvs=uvs)

def build_box_tf(name, tf, center_l, size_l, material, collection=None):
    cx, cy, cz = center_l
    sx, sy, sz = size_l
    dx, dy, dz = sx / 2.0, sy / 2.0, sz / 2.0
    corners_l = [
        (cx - dx, cy - dy, cz - dz),
        (cx + dx, cy - dy, cz - dz),
        (cx + dx, cy + dy, cz - dz),
        (cx - dx, cy + dy, cz - dz),
        (cx - dx, cy - dy, cz + dz),
        (cx + dx, cy - dy, cz + dz),
        (cx + dx, cy + dy, cz + dz),
        (cx - dx, cy + dy, cz + dz),
    ]
    verts = [t3(*tf(pt)) for pt in corners_l]
    faces = [
        (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
        (2, 6, 7, 3), (0, 3, 7, 4), (1, 5, 6, 2)
    ]
    return create_mesh(name, verts, faces, material, collection)

def build_tube_tf(name, tf, p1_l, p2_l, radius, material, collection=None, segments=6):
    p1_w = tf(p1_l)
    p2_w = tf(p2_l)
    return build_tube(name, p1_w, p2_w, radius, material, collection, segments)

def build_moving_head_fixture_tf(name, tf, center_l, angle_rad, material_body, material_lens, collection=None):
    cx, cy, cz = center_l
    build_box_tf(f"{name}_base", tf, (cx, cy, cz - 0.12), (0.28, 0.28, 0.16), material_body, collection)
    build_tube_tf(f"{name}_yoke_l", tf, (cx - 0.12*math.cos(angle_rad), cy - 0.12*math.sin(angle_rad), cz - 0.05),
                  (cx - 0.12*math.cos(angle_rad), cy - 0.12*math.sin(angle_rad), cz + 0.12), 0.016, material_body, collection)
    build_tube_tf(f"{name}_yoke_r", tf, (cx + 0.12*math.cos(angle_rad), cy + 0.12*math.sin(angle_rad), cz - 0.05),
                  (cx + 0.12*math.cos(angle_rad), cy + 0.12*math.sin(angle_rad), cz + 0.12), 0.016, material_body, collection)
    build_box_tf(f"{name}_head", tf, (cx, cy, cz + 0.08), (0.22, 0.22, 0.20), material_body, collection)
    build_box_tf(f"{name}_lens", tf, (cx, cy, cz + 0.19), (0.17, 0.17, 0.03), material_lens, collection)

def build_cone_light_beam(name, p_apex, p_target, r_base, material, collection=None, segments=12):
    dx = p_target[0] - p_apex[0]
    dy = p_target[1] - p_apex[1]
    dz = p_target[2] - p_apex[2]
    L = math.sqrt(dx*dx + dy*dy + dz*dz)
    if L < 0.1:
        return None
    dir_v = (dx/L, dy/L, dz/L)
    up = (0, 1, 0) if abs(dir_v[1]) < 0.9 else (1, 0, 0)
    rx = dir_v[1]*up[2] - dir_v[2]*up[1]
    ry = dir_v[2]*up[0] - dir_v[0]*up[2]
    rz = dir_v[0]*up[1] - dir_v[1]*up[0]
    rl = math.sqrt(rx*rx + ry*ry + rz*rz)
    u_v = (rx/rl, ry/rl, rz/rl)
    v_v = (
        dir_v[1]*u_v[2] - dir_v[2]*u_v[1],
        dir_v[2]*u_v[0] - dir_v[0]*u_v[2],
        dir_v[0]*u_v[1] - dir_v[1]*u_v[0],
    )

    verts = [t3(*p_apex)]
    for i in range(segments):
        ang = 2.0 * math.pi * i / segments
        cu = math.cos(ang) * r_base
        cv = math.sin(ang) * r_base
        vx = p_target[0] + cu*u_v[0] + cv*v_v[0]
        vy = p_target[1] + cu*u_v[1] + cv*v_v[1]
        vz = p_target[2] + cu*u_v[2] + cv*v_v[2]
        verts.append(t3(vx, vy, vz))

    faces = []
    for i in range(segments):
        i_next = (i + 1) % segments
        faces.append((0, 1 + i, 1 + i_next))

    return create_mesh(name, verts, faces, material, collection)

def build_central_lighting_ring(center_pos=(0.0, 8.4, -18.0), tilt_deg=38.0, collection_parent=None):
    cx, cy, cz = center_pos
    rad_tilt = math.radians(tilt_deg)
    cos_t = math.cos(rad_tilt)
    sin_t = math.sin(rad_tilt)

    def tf(p):
        lx, ly, lz = p
        ry = ly * cos_t - lz * sin_t
        rz = ly * sin_t + lz * cos_t
        return (cx + lx, cy + ry, cz + rz)

    col_ring_temp = bpy.data.collections.new("Ring_Components_Temp")
    bpy.context.scene.collection.children.link(col_ring_temp)
    col_truss = col_ring_temp
    col_panels = col_ring_temp
    col_diffusers = col_ring_temp
    col_blinders = col_ring_temp
    col_fixtures = col_ring_temp
    col_electronics = col_ring_temp

    repo_root = Path(__file__).resolve().parents[2]
    tex_dir = repo_root / "source-assets" / "stages"
    ring_tex = tex_dir / "central_lighting_ring_art.png"

    mat_aluminum = make_pbr_material("Ring_Truss_Aluminum", base_color=(0.82, 0.84, 0.88, 1.0), metallic=0.92, roughness=0.25)
    mat_fixture_body = make_pbr_material("Ring_Fixture_MatteBlack", base_color=(0.08, 0.08, 0.09, 1.0), metallic=0.4, roughness=0.6)
    mat_backplate = make_pbr_material("Ring_Chassis_Backplate", base_color=(0.05, 0.05, 0.06, 1.0), roughness=0.8)

    mat_ring_display = make_pbr_material("Ring_LED_Face_Emissive", base_color=(0.95, 0.95, 0.95, 1.0), roughness=0.3,
                                         emission_strength=3.5, texture_path=ring_tex, use_alpha=True)
    mat_blinder_amber = make_pbr_material("Blinder_Sunburst_Glow", base_color=(1.0, 0.94, 0.78, 1.0),
                                          emission_color=(1.0, 0.92, 0.70, 1.0), emission_strength=8.5)
    mat_inner_flood = make_pbr_material("Inner_Ring_Flood_Glow", base_color=(1.0, 0.96, 0.88, 1.0),
                                        emission_color=(1.0, 0.95, 0.85, 1.0), emission_strength=9.0)
    mat_neon_cyan = make_pbr_material("Neon_Diffuser_Cyan", base_color=(0.1, 0.9, 1.0, 1.0),
                                      emission_color=(0.0, 0.92, 1.0, 1.0), emission_strength=6.0)
    mat_neon_gold = make_pbr_material("Neon_Diffuser_Gold", base_color=(1.0, 0.85, 0.2, 1.0),
                                      emission_color=(1.0, 0.85, 0.2, 1.0), emission_strength=6.0)
    mat_neon_pink = make_pbr_material("Neon_Diffuser_Magenta", base_color=(1.0, 0.2, 0.7, 1.0),
                                      emission_color=(1.0, 0.2, 0.7, 1.0), emission_strength=5.5)
    mat_neon_white = make_pbr_material("Neon_Diffuser_BrightWhite", base_color=(1.0, 1.0, 1.0, 1.0),
                                       emission_color=(1.0, 1.0, 1.0, 1.0), emission_strength=7.0)
    mat_lens_glow = make_pbr_material("MovingHead_Lens_Glow", base_color=(0.3, 0.85, 1.0, 1.0),
                                      emission_color=(0.3, 0.85, 1.0, 1.0), emission_strength=7.5)

    # 1. 3D Aluminum Truss Framework
    depth_tiers_lz = [0.0, -0.25, -0.55]
    radii = [2.00, 6.00, 7.50]

    for t_idx, lz in enumerate(depth_tiers_lz):
        cr = 0.038 if t_idx == 0 else 0.032
        build_circular_tube(f"Truss_Outer_T{t_idx}", tf, 7.50, cr, mat_aluminum, col_truss, segments=64)
        build_circular_tube(f"Truss_Mid_T{t_idx}",   tf, 6.00, cr, mat_aluminum, col_truss, segments=64)
        build_circular_tube(f"Truss_Inner_T{t_idx}", tf, 2.00, cr, mat_aluminum, col_truss, segments=48)

        for s_idx in range(24):
            ang = 2.0 * math.pi * s_idx / 24
            ca, sa = math.cos(ang), math.sin(ang)
            build_tube_tf(f"Spoke_T{t_idx}_{s_idx}_A", tf, (2.00*ca, 2.00*sa, lz), (6.00*ca, 6.00*sa, lz), 0.024, mat_aluminum, col_truss, segments=4)
            build_tube_tf(f"Spoke_T{t_idx}_{s_idx}_B", tf, (6.00*ca, 6.00*sa, lz), (7.50*ca, 7.50*sa, lz), 0.024, mat_aluminum, col_truss, segments=4)

    for s_idx in range(24):
        ang = 2.0 * math.pi * s_idx / 24
        ca, sa = math.cos(ang), math.sin(ang)
        for r_val in radii:
            build_tube_tf(f"Longitudinal_{s_idx}_{r_val}", tf, (r_val*ca, r_val*sa, 0.0), (r_val*ca, r_val*sa, -0.55), 0.028, mat_aluminum, col_truss, segments=4)

        next_ang = 2.0 * math.pi * ((s_idx + 1) % 24) / 24
        nca, nsa = math.cos(next_ang), math.sin(next_ang)
        build_tube_tf(f"Diag_Outer_{s_idx}", tf, (7.50*ca, 7.50*sa, 0.0), (7.50*nca, 7.50*nsa, -0.55), 0.018, mat_aluminum, col_truss, segments=4)
        build_tube_tf(f"Diag_Mid_{s_idx}",   tf, (6.00*ca, 6.00*sa, 0.0), (6.00*nca, 6.00*nsa, -0.55), 0.018, mat_aluminum, col_truss, segments=4)

    build_annular_disk("Ring_Chassis_Backplate", tf, 2.0, 7.5, -0.06, mat_backplate, col_truss, segments=64)

    # 2. Warstwa 1 & 2: WS2811 Pixel Strips & High Density Core
    build_annular_disk("Ring_Main_LED_Display_Face", tf, 2.0, 6.0, 0.01, mat_ring_display, col_panels, segments=64)

    for sec_idx in range(24):
        ang_base = 2.0 * math.pi * sec_idx / 24
        d_ang = (2.0 * math.pi / 24)

        for st_idx in range(6):
            t_s = (st_idx + 0.5) / 6.0
            st_ang = ang_base + t_s * d_ang
            c_st, s_st = math.cos(st_ang), math.sin(st_ang)

            p_s0 = (2.05 * c_st, 2.05 * s_st, 0.02)
            p_s1 = (5.95 * c_st, 5.95 * s_st, 0.02)
            build_tube_tf(f"WS2811_StripChannel_{sec_idx}_{st_idx}", tf, p_s0, p_s1, 0.012, mat_fixture_body, col_panels, segments=4)

            if st_idx < 5:
                next_ang = ang_base + ((st_idx + 1) + 0.5) / 6.0 * d_ang
                cn_st, sn_st = math.cos(next_ang), math.sin(next_ang)
                if st_idx % 2 == 0:
                    build_tube_tf(f"Serial_Loop_Out_{sec_idx}_{st_idx}", tf, (5.92*c_st, 5.92*s_st, 0.03), (5.92*cn_st, 5.92*sn_st, 0.03), 0.007, mat_fixture_body, col_panels, segments=3)
                else:
                    build_tube_tf(f"Serial_Loop_In_{sec_idx}_{st_idx}", tf, (2.08*c_st, 2.08*s_st, 0.03), (2.08*cn_st, 2.08*sn_st, 0.03), 0.007, mat_fixture_body, col_panels, segments=3)

    for f_idx in range(24):
        f_ang = 2.0 * math.pi * f_idx / 24
        ca, sa = math.cos(f_ang), math.sin(f_ang)
        fx, fy = 2.15 * ca, 2.15 * sa
        build_box_tf(f"Inner_Flood_Housing_{f_idx}", tf, (fx, fy, 0.00), (0.24, 0.24, 0.16), mat_fixture_body, col_blinders)
        build_box_tf(f"Inner_Flood_Lens_{f_idx}",    tf, (fx, fy, 0.08), (0.20, 0.20, 0.04), mat_inner_flood, col_blinders)

    build_circular_tube("Inner_Core_Bezel_Gold", tf, 2.00, 0.035, mat_neon_gold, col_diffusers, segments=48)

    # 3. Warstwa 3: Radiant Blinder Bars & Diffusion Rings
    build_annular_disk("Ring_Crown_LED_Face", tf, 6.0, 7.5, 0.01, mat_ring_display, col_panels, segments=64)

    for b_idx in range(48):
        b_ang = 2.0 * math.pi * b_idx / 48
        ca, sa = math.cos(b_ang), math.sin(b_ang)
        p_in  = (6.10 * ca, 6.10 * sa, 0.04)
        p_out = (7.40 * ca, 7.40 * sa, 0.04)
        build_tube_tf(f"Blinder_Bar_Frame_{b_idx}", tf, p_in, p_out, 0.022, mat_fixture_body, col_blinders, segments=4)
        p_em_in  = (6.12 * ca, 6.12 * sa, 0.06)
        p_em_out = (7.38 * ca, 7.38 * sa, 0.06)
        build_tube_tf(f"Blinder_Emitter_Beam_{b_idx}", tf, p_em_in, p_em_out, 0.016, mat_blinder_amber, col_blinders, segments=4)

    diff_configs = [
        ("Ring_Diffuser_1_Cyan",  6.35, 0.040, 0.12, mat_neon_cyan),
        ("Ring_Diffuser_2_Gold",  6.75, 0.042, 0.09, mat_neon_gold),
        ("Ring_Diffuser_3_Pink",  7.15, 0.045, 0.06, mat_neon_pink),
        ("Ring_Diffuser_4_White", 7.50, 0.048, 0.03, mat_neon_white),
    ]
    for d_name, d_rad, d_tube_r, d_lz, d_mat in diff_configs:
        build_circular_tube(d_name, tf, d_rad, d_tube_r, d_mat, col_diffusers, segments=64, tube_segments=6)

    for f_idx in range(24):
        f_ang = 2.0 * math.pi * (f_idx + 0.5) / 24
        fx = 7.40 * math.cos(f_ang)
        fy = 7.40 * math.sin(f_ang)
        build_moving_head_fixture_tf(f"Outer_MovingHead_{f_idx}", tf, (fx, fy, 0.06), f_ang, mat_fixture_body, mat_lens_glow, col_fixtures)

    # 4. Light shafts omitted as requested ("usuń te snopy światła")

    # 5. Rear Rigging & Suspension
    for p_idx in range(8):
        p_ang = 2.0 * math.pi * (p_idx + 0.5) / 8
        px = 6.0 * math.cos(p_ang)
        py = 6.0 * math.sin(p_ang)
        build_box_tf(f"Power_DMX_Module_{p_idx}", tf, (px, py, -0.68), (0.50, 0.38, 0.22), mat_fixture_body, col_electronics)

    for h_idx, h_ang_deg in enumerate([45, 75, 105, 135]):
        h_ang = math.radians(h_ang_deg)
        hx_l = 7.45 * math.cos(h_ang)
        hy_l = 7.45 * math.sin(h_ang)
        p_shackle_w = tf((hx_l, hy_l, -0.55))
        build_box_tf(f"Suspension_Shackle_{h_idx}", tf, (hx_l, hy_l, -0.55), (0.15, 0.28, 0.15), mat_aluminum, col_truss)
        build_tube(f"Hoist_Cable_{h_idx}", p_shackle_w, (p_shackle_w[0], 20.0, p_shackle_w[2]), 0.018, mat_aluminum, col_truss, segments=4)

    for b_tether_idx, bt_sign in enumerate([-1, 1]):
        p_base_w = tf((bt_sign * 3.5, -7.0, -0.55))
        build_tube(f"Base_Tether_Strut_{b_tether_idx}", p_base_w, (p_base_w[0], 2.5, p_base_w[2] - 0.6), 0.045, mat_aluminum, col_truss, segments=4)

    # Merge all components of the lighting ring into a single object
    # ("w dużej scenie ring oświetleniowy dodaj jako jeden obiekt, żeby łatwo go było zaznaczyć w blenderze")
    ring_parts = [o for o in col_ring_temp.objects if o.type == 'MESH']
    single_ring = None
    if ring_parts:
        bpy.ops.object.select_all(action='DESELECT')
        for o in ring_parts:
            o.select_set(True)
        bpy.context.view_layer.objects.active = ring_parts[0]
        bpy.ops.object.join()
        single_ring = bpy.context.view_layer.objects.active
        single_ring.name = "Central_Lighting_Ring"
        
        target_col = collection_parent if collection_parent else bpy.context.scene.collection
        if single_ring.name not in target_col.objects:
            target_col.objects.link(single_ring)
        if single_ring.name in col_ring_temp.objects:
            col_ring_temp.objects.unlink(single_ring)

    bpy.data.collections.remove(col_ring_temp)
    print(f"Inclined Central Lighting Ring (tilt={tilt_deg} deg, single object: {single_ring.name}) created successfully!")
    return single_ring


# -------------------------------------------------------------
# FACADE UV MAPPING HELPER
# -------------------------------------------------------------
def facade_uv(x, y):
    """
    Maps world space (X, Y) on the front facade plane to UV coordinates
    of the 4096x1468 texture (main_stage_v2_facade_full.png):
    - X in [-40.0, +40.0] -> texture pixel X in [128, 4028]
    - Y in [0.0, 21.0] -> texture pixel Y in [1464, 68]
    """
    u_norm = (x - (-40.0)) / 80.0
    u = (128.0 + u_norm * (4028.0 - 128.0)) / 4096.0

    y_norm = y / 21.0
    y_px = 1464.0 - y_norm * (1464.0 - 68.0)
    v = 1.0 - (y_px / 1468.0)
    return (u, v)

# -------------------------------------------------------------
# MAIN GENERATOR FUNCTION
# -------------------------------------------------------------
def build_polandrock_main_stage_v2():
    print("Building Official Pol'and'Rock Festival Duża Scena (Model 2)...")
    clear_scene()

    col_stage = get_or_create_collection("Main_Stage_V2")
    col_towers = get_or_create_collection("Truss_Towers", col_stage)
    col_roof = get_or_create_collection("Pitch_Roof_System", col_stage)
    col_facade = get_or_create_collection("Front_Facade_Branding", col_stage)
    col_wings = get_or_create_collection("Layher_Wings", col_stage)
    col_audio = get_or_create_collection("PA_Line_Arrays", col_stage)
    col_lighting = get_or_create_collection("Lighting_Bridges", col_stage)
    col_screens = get_or_create_collection("LED_Video_Walls", col_stage)
    col_barriers = get_or_create_collection("Mojo_Fosa_Barriers", col_stage)
    col_backline = get_or_create_collection("Stage_Backline", col_stage)

    repo_root = Path(__file__).resolve().parents[2]
    tex_dir = repo_root / "source-assets" / "stages"

    # Materials
    mat_steel_hd = make_pbr_material("Steel_HD_Truss", base_color=(0.78, 0.80, 0.84, 1.0), metallic=0.92, roughness=0.28)
    mat_scaffolding = make_pbr_material("Layher_Galvanized_Steel", base_color=(0.72, 0.74, 0.78, 1.0), metallic=0.88, roughness=0.35)
    mat_deck = make_pbr_material("Stage_Black_Deck", base_color=(0.11, 0.11, 0.12, 1.0), roughness=0.75, texture_path=tex_dir / "main_stage_deck.png")
    mat_scrim = make_pbr_material("Black_Acoustic_Scrim", base_color=(0.04, 0.04, 0.05, 1.0), roughness=0.92)
    mat_roof_pvc = make_pbr_material("Roof_Canopy_PVC", base_color=(0.14, 0.15, 0.17, 1.0), roughness=0.55)
    mat_concrete = make_pbr_material("Concrete_Ballast_Block", base_color=(0.58, 0.58, 0.56, 1.0), roughness=0.88)
    mat_speaker_body = make_pbr_material("PA_Speaker_Polyurea", base_color=(0.06, 0.06, 0.07, 1.0), metallic=0.08, roughness=0.82)
    mat_speaker_grille = make_pbr_material("PA_Speaker_Grille", base_color=(0.18, 0.18, 0.20, 1.0), metallic=0.82, roughness=0.45, texture_path=tex_dir / "main_stage_speaker.png")
    mat_mojo = make_pbr_material("Mojo_Aluminum_Barricade", base_color=(0.82, 0.84, 0.86, 1.0), metallic=0.90, roughness=0.32)
    mat_facade = make_pbr_material("Stage_Facade_Graphics", base_color=(0.95, 0.95, 0.95, 1.0), roughness=0.45, emission_strength=1.2, texture_path=tex_dir / "main_stage_v2_facade_full.png", use_alpha=True)
    # Single Telebims with pure white screen for future live camera feed ("zostaw po prostu biały kolor")
    mat_telebim = make_pbr_material("Wing_Telebim_White_Screen", base_color=(0.96, 0.96, 0.96, 1.0), roughness=0.15, emission_color=(1.0, 1.0, 1.0, 1.0), emission_strength=2.2)
    mat_fixture_body = make_pbr_material("Lighting_Fixture_Black", base_color=(0.08, 0.08, 0.09, 1.0), metallic=0.3, roughness=0.55)
    mat_blinder_glow = make_pbr_material("Halogen_Blinder_Glow", base_color=(1.0, 0.92, 0.72, 1.0), emission_color=(1.0, 0.92, 0.72, 1.0), emission_strength=5.5)
    mat_spot_glow = make_pbr_material("Spot_Beam_Glow", base_color=(0.25, 0.85, 1.0, 1.0), emission_color=(0.25, 0.85, 1.0, 1.0), emission_strength=5.0)
    mat_amp = make_pbr_material("Stage_Amp_Cabinet", base_color=(0.1, 0.1, 0.1, 1.0), roughness=0.6, texture_path=tex_dir / "main_stage_amp.png")

    # =============================================================
    # 1. FOUNDATION & STAGE DECKS (Y = 0 to 2.5m)
    # =============================================================
    # Central rectangular performance deck: X from -13.0 to +13.0, Z from 0.0 to -24.0, Y=2.5
    build_box("Main_Stage_Deck_Plinth", (0.0, 1.25, -12.0), (26.0, 2.48, 24.0), mat_deck, collection=col_stage)

    # Curved front proscenium apron thrust (arc expanding forward to Z = +2.5m at center)
    apron_segments = 24
    apron_verts = [t3(0.0, 2.5, 0.0)]
    for i in range(apron_segments + 1):
        t = i / apron_segments
        ax = -13.0 + t * 26.0
        az = 2.5 * math.cos((ax / 13.0) * (math.pi / 2.0))
        apron_verts.append(t3(ax, 2.5, az))
    apron_faces = []
    for i in range(1, apron_segments + 1):
        apron_faces.append((0, i, i + 1))
    create_mesh("Stage_Apron_Curved_Top", apron_verts, apron_faces, mat_deck, collection=col_stage)

    # Front curved stage skirt
    skirt_verts = []
    skirt_faces = []
    skirt_uvs = []
    v_idx = 0
    for i in range(apron_segments):
        t0 = i / apron_segments
        t1 = (i + 1) / apron_segments
        ax0 = -13.0 + t0 * 26.0
        az0 = 2.5 * math.cos((ax0 / 13.0) * (math.pi / 2.0))
        ax1 = -13.0 + t1 * 26.0
        az1 = 2.5 * math.cos((ax1 / 13.0) * (math.pi / 2.0))

        skirt_verts.extend([
            t3(ax0, 0.0, az0),
            t3(ax1, 0.0, az1),
            t3(ax1, 2.5, az1),
            t3(ax0, 2.5, az0),
        ])
        skirt_faces.append((v_idx, v_idx + 1, v_idx + 2, v_idx + 3))
        skirt_uvs.append(((t0, 0.0), (t1, 0.0), (t1, 1.0), (t0, 1.0)))
        v_idx += 4
    create_mesh("Stage_Apron_Curved_Skirt", skirt_verts, skirt_faces, mat_scrim, collection=col_stage, uvs=skirt_uvs)

    # =============================================================
    # 2. HEAVY DUTY 70x70cm TRUSS TOWERS (6 Mast Pillars)
    # =============================================================
    tower_positions = [
        ("Front_L", -13.0, 2.5),
        ("Front_R",  13.0, 2.5),
        ("Mid_L",   -13.0, -10.5),
        ("Mid_R",    13.0, -10.5),
        ("Rear_L",  -13.0, -23.5),
        ("Rear_R",   13.0, -23.5),
    ]

    for t_name, tx, tz in tower_positions:
        # Concrete ballast foundation block at base
        build_box(f"Tower_Ballast_{t_name}", (tx, 0.45, tz), (2.2, 0.9, 2.2), mat_concrete, collection=col_towers)
        # Steel grounding baseplate
        build_box(f"Tower_Baseplate_{t_name}", (tx, 0.95, tz), (1.4, 0.1, 1.4), mat_steel_hd, collection=col_towers)
        # Heavy Duty 70cm x 70cm Square Truss Mast
        build_square_truss(
            f"Tower_Truss_{t_name}",
            p_start=(tx, 1.0, tz),
            p_end=(tx, 18.5, tz),
            width=0.70,
            chord_r=0.045,
            diag_r=0.022,
            material=mat_steel_hd,
            collection=col_towers,
            bay_len=1.35
        )

    # =============================================================
    # 3. PITCHED ROOF GRID & CANTILEVER CANOPY (8 deg pitch, Apex Y=21m)
    # =============================================================
    # Perimeter & tie trusses
    build_square_truss("Roof_Beam_Front", (-13.0, 18.5, 2.15), (13.0, 18.5, 2.15), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)
    build_square_truss("Roof_Beam_Mid",   (-13.0, 18.5, -10.5), (13.0, 18.5, -10.5), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)
    build_square_truss("Roof_Beam_Rear",  (-13.0, 18.5, -23.5), (13.0, 18.5, -23.5), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)
    build_square_truss("Roof_Beam_Left",  (-13.0, 18.5, 2.5), (-13.0, 18.5, -23.5), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)
    build_square_truss("Roof_Beam_Right", ( 13.0, 18.5, 2.5), ( 13.0, 18.5, -23.5), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)

    # Roof trusses sit flush behind the front facade at Z = 2.5m
    # The 32. Pol'and'Rock gable header forms the front face of the roof structure

    # Rear extension to Z = -25.5m
    build_square_truss("Roof_Cantilever_Rear_L", (-13.0, 18.5, -23.5), (-13.0, 18.5, -25.5), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)
    build_square_truss("Roof_Cantilever_Rear_R", ( 13.0, 18.5, -23.5), ( 13.0, 18.5, -25.5), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)
    build_square_truss("Roof_Beam_Canopy_Rear", (-13.0, 18.5, -25.5), (13.0, 18.5, -25.5), 0.70, 0.045, 0.022, mat_steel_hd, col_roof)

    # Pitched roof gables
    for g_idx, gz in enumerate([2.15, -5.0, -10.5, -17.0, -23.5, -25.5]):
        build_square_truss(f"Roof_Rafter_L_{g_idx}", (-13.0, 18.5, gz), (0.0, 21.0, gz), 0.50, 0.038, 0.018, mat_steel_hd, col_roof)
        build_square_truss(f"Roof_Rafter_R_{g_idx}", ( 13.0, 18.5, gz), (0.0, 21.0, gz), 0.50, 0.038, 0.018, mat_steel_hd, col_roof)
        build_tube(f"Roof_King_Post_{g_idx}", (0.0, 18.5, gz), (0.0, 21.0, gz), 0.035, mat_steel_hd, col_roof)

    # Ridge purlin truss along apex (X = 0, Y = 21.0)
    build_square_truss("Roof_Ridge_Purlin", (0.0, 21.0, 2.15), (0.0, 21.0, -25.5), 0.50, 0.038, 0.018, mat_steel_hd, col_roof)

    # Weatherproof PVC roof canopy planes
    build_textured_quad("Roof_Skin_Left",  (-13.2, 18.6, 2.2), (0.0, 21.1, 2.2), (0.0, 21.1, -25.6), (-13.2, 18.6, -25.6), mat_roof_pvc, col_roof)
    build_textured_quad("Roof_Skin_Right", (0.0, 21.1, 2.2), (13.2, 18.6, 2.2), (13.2, 18.6, -25.6), (0.0, 21.1, -25.6), mat_roof_pvc, col_roof)

    # =============================================================
    # 4. OFFICIAL 32. POL'AND'ROCK FRONT FACADE BRANDING & WALLS
    # =============================================================
    # Front plane is located at Z = 2.70m
    fz = 2.88

    # A. Roof Gable Fascia (Triangular header with '32. Pol'and'Rock')
    # Vertex coordinates:
    # Top Apex: (0.0, 21.0, fz)
    # Left Eave: (-22.0, 15.5, fz)
    # Right Eave: (22.0, 15.5, fz)
    # Bottom Lintel L: (-22.0, 14.5, fz)
    # Bottom Lintel R: (22.0, 14.5, fz)
    gable_verts = [
        t3(0.0, 21.0, fz),    # 0: Apex
        t3(-22.0, 15.5, fz),  # 1: Left Eave
        t3(22.0, 15.5, fz),   # 2: Right Eave
        t3(-22.0, 14.5, fz),  # 3: Left Bottom
        t3(22.0, 14.5, fz),   # 4: Right Bottom
        t3(0.0, 14.5, fz),    # 5: Center Bottom
    ]
    gable_faces = [
        (0, 1, 3, 5), # Left Gable Half
        (0, 5, 4, 2), # Right Gable Half
    ]
    gable_uvs = [
        (facade_uv(0.0, 21.0), facade_uv(-22.0, 15.5), facade_uv(-22.0, 14.5), facade_uv(0.0, 14.5)),
        (facade_uv(0.0, 21.0), facade_uv(0.0, 14.5), facade_uv(22.0, 14.5), facade_uv(22.0, 15.5)),
    ]
    create_mesh("Facade_Roof_Gable_Fascia", gable_verts, gable_faces, mat_facade, col_facade, uvs=gable_uvs)

    # B. Central Stage Apron Skirt (contains 'SIEMANKO' + '32. POL'AND'ROCK WOŚP')
    # X in [-22.0, 22.0], Y in [0.0, 2.5]
    skirt_quad_verts = [
        t3(-22.0, 0.0, fz),
        t3( 22.0, 0.0, fz),
        t3( 22.0, 2.5, fz),
        t3(-22.0, 2.5, fz),
    ]
    skirt_quad_uv = (facade_uv(-22.0, 0.0), facade_uv(22.0, 0.0), facade_uv(22.0, 2.5), facade_uv(-22.0, 2.5))
    create_mesh("Facade_Stage_Skirt_Banner", skirt_quad_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[skirt_quad_uv])

    # C. Left Guitarist Portal Column (X in [-22.0, -9.5], Y in [2.5, 14.5])
    col_l_verts = [
        t3(-22.0, 2.5, fz),
        t3( -9.5, 2.5, fz),
        t3( -9.5, 14.5, fz),
        t3(-22.0, 14.5, fz),
    ]
    col_l_uv = (facade_uv(-22.0, 2.5), facade_uv(-9.5, 2.5), facade_uv(-9.5, 14.5), facade_uv(-22.0, 14.5))
    create_mesh("Facade_Guitarist_Column_Left", col_l_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[col_l_uv])

    # D. Right Guitarist Portal Column (X in [9.5, 22.0], Y in [2.5, 14.5])
    col_r_verts = [
        t3( 9.5, 2.5, fz),
        t3(22.0, 2.5, fz),
        t3(22.0, 14.5, fz),
        t3( 9.5, 14.5, fz),
    ]
    col_r_uv = (facade_uv(9.5, 2.5), facade_uv(22.0, 2.5), facade_uv(22.0, 14.5), facade_uv(9.5, 14.5))
    create_mesh("Facade_Guitarist_Column_Right", col_r_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[col_r_uv])

    # E. Left Wing Facade Wall (Solid wall with single telebim window)
    # X in [-40.0, -22.0], Y in [0.0, 16.5]
    # Single Telebim Window: X in [-35.3, -22.3], Y in [7.1, 13.2]
    # Composed of 4 boundary panels framing the single telebim window:
    # 1. Outer Left Column (with '32. POL AND ROCK'): X in [-40.0, -35.3], Y in [0.0, 16.5]
    p_l1_verts = [t3(-40.0, 0.0, fz), t3(-35.3, 0.0, fz), t3(-35.3, 16.5, fz), t3(-40.0, 16.5, fz)]
    p_l1_uv = (facade_uv(-40.0, 0.0), facade_uv(-35.3, 0.0), facade_uv(-35.3, 16.5), facade_uv(-40.0, 16.5))
    create_mesh("Facade_Wing_Wall_L_Outer", p_l1_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_l1_uv])

    # 2. Top Header (with '32. Pol'and'Rock'): X in [-35.3, -22.0], Y in [13.2, 16.5]
    p_l2_verts = [t3(-35.3, 13.2, fz), t3(-22.0, 13.2, fz), t3(-22.0, 16.5, fz), t3(-35.3, 16.5, fz)]
    p_l2_uv = (facade_uv(-35.3, 13.2), facade_uv(-22.0, 13.2), facade_uv(-22.0, 16.5), facade_uv(-35.3, 16.5))
    create_mesh("Facade_Wing_Wall_L_Top", p_l2_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_l2_uv])

    # 3. Bottom Sponsor Strip: X in [-35.3, -22.0], Y in [0.0, 7.1]
    p_l3_verts = [t3(-35.3, 0.0, fz), t3(-22.0, 0.0, fz), t3(-22.0, 7.1, fz), t3(-35.3, 7.1, fz)]
    p_l3_uv = (facade_uv(-35.3, 0.0), facade_uv(-22.0, 0.0), facade_uv(-22.0, 7.1), facade_uv(-35.3, 7.1))
    create_mesh("Facade_Wing_Wall_L_Bot", p_l3_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_l3_uv])

    # 4. Inner Margin (Right of screen window): X in [-22.3, -22.0], Y in [7.1, 13.2]
    p_l4_verts = [t3(-22.3, 7.1, fz), t3(-22.0, 7.1, fz), t3(-22.0, 13.2, fz), t3(-22.3, 13.2, fz)]
    p_l4_uv = (facade_uv(-22.3, 7.1), facade_uv(-22.0, 7.1), facade_uv(-22.0, 13.2), facade_uv(-22.3, 13.2))
    create_mesh("Facade_Wing_Wall_L_Inner", p_l4_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_l4_uv])

    # F. Right Wing Facade Wall (Solid wall with single telebim window)
    # X in [22.0, 40.0], Y in [0.0, 16.5]
    # Single Telebim Window: X in [22.3, 35.3], Y in [7.1, 13.2]
    # 1. Outer Right Column (with '32. POL AND ROCK'): X in [35.3, 40.0], Y in [0.0, 16.5]
    p_r1_verts = [t3(35.3, 0.0, fz), t3(40.0, 0.0, fz), t3(40.0, 16.5, fz), t3(35.3, 16.5, fz)]
    p_r1_uv = (facade_uv(35.3, 0.0), facade_uv(40.0, 0.0), facade_uv(40.0, 16.5), facade_uv(35.3, 16.5))
    create_mesh("Facade_Wing_Wall_R_Outer", p_r1_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_r1_uv])

    # 2. Top Header (with '32. Pol'and'Rock'): X in [22.0, 35.3], Y in [13.2, 16.5]
    p_r2_verts = [t3(22.0, 13.2, fz), t3(35.3, 13.2, fz), t3(35.3, 16.5, fz), t3(22.0, 16.5, fz)]
    p_r2_uv = (facade_uv(22.0, 13.2), facade_uv(35.3, 13.2), facade_uv(35.3, 16.5), facade_uv(22.0, 16.5))
    create_mesh("Facade_Wing_Wall_R_Top", p_r2_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_r2_uv])

    # 3. Bottom Sponsor Strip: X in [22.0, 35.3], Y in [0.0, 7.1]
    p_r3_verts = [t3(22.0, 0.0, fz), t3(35.3, 0.0, fz), t3(35.3, 7.1, fz), t3(22.0, 7.1, fz)]
    p_r3_uv = (facade_uv(22.0, 0.0), facade_uv(35.3, 0.0), facade_uv(35.3, 7.1), facade_uv(22.0, 7.1))
    create_mesh("Facade_Wing_Wall_R_Bot", p_r3_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_r3_uv])

    # 4. Inner Margin (Left of screen window): X in [22.0, 22.3], Y in [7.1, 13.2]
    p_r4_verts = [t3(22.0, 7.1, fz), t3(22.3, 7.1, fz), t3(22.3, 13.2, fz), t3(22.0, 13.2, fz)]
    p_r4_uv = (facade_uv(22.0, 7.1), facade_uv(22.3, 7.1), facade_uv(22.3, 13.2), facade_uv(22.0, 13.2))
    create_mesh("Facade_Wing_Wall_R_Inner", p_r4_verts, [(0, 1, 2, 3)], mat_facade, col_facade, uvs=[p_r4_uv])

    # G. The Single Telebims (One on Left Wing, One on Right Wing)
    # Mounted directly behind the facade window openings at Z = 2.65m
    tele_z = 2.83
    # Left Single Telebim
    build_textured_quad(
        "Wing_Single_Telebim_Left",
        (-35.3, 7.1, tele_z),
        (-22.3, 7.1, tele_z),
        (-22.3, 13.2, tele_z),
        (-35.3, 13.2, tele_z),
        mat_telebim,
        collection=col_screens,
        uvs=((0,0),(1,0),(1,1),(0,1))
    )
    build_box("Wing_Telebim_Backplate_L", (-28.8, 10.15, 2.70), (13.2, 6.3, 0.18), mat_fixture_body, collection=col_screens)

    # Right Single Telebim
    build_textured_quad(
        "Wing_Single_Telebim_Right",
        (22.3, 7.1, tele_z),
        (35.3, 7.1, tele_z),
        (35.3, 13.2, tele_z),
        (22.3, 13.2, tele_z),
        mat_telebim,
        collection=col_screens,
        uvs=((0,0),(1,0),(1,1),(0,1))
    )
    build_box("Wing_Telebim_Backplate_R", (28.8, 10.15, 2.70), (13.2, 6.3, 0.18), mat_fixture_body, collection=col_screens)

    # =============================================================
    # 5. ENCLOSING SIDE WALLS ("ściany po prawej i lewej stronie")
    # =============================================================
    # Outer Left Side Wall (X = -40.0m)
    build_textured_quad(
        "Stage_Outer_Side_Wall_Left",
        (-40.0, 0.0, 2.88),
        (-40.0, 0.0, -23.5),
        (-40.0, 16.5, -23.5),
        (-40.0, 16.5, 2.88),
        mat_scrim,
        collection=col_wings
    )

    # Outer Right Side Wall (X = +40.0m)
    build_textured_quad(
        "Stage_Outer_Side_Wall_Right",
        (40.0, 0.0, -23.5),
        (40.0, 0.0, 2.88),
        (40.0, 16.5, 2.88),
        (40.0, 16.5, -23.5),
        mat_scrim,
        collection=col_wings
    )

    # Portal Left Inner Return Wall (X = -9.5m, enclosing performance space)
    build_textured_quad(
        "Portal_Inner_Wall_Left",
        (-9.5, 2.5, 2.88),
        (-9.5, 2.5, -23.5),
        (-9.5, 18.5, -23.5),
        (-9.5, 18.5, 2.88),
        mat_scrim,
        collection=col_stage
    )

    # Portal Right Inner Return Wall (X = +9.5m, enclosing performance space)
    build_textured_quad(
        "Portal_Inner_Wall_Right",
        (9.5, 2.5, -23.5),
        (9.5, 2.5, 2.88),
        (9.5, 18.5, 2.88),
        (9.5, 18.5, -23.5),
        mat_scrim,
        collection=col_stage
    )

    # Backstage Rear Wall (Z = -23.5m, full 80m width)
    build_textured_quad(
        "Backstage_Rear_Wall",
        (-40.0, 0.0, -23.5),
        ( 40.0, 0.0, -23.5),
        ( 40.0, 16.5, -23.5),
        (-40.0, 16.5, -23.5),
        mat_scrim,
        collection=col_stage
    )

    # Layher Scaffolding support lattice inside the wing towers
    for side_sign, side_name in [(-1, "Left"), (1, "Right")]:
        x_inner = side_sign * 13.0
        x_outer = side_sign * 40.0
        x_min = min(x_inner, x_outer)
        x_max = max(x_inner, x_outer)

        nx_bays = 6
        nz_bays = 6
        ny_tiers = 8

        x_coords = [x_min + i * ((x_max - x_min) / nx_bays) for i in range(nx_bays + 1)]
        z_coords = [2.5 - j * (26.0 / nz_bays) for j in range(nz_bays + 1)]

        for ix, gx in enumerate(x_coords):
            for iz, gz in enumerate(z_coords):
                if ix == 0 or ix == nx_bays or iz == 0 or iz == nz_bays:
                    build_tube(f"Layher_Col_{side_name}_{ix}_{iz}", (gx, 0.0, gz), (gx, 16.5, gz), 0.025, mat_scaffolding, collection=col_wings, segments=4)

        for tier in [2, 4, 6, 8]:
            hy = tier * 2.0
            build_tube(f"Layher_Front_Ledger_{side_name}_{tier}", (x_min, hy, 2.5), (x_max, hy, 2.5), 0.022, mat_scaffolding, collection=col_wings, segments=4)
            build_tube(f"Layher_Rear_Ledger_{side_name}_{tier}", (x_min, hy, -23.5), (x_max, hy, -23.5), 0.022, mat_scaffolding, collection=col_wings, segments=4)
            build_tube(f"Layher_Outer_Ledger_{side_name}_{tier}", (x_outer, hy, 2.5), (x_outer, hy, -23.5), 0.022, mat_scaffolding, collection=col_wings, segments=4)

    # =============================================================
    # 6. LIGHTING BRIDGES (4 Suspended Bridges under Pitch Roof)
    # =============================================================
    bridge_z = [1.2, -5.5, -12.5, -20.5]
    for b_idx, bz in enumerate(bridge_z):
        by = 17.6 - (b_idx * 0.15)
        build_square_truss(
            f"Lighting_Bridge_{b_idx}",
            p_start=(-12.0, by, bz),
            p_end=(12.0, by, bz),
            width=0.52,
            chord_r=0.035,
            diag_r=0.018,
            material=mat_steel_hd,
            collection=col_lighting,
            bay_len=1.2
        )

        for rx in [-11.0, -5.5, 0.0, 5.5, 11.0]:
            roof_y = 21.0 - (abs(rx) / 13.0) * 2.5
            build_tube(f"Hoist_Cable_{b_idx}_{rx}", (rx, by + 0.3, bz), (rx, roof_y - 0.2, bz), 0.012, mat_steel_hd, collection=col_lighting)

        num_fixtures = 10
        for f_idx in range(num_fixtures):
            fx = -10.5 + (f_idx / (num_fixtures - 1)) * 21.0
            fy = by - 0.45
            build_box(f"MovingHead_Body_{b_idx}_{f_idx}", (fx, fy, bz), (0.35, 0.40, 0.35), mat_fixture_body, collection=col_lighting)
            build_tube(f"Yoke_L_{b_idx}_{f_idx}", (fx - 0.18, fy + 0.25, bz), (fx - 0.18, fy - 0.05, bz), 0.015, mat_steel_hd, collection=col_lighting)
            build_tube(f"Yoke_R_{b_idx}_{f_idx}", (fx + 0.18, fy + 0.25, bz), (fx + 0.18, fy - 0.05, bz), 0.015, mat_steel_hd, collection=col_lighting)
            build_box(f"MovingHead_Lens_{b_idx}_{f_idx}", (fx, fy - 0.08, bz + 0.18), (0.24, 0.24, 0.06), mat_spot_glow, collection=col_lighting)

    # 16 Audience Matrix Blinders along proscenium portal lintel facing crowd
    for bl_idx in range(16):
        bl_x = -8.5 + bl_idx * (17.0 / 15.0)
        bl_y = 14.3
        bl_z = 2.88
        build_box(f"Front_Blinder_Frame_{bl_idx}", (bl_x, bl_y, bl_z), (0.38, 0.38, 0.12), mat_fixture_body, collection=col_lighting)
        build_box(f"Front_Blinder_Lens_{bl_idx}", (bl_x, bl_y, bl_z + 0.06), (0.32, 0.32, 0.03), mat_blinder_glow, collection=col_lighting)

    # =============================================================
    # 7. MONUMENTAL CENTRAL LIGHTING RING (15m Ring Tilted at 20 deg)
    #    ("ustaw ten ring oświetleniowy na scenie pod skosem")
    # =============================================================
    # Tilted forward at top (+Z), bottom back at stage floor (-Z)
    # Outer D=15m, Inner Core D=4m (open), Mid Ring D=12m (Layer 1&2 width 4m, Layer 3 width 1.5m)
    # Depth = 5.0m across stage floor, rear wall plain black acoustic scrim
    build_central_lighting_ring(center_pos=(0.0, 8.4, -18.0), tilt_deg=38.0, collection_parent=col_stage)

    # =============================================================
    # 8. J-SHAPED LINE ARRAY SOUND SYSTEM (L-Acoustics K1/K2 Clusters)
    #    (16 Trapezoidal enclosures per hang, progressive J-curve)
    # =============================================================
    for side_sign, side_name in [(-1, "Left"), (1, "Right")]:
        hang_x = side_sign * 10.2
        hang_top_z = 3.6
        hang_top_y = 18.0

        build_square_truss(
            f"PA_Cantilever_Beam_{side_name}",
            p_start=(side_sign * 9.5, 18.5, 2.5),
            p_end=(hang_x, 18.5, hang_top_z),
            width=0.60,
            chord_r=0.038,
            diag_r=0.020,
            material=mat_steel_hd,
            collection=col_audio,
            bay_len=1.0
        )

        build_box(f"PA_Flying_Bumper_{side_name}", (hang_x, hang_top_y, hang_top_z), (1.45, 0.25, 0.75), mat_steel_hd, collection=col_audio)
        build_tube(f"PA_Chain_1_{side_name}", (hang_x - 0.4, 18.5, hang_top_z), (hang_x - 0.4, hang_top_y + 0.12, hang_top_z), 0.015, mat_steel_hd, collection=col_audio)
        build_tube(f"PA_Chain_2_{side_name}", (hang_x + 0.4, 18.5, hang_top_z), (hang_x + 0.4, hang_top_y + 0.12, hang_top_z), 0.015, mat_steel_hd, collection=col_audio)

        num_cabs = 16
        cur_y = hang_top_y - 0.35
        cur_z = hang_top_z

        for c_idx in range(num_cabs):
            if c_idx < 8:
                tilt_deg = 0.5 + c_idx * 0.25
            elif c_idx < 12:
                tilt_deg = 2.5 + (c_idx - 8) * 1.1
            else:
                tilt_deg = 7.0 + (c_idx - 12) * 1.8

            tilt_rad = math.radians(tilt_deg)
            cab_h = 0.44
            cab_w = 1.34
            cab_d = 0.56

            build_box(
                f"K1_Cabinet_{side_name}_{c_idx}",
                (hang_x, cur_y, cur_z),
                (cab_w, cab_h * 0.95, cab_d),
                mat_speaker_body,
                collection=col_audio
            )
            build_box(
                f"K1_Grille_{side_name}_{c_idx}",
                (hang_x, cur_y, cur_z + cab_d/2.0 + 0.01),
                (cab_w * 0.96, cab_h * 0.88, 0.02),
                mat_speaker_grille,
                collection=col_audio
            )

            cur_y -= cab_h * math.cos(tilt_rad) + 0.04
            cur_z += cab_h * math.sin(tilt_rad) * 0.45

        build_box(f"PA_Front_Infill_{side_name}", (side_sign * 8.8, 2.65, 2.4), (0.85, 0.35, 0.45), mat_speaker_body, collection=col_audio)

    # =============================================================
    # 9. MOJO CROWD BARRICADES (Barierki Zaporowe Fosy)
    # =============================================================
    barrier_count = 32
    for b_idx in range(barrier_count):
        t = b_idx / (barrier_count - 1)
        bx = -15.5 + t * 31.0
        bz = 5.6 + 2.4 * math.cos((bx / 15.5) * (math.pi / 2.0))

        build_tube(f"Mojo_Rail_{b_idx}", (bx - 0.46, 1.18, bz), (bx + 0.46, 1.18, bz), 0.024, mat_mojo, collection=col_barriers, segments=6)
        build_tube(f"Mojo_Post_L_{b_idx}", (bx - 0.46, 0.0, bz), (bx - 0.46, 1.18, bz), 0.022, mat_mojo, collection=col_barriers, segments=4)
        build_tube(f"Mojo_Post_R_{b_idx}", (bx + 0.46, 0.0, bz), (bx + 0.46, 1.18, bz), 0.022, mat_mojo, collection=col_barriers, segments=4)
        build_box(f"Mojo_Plate_{b_idx}", (bx, 0.60, bz), (0.90, 1.05, 0.02), mat_mojo, collection=col_barriers)
        build_box(f"Mojo_Step_{b_idx}", (bx, 0.15, bz - 0.38), (0.92, 0.04, 0.55), mat_steel_hd, collection=col_barriers)
        build_tube(f"Mojo_Strut_{b_idx}", (bx, 0.15, bz - 0.60), (bx, 0.85, bz), 0.018, mat_mojo, collection=col_barriers, segments=4)

    # =============================================================
    # 10. STAGE BACKLINE, GEAR & MONITOR WORLD
    # =============================================================
    # Monitor mixing console desk on Stage Left
    build_box("Monitor_Desk_Table", (-8.5, 3.25, -5.5), (3.4, 0.85, 1.4), mat_deck, collection=col_backline)
    build_box("Monitor_Console_Surface", (-8.5, 3.85, -5.5), (3.2, 0.35, 1.2), mat_fixture_body, collection=col_backline)
    build_box("Monitor_Console_Screens", (-8.5, 4.35, -5.8), (2.8, 0.55, 0.1), mat_spot_glow, collection=col_backline)

    # Drum Riser & Drum Kit at center rear (Z = -15.5m)
    build_box("Drum_Riser_Platform", (0.0, 2.8, -15.5), (4.2, 0.6, 3.2), mat_deck, collection=col_backline)
    build_tube("Drum_Bass_Shell", (-0.1, 3.6, -15.8), (-0.1, 3.6, -15.0), 0.42, mat_fixture_body, collection=col_backline, segments=16)
    build_box("Drum_Snare", (-0.8, 3.6, -15.2), (0.40, 0.22, 0.40), mat_steel_hd, collection=col_backline)
    build_box("Drum_Tom_L", (-0.35, 4.15, -15.4), (0.32, 0.25, 0.32), mat_steel_hd, collection=col_backline)
    build_box("Drum_Tom_R", ( 0.25, 4.15, -15.4), (0.35, 0.28, 0.35), mat_steel_hd, collection=col_backline)
    build_box("Drum_Floor_Tom", (0.8, 3.5, -15.2), (0.45, 0.45, 0.45), mat_steel_hd, collection=col_backline)
    for cx, cz, ch in [(-1.3, -15.0, 3.8), (-1.1, -16.2, 4.2), (1.1, -16.2, 4.3), (1.3, -15.0, 3.9)]:
        build_tube(f"Cymbal_Stand_{cx}", (cx, 3.1, cz), (cx, ch, cz), 0.016, mat_steel_hd, collection=col_backline)
        build_box(f"Cymbal_Disk_{cx}", (cx, ch, cz), (0.52, 0.015, 0.52), mat_blinder_glow, collection=col_backline)

    # Guitar Amplifier Stacks (Marshall/Ampeg)
    amp_x = [-6.5, -4.5, -2.5, 2.5, 4.5, 6.5]
    for a_idx, ax in enumerate(amp_x):
        build_box(f"Amp_4x12_Bot_{a_idx}", (ax, 2.95, -14.0), (1.05, 0.90, 0.55), mat_amp, collection=col_backline)
        build_box(f"Amp_4x12_Top_{a_idx}", (ax, 3.90, -14.0), (1.05, 0.90, 0.55), mat_amp, collection=col_backline)
        build_box(f"Amp_Head_{a_idx}", (ax, 4.60, -14.0), (0.95, 0.40, 0.45), mat_fixture_body, collection=col_backline)

    # Stage Wedge Monitors
    for m_idx, mx in enumerate([-7.5, -4.5, -1.8, 1.8, 4.5, 7.5]):
        mz = 1.6 * math.cos((mx / 13.0) * (math.pi / 2.0)) + 0.3
        build_box(f"Stage_Wedge_{m_idx}", (mx, 2.75, mz), (0.75, 0.35, 0.55), mat_fixture_body, collection=col_backline)

    # Vocal Microphones on boom stands
    for v_idx, vx in enumerate([-3.5, 0.0, 3.5]):
        vz = 1.9 * math.cos((vx / 13.0) * (math.pi / 2.0)) + 0.6
        build_tube(f"Vocal_Mic_Pole_{v_idx}", (vx, 2.5, vz), (vx, 3.8, vz), 0.015, mat_steel_hd, collection=col_backline)
        build_tube(f"Vocal_Mic_Boom_{v_idx}", (vx, 3.8, vz), (vx, 4.05, vz + 0.35), 0.012, mat_steel_hd, collection=col_backline)
        build_box(f"Vocal_Mic_Capsule_{v_idx}", (vx, 4.07, vz + 0.40), (0.07, 0.07, 0.14), mat_steel_hd, collection=col_backline)

    print("Duża Scena V2 geometry generated successfully!")

# -------------------------------------------------------------
# CAMERA, LIGHTING & RENDERING SETUP
# -------------------------------------------------------------
def setup_camera_and_lighting(daylight=True):
    col_setup = get_or_create_collection("Studio_Setup")

    sun_data = bpy.data.lights.new('KeySun', 'SUN')
    sun_obj = bpy.data.objects.new('KeySun', sun_data)
    col_setup.objects.link(sun_obj)

    if daylight:
        sun_data.energy = 4.2
        sun_data.color = (1.0, 0.96, 0.90)
        sun_obj.rotation_euler = Euler((math.radians(52), math.radians(15), math.radians(-40)), 'XYZ')
    else:
        sun_data.energy = 0.5
        sun_data.color = (0.35, 0.45, 0.85)
        sun_obj.rotation_euler = Euler((math.radians(65), math.radians(10), math.radians(-70)), 'XYZ')

    fill_data = bpy.data.lights.new('FillLight', 'SUN')
    fill_data.energy = 2.0 if daylight else 0.4
    fill_data.color = (0.80, 0.88, 1.0)
    fill_obj = bpy.data.objects.new('FillLight', fill_data)
    fill_obj.rotation_euler = Euler((math.radians(40), math.radians(-25), math.radians(140)), 'XYZ')
    col_setup.objects.link(fill_obj)

    spot1_data = bpy.data.lights.new('ConcertSpotL', 'SPOT')
    spot1_data.energy = 85000.0 if not daylight else 25000.0
    spot1_data.spot_size = math.radians(65)
    spot1_data.spot_blend = 0.35
    spot1_data.color = (1.0, 0.88, 0.65)
    spot1_obj = bpy.data.objects.new('ConcertSpotL', spot1_data)
    spot1_obj.location = t3(-20.0, 15.0, 28.0)
    spot1_obj.rotation_euler = Euler((math.radians(-32), math.radians(18), math.radians(-15)), 'XYZ')
    col_setup.objects.link(spot1_obj)

    spot2_data = bpy.data.lights.new('ConcertSpotR', 'SPOT')
    spot2_data.energy = 85000.0 if not daylight else 25000.0
    spot2_data.spot_size = math.radians(65)
    spot2_data.spot_blend = 0.35
    spot2_data.color = (0.45, 0.85, 1.0)
    spot2_obj = bpy.data.objects.new('ConcertSpotR', spot2_data)
    spot2_obj.location = t3(20.0, 15.0, 28.0)
    spot2_obj.rotation_euler = Euler((math.radians(-32), math.radians(-18), math.radians(15)), 'XYZ')
    col_setup.objects.link(spot2_obj)

    ground_mat = make_pbr_material('Festival_Grass_Ground', base_color=(0.14, 0.25, 0.12, 1.0), roughness=0.92)
    build_box('Ground_Plane', (0, -0.05, -10.0), (180, 0.1, 140), ground_mat, collection=col_setup)

    scene = bpy.context.scene
    world = bpy.data.worlds.new('FestivalWorld')
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get('Background')
    if bg_node:
        if daylight:
            bg_node.inputs['Color'].default_value = (0.45, 0.62, 0.85, 1.0)
            bg_node.inputs['Strength'].default_value = 1.0
        else:
            bg_node.inputs['Color'].default_value = (0.02, 0.03, 0.07, 1.0)
            bg_node.inputs['Strength'].default_value = 0.7
    scene.world = world

def render_view(cam_pos_t3, look_at_t3, fov_deg, out_png, width=1600, height=950):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(out_png)

    cam_data = bpy.data.cameras.new('RenderCam')
    cam_data.lens_unit = 'FOV'
    cam_data.angle = math.radians(fov_deg)
    cam_obj = bpy.data.objects.new('RenderCam', cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)

    b_cam_pos = t3(*cam_pos_t3)
    b_look_at = t3(*look_at_t3)

    cam_obj.location = Vector(b_cam_pos)
    direction = Vector(b_look_at) - Vector(b_cam_pos)
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()
    scene.camera = cam_obj

    print(f"Rendering view to {out_png}...")
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(cam_obj, do_unlink=True)
    bpy.data.cameras.remove(cam_data, do_unlink=True)

def main():
    repo_root = Path(__file__).resolve().parents[2]
    out_glb = repo_root / 'public' / 'game-assets' / 'world' / 'festival' / 'main_stage_v2.glb'
    out_blend = repo_root / 'blender' / 'main_stage_v2.blend'
    dist_glb = repo_root / 'dist' / 'game-assets' / 'world' / 'festival' / 'main_stage_v2.glb'

    out_blend.parent.mkdir(parents=True, exist_ok=True)
    out_glb.parent.mkdir(parents=True, exist_ok=True)
    if dist_glb.parent.exists():
        dist_glb.parent.mkdir(parents=True, exist_ok=True)

    artifact_dir = Path("C:/Users/krucz/.gemini/antigravity/brain/0f469478-5ced-4cb0-85a6-506fc5188eb0")

    # 1. Build procedural stage
    build_polandrock_main_stage_v2()

    # 2. Save .blend authoring file
    print(f"Saving authoring Blender file: {out_blend}")
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))

    # 3. Export GLB for Three.js runtime
    print(f"Exporting GLB game model: {out_glb}")
    bpy.ops.export_scene.gltf(
        filepath=str(out_glb),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    if dist_glb.parent.exists():
        import shutil
        shutil.copy2(out_glb, dist_glb)

    # 4. Render daylight studio views
    setup_camera_and_lighting(daylight=True)

    # View 1: Hero Front Elevation (Full 80m W x 21m H view framing both walls, single telebims, and 32. Pol'and'Rock branding)
    render_view(cam_pos_t3=(0.0, 9.5, 62.0), look_at_t3=(0.0, 10.5, 0.0), fov_deg=68.0,
                out_png=artifact_dir / 'main_stage_v2_hero_front.png')

    # View 2: High Angle 3/4 Perspective (Showing 30m depth, enclosing side walls, roof canopy, and single telebims)
    render_view(cam_pos_t3=(48.0, 24.0, 52.0), look_at_t3=(0.0, 9.0, -8.0), fov_deg=62.0,
                out_png=artifact_dir / 'main_stage_v2_angle_perspective.png')

    # View 3: Audience Concert View (matching photo angle, looking slightly up at band and tilted ring)
    render_view(cam_pos_t3=(0.0, 1.8, 14.0), look_at_t3=(0.0, 7.5, -16.0), fov_deg=62.0,
                out_png=artifact_dir / 'main_stage_v2_portal_stage_detail.png')

    # View 4: Left Wing Facade & Single Widescreen Telebim Close-up
    render_view(cam_pos_t3=(-28.8, 10.15, 22.0), look_at_t3=(-28.8, 10.15, 2.7), fov_deg=52.0,
                out_png=artifact_dir / 'main_stage_v2_wing_layher_detail.png')

    # View 5: Right Wing Facade, Right Guitarist & PA Array Close-up
    render_view(cam_pos_t3=(18.0, 8.5, 22.0), look_at_t3=(18.0, 9.5, 2.7), fov_deg=54.0,
                out_png=artifact_dir / 'main_stage_v2_pa_array_detail.png')

    # View 6: Dedicated Central Lighting Ring in Portal Close-up (lowered to stage floor, tilted 38 deg)
    render_view(cam_pos_t3=(0.0, 5.8, 7.0), look_at_t3=(0.0, 8.4, -18.0), fov_deg=64.0,
                out_png=artifact_dir / 'main_stage_v2_central_lighting_ring.png')

    # View 7: Side Angle Profile showing the Steep Inclined Tilt (38 deg tilt, bottom grounded at stage deck)
    render_view(cam_pos_t3=(8.2, 4.8, -1.0), look_at_t3=(0.0, 8.4, -18.0), fov_deg=66.0,
                out_png=artifact_dir / 'main_stage_v2_ring_tilt_side.png')

    # 5. Render night concert view with glowing video walls, blinders, tilted ring, and stage spotlights
    setup_camera_and_lighting(daylight=False)
    render_view(cam_pos_t3=(0.0, 4.5, 45.0), look_at_t3=(0.0, 8.5, -8.0), fov_deg=66.0,
                out_png=artifact_dir / 'main_stage_v2_night_concert.png')

    print("ALL BLENDER MAIN STAGE V2 WORK COMPLETED SUCCESSFULLY!")

if __name__ == '__main__':
    main()
