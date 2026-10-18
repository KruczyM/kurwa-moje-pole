"""Update and rig regenerated NPC models (008, 015, 050, 052, 070, 072, 078, 087, 089).

1. Locates latest variant in Hunyuan3D-2GP/output/characters_mv/<id>/
2. Updates root textured.glb and shape.glb in Hunyuan folder
3. Runs Blender auto-rig using scripts/blender/rig-festival-npc.py and mixamo donor
4. Installs generated t-pose.glb to source-assets/rigged-festival/<id>/
5. Installs generated npc-animations.glb to public/game-assets/npc_models/<id>.glb
6. For models with shoulder adjustments (008, 050, 072, 087), runs repair-character-weights.ts
7. Syncs final files to main repo public/game-assets/npc_models/<id>.glb and source-assets/
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(r"E:\kodowanie\gra")
WT_ROOT = Path(r"E:\kodowanie\gra\.ai\worktrees\festival-2026-tent-upgrades")
HUNYUAN_ROOT = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP\output\characters_mv")
BLENDER = Path(r"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe")
DONOR = WT_ROOT / "source-assets/animations/mixamo-motion-library.glb"

TARGET_MODELS = [
    "008_grunge_flannel_rocker",
    "015_feather_headband_hippie",
    "050_blue_alien_girl",
    "052_muddy_sneakers_rocker",
    "070_vintage_denim_shorts",
    "072_rave_bucket_hat",
    "078_girl_with_guitar",
    "087_neon_raver",
    "089_peace_hippie",
]

SHOULDER_REPAIR_MODELS = {
    "008_grunge_flannel_rocker",
    "050_blue_alien_girl",
    "072_rave_bucket_hat",
    "087_neon_raver",
}


def find_latest_variant(char_dir: Path) -> Path:
    variants = [d for d in char_dir.iterdir() if d.is_dir() and d.name.startswith("variant_")]
    if not variants:
        return char_dir
    variants.sort(key=lambda d: d.stat().st_mtime, reverse=True)
    return variants[0]


def process_model(name: str):
    print(f"\n================ Processing {name} ================")
    char_dir = HUNYUAN_ROOT / name
    if not char_dir.is_dir():
        print(f"Error: directory {char_dir} does not exist.")
        return False

    latest_dir = find_latest_variant(char_dir)
    print(f"Latest source: {latest_dir.name}")

    src_glb = latest_dir / "textured.glb"
    if not src_glb.is_file():
        print(f"Error: textured.glb not found in {latest_dir}")
        return False

    # Sync root Hunyuan folder if variant was used
    if latest_dir != char_dir:
        shutil.copy2(src_glb, char_dir / "textured.glb")
        if (latest_dir / "shape.glb").is_file():
            shutil.copy2(latest_dir / "shape.glb", char_dir / "shape.glb")

    # 1. Rig using Blender in WT_ROOT
    source_rigged_wt = WT_ROOT / "source-assets/rigged-festival" / name
    source_rigged_wt.mkdir(parents=True, exist_ok=True)
    out_tpose_wt = source_rigged_wt / "t-pose.glb"

    cmd = [
        str(BLENDER),
        "--background",
        "--factory-startup",
        "--threads", "4",
        "--python-exit-code", "1",
        "--python", str(WT_ROOT / "scripts/blender/rig-festival-npc.py"),
        "--",
        "--input", str(src_glb),
        "--output", str(out_tpose_wt),
        "--donor", str(DONOR),
    ]

    print(f"Running Blender auto-rig for {name}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Blender failed with code {res.returncode}")
        print(res.stdout[-1500:])
        print(res.stderr[-1500:])
        return False

    out_anim_wt = source_rigged_wt / "npc-animations.glb"
    if not out_anim_wt.is_file():
        print(f"Error: npc-animations.glb was not produced at {out_anim_wt}")
        return False

    print(f"Rigged successfully: t-pose={out_tpose_wt.stat().st_size}b, anim={out_anim_wt.stat().st_size}b")

    # 2. Install raw animated model to WT public
    public_wt = WT_ROOT / "public/game-assets/npc_models" / f"{name}.glb"
    shutil.copy2(out_anim_wt, public_wt)
    print(f"Installed to worktree public: {public_wt}")

    # 3. If shoulder repair is required, clear obsolete report backups and run repair-character-weights.ts
    if name in SHOULDER_REPAIR_MODELS:
        print(f"Applying shoulder pivot & arm skin weight refit for {name}...")
        b1 = WT_ROOT / "reports/shoulder-rig-repair-20260926/originals/npc_models" / f"{name}.glb"
        b2 = WT_ROOT / "reports/shoulder-weight-repair-20260926/originals/npc_models" / f"{name}.glb"
        if b1.is_file():
            b1.unlink()
        if b2.is_file():
            b2.unlink()

        repair_cmd = [
            "npx", "tsx", "scripts/repair-character-weights.ts",
            "--arms",
            f"--ids={name}.glb",
            "--install"
        ]
        repair_res = subprocess.run(repair_cmd, cwd=str(WT_ROOT), capture_output=True, text=True, shell=True)
        if repair_res.returncode != 0:
            print(f"Warning: repair-character-weights returned {repair_res.returncode}: {repair_res.stderr}")
        else:
            print(f"Shoulder repair applied cleanly: {repair_res.stdout.strip()}")

    # 4. Sync final rigged model and animations to main repo
    public_main = REPO_ROOT / "public/game-assets/npc_models" / f"{name}.glb"
    shutil.copy2(public_wt, public_main)
    print(f"Synced to main repo: {public_main} ({public_main.stat().st_size}b)")

    source_rigged_main = REPO_ROOT / "source-assets/rigged-festival" / name
    source_rigged_main.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out_tpose_wt, source_rigged_main / "t-pose.glb")
    if (source_rigged_wt / "t-pose.json").is_file():
        shutil.copy2(source_rigged_wt / "t-pose.json", source_rigged_main / "t-pose.json")
    shutil.copy2(out_anim_wt, source_rigged_main / "npc-animations.glb")
    print(f"Synced source rig to main repo: {source_rigged_main}")

    return True


def main():
    targets = [sys.argv[1]] if len(sys.argv) > 1 else TARGET_MODELS
    success = []
    failed = []
    for model in targets:
        if process_model(model):
            success.append(model)
        else:
            failed.append(model)

    print("\n================ SUMMARY ================")
    print(f"Successfully processed ({len(success)}): {', '.join(success)}")
    if failed:
        print(f"Failed ({len(failed)}): {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
