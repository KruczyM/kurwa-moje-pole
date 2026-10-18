"""Local batch animation builder. No network/API; never overwrites source models.

Plan: python scripts/animate_all_npcs.py
Build: python scripts/animate_all_npcs.py --execute
One: python scripts/animate_all_npcs.py --execute --only amper
Additional motion: --clip "LieDown=C:/motions/lying-down.fbx"

Static meshes require a separately skinned rig. Put Mixamo exports in
source-assets/rigged-festival/<id>/t-pose.fbx (or .glb).
Results and logs are isolated per run under reports/npc-animation-batch.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_CLIPS = {"Idle", "Walk", "Run"}


def glb_document(path: Path) -> dict:
    with path.open("rb") as handle:
        header = handle.read(20)
        if len(header) != 20:
            raise ValueError("Incomplete GLB header")
        magic, version, total, length, kind = struct.unpack("<4sIIII", header)
        if magic != b"glTF" or version != 2 or kind != 0x4E4F534A or total != path.stat().st_size or length > total - 20:
            raise ValueError("Invalid GLB container")
        return json.loads(handle.read(length))


def has_skin(document: dict) -> bool:
    meshes = document.get("meshes", [])
    skins = document.get("skins", [])
    for node in document.get("nodes", []):
        if "skin" not in node or "mesh" not in node:
            continue
        if not (0 <= node["skin"] < len(skins)) or not skins[node["skin"]].get("joints") or not (0 <= node["mesh"] < len(meshes)):
            continue
        for primitive in meshes[node["mesh"]].get("primitives", []):
            if {"JOINTS_0", "WEIGHTS_0"} <= primitive.get("attributes", {}).keys():
                return True
    return False


def validate_result(path: Path) -> dict:
    document = glb_document(path)
    if not has_skin(document):
        raise ValueError("Export has no skinned mesh; refusing to call it animated")
    clips = {a.get("name") for a in document.get("animations", []) if a.get("channels") and a.get("samplers")}
    if missing := REQUIRED_CLIPS - clips:
        raise ValueError("Missing locomotion clips: " + ", ".join(sorted(missing)))
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"clips": sorted(clips), "sha256": digest.hexdigest(), "bytes": path.stat().st_size}


def inventory(catalog: dict) -> list[dict]:
    result = []
    seen = set()
    for group in ("characters", "stagedCharacters", "festivalNpcs"):
        for item in catalog.get(group, []):
            asset_id = item["id"]
            if not re.fullmatch(r"[A-Za-z0-9_-]+", asset_id):
                raise ValueError(f"Unsafe asset id: {asset_id!r}")
            category = "festival" if group == "festivalNpcs" else "characters"
            key = (category, asset_id)
            if key in seen:
                continue
            seen.add(key)
            result.append({"id": asset_id, "category": category, "name": item["name"],
                           "source": item.get("path", f"characters/{asset_id}/npc-animations.glb")})
    return result


def select_base(asset: dict, root: Path, rig_root: Path) -> tuple[Path | None, str]:
    asset_id = asset["id"]
    candidates = [rig_root / asset_id / f"t-pose{ext}" for ext in (".glb", ".fbx")]
    if asset["category"] == "characters":
        candidates += [root / "source-assets/characters" / asset_id / "t-pose.glb"]
    candidates += [root / "public/game-assets" / asset["source"]]
    for path in candidates:
        if not path.is_file():
            continue
        if path.suffix.lower() == ".fbx":
            return path, "FBX skin and rig compatibility will be checked by Blender"
        try:
            if has_skin(glb_document(path)):
                return path, "Skinned GLB found"
        except (ValueError, OSError) as error:
            return None, f"Invalid source {path}: {error}"
    return None, f"Requires rig and skin weights: {rig_root / asset_id / 't-pose.fbx'}"


def build_command(blender: Path, base: Path, donor: Path, output: Path, clips: list[str]) -> list[str]:
    command = [str(blender), "--background", "--factory-startup", "--python-exit-code", "1",
               "--python", str(ROOT / "scripts/blender/build-character-animation-library.py"),
               "--", "--base", str(base), "--retarget-library", str(donor),
               "--output", str(output), "--t-pose-output", str(output.with_name("t-pose.glb"))]
    for clip in clips:
        name, separator, raw_path = clip.partition("=")
        if not separator or not name.strip() or not Path(raw_path).is_file():
            raise ValueError(f"Invalid --clip (expected Name=existing.fbx): {clip}")
        command += ["--retarget-clip", f"{name}={Path(raw_path).resolve()}"]
    return command


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Build eligible rigs; default only makes a plan")
    parser.add_argument("--only", action="append", default=[], help="Asset id, repeatable")
    parser.add_argument("--blender", type=Path, default=Path(r"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"))
    parser.add_argument("--rig-root", type=Path, default=ROOT / "source-assets/rigged-festival")
    parser.add_argument("--donor", type=Path, default=ROOT / "source-assets/animations/mixamo-motion-library.glb")
    parser.add_argument("--clip", action="append", default=[])
    parser.add_argument("--timeout", type=int, default=1200, help="Maximum seconds per model")
    args = parser.parse_args(argv)
    assets = inventory(json.loads((ROOT / "src/game/assets/assetCatalog.json").read_text(encoding="utf-8")))
    if unknown := set(args.only) - {a["id"] for a in assets}:
        parser.error("Unknown ids: " + ", ".join(sorted(unknown)))
    if args.only:
        assets = [a for a in assets if a["id"] in args.only]
    if args.execute and (not args.blender.is_file() or not args.donor.is_file()):
        parser.error("Blender or local animation donor is missing")
    if args.timeout <= 0:
        parser.error("Timeout must be positive")
    # Validate arguments before creating outputs or starting any subprocess.
    build_command(args.blender, Path("unused"), args.donor, Path("unused.glb"), args.clip)
    run = ROOT / "reports/npc-animation-batch" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run.mkdir(parents=True, exist_ok=False)
    rows = []
    report = {"mode": "build" if args.execute else "plan", "runtimeModified": False,
              "visualVerification": "VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN", "results": rows}
    for asset in assets:
        base, reason = select_base(asset, ROOT, args.rig_root.resolve())
        row = {**asset, "base": str(base) if base else None, "status": "planned" if base else "requires-rig", "reason": reason}
        rows.append(row)
        if base and args.execute:
            output = run / asset["category"] / asset["id"] / "npc-animations.glb"
            output.parent.mkdir(parents=True)
            try:
                command = build_command(args.blender.resolve(), base.resolve(), args.donor.resolve(), output, args.clip)
                with output.with_suffix(".log").open("w", encoding="utf-8") as log:
                    process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=args.timeout,
                                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0), check=False)
                if process.returncode:
                    raise RuntimeError(f"Blender exited with {process.returncode}; see {output.with_suffix('.log')}")
                row.update(validate_result(output))
                row.update(status="built-needs-review", output=str(output))
            except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
                row.update(status="failed", reason=str(error))
        (run / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{asset['category']}/{asset['id']}: {row['status']}")
    print(f"Report: {run / 'report.json'}")
    # An incomplete batch must not look like successful animation of all models.
    return 2 if args.execute and any(r["status"] in {"failed", "requires-rig"} for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
