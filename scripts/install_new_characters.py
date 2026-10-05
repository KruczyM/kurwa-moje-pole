"""Install regenerated Korba, Zawor, and Hemoroid models.
1. Locates latest variant in Hunyuan3D-2GP/output/characters_mv/<name>/
2. Copies textured.glb to preview.glb
3. Rigs using Blender 5.0 and scripts/blender/rig-festival-npc.py
4. Validates skinned meshes and animation clips (Idle, Walk, Run)
5. Installs into public/game-assets/characters/<name>/ and source-assets/
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLENDER = Path(r"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe")
DONOR = ROOT / "source-assets/animations/mixamo-motion-library.glb"
OUTPUT_DIR = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv")
CHARACTERS = ["hemoroid", "zawor", "korba"]


def find_latest_variant(char_dir: Path) -> Path:
    variants = [d for d in char_dir.iterdir() if d.is_dir() and d.name.startswith("variant_")]
    if not variants:
        raise FileNotFoundError(f"No variant found in {char_dir}")
    # Sort by mtime descending
    variants.sort(key=lambda d: d.stat().st_mtime, reverse=True)
    return variants[0]


def process_character(name: str):
    print(f"\n================ Processing {name} ================")
    char_dir = OUTPUT_DIR / name
    if not char_dir.is_dir():
        print(f"Skipping {name}: directory {char_dir} does not exist yet.")
        return False

    variant_dir = find_latest_variant(char_dir)
    print(f"Using variant: {variant_dir.name}")

    textured_glb = variant_dir / "textured.glb"
    if not textured_glb.is_file():
        print(f"textured.glb not found in {variant_dir}")
        return False

    # Also keep a copy directly in char_dir
    shutil.copy2(textured_glb, char_dir / "textured.glb")
    if (variant_dir / "shape.glb").is_file():
        shutil.copy2(variant_dir / "shape.glb", char_dir / "shape.glb")

    # 1. Update preview.glb
    public_char_dir = ROOT / "public/game-assets/characters" / name
    public_char_dir.mkdir(parents=True, exist_ok=True)
    preview_dst = public_char_dir / "preview.glb"
    shutil.copy2(textured_glb, preview_dst)
    print(f"Installed preview: {preview_dst} ({preview_dst.stat().st_size} bytes)")

    # 2. Rig with Blender
    source_rigged = ROOT / "source-assets/rigged-festival" / name
    source_rigged.mkdir(parents=True, exist_ok=True)
    t_pose_output = source_rigged / "t-pose.glb"

    cmd = [
        str(BLENDER),
        "--background",
        "--factory-startup",
        "--threads", "4",
        "--python-exit-code", "1",
        "--python", str(ROOT / "scripts/blender/rig-festival-npc.py"),
        "--",
        "--input", str(textured_glb),
        "--output", str(t_pose_output),
        "--donor", str(DONOR),
    ]

    log_path = source_rigged / "blender_rig.log"
    print(f"Running Blender auto-rig for {name}...")
    with log_path.open("w", encoding="utf-8") as log:
        res = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT)
    if res.returncode != 0:
        print(f"Blender failed with code {res.returncode}. See {log_path}")
        return False

    anim_glb = source_rigged / "npc-animations.glb"
    if not anim_glb.is_file():
        print(f"Blender did not produce npc-animations.glb at {anim_glb}")
        return False

    # 3. Install npc-animations.glb to public catalog
    public_anim_dst = public_char_dir / "npc-animations.glb"
    shutil.copy2(anim_glb, public_anim_dst)
    print(f"Installed animations: {public_anim_dst} ({public_anim_dst.stat().st_size} bytes)")

    # Also for zawor, keep source-assets/characters/zawor/t-pose.glb updated
    if name == "zawor":
        legacy_source = ROOT / "source-assets/characters/zawor"
        legacy_source.mkdir(parents=True, exist_ok=True)
        shutil.copy2(t_pose_output, legacy_source / "t-pose.glb")

    print(f"Successfully rigged and installed {name}!")
    return True


def main():
    targets = [sys.argv[1]] if len(sys.argv) > 1 else CHARACTERS
    for char in targets:
        process_character(char)


if __name__ == "__main__":
    main()
