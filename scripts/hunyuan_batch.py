"""Sequential local Hunyuan3D-2GP multiview queue. No paid APIs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
VIEWS = ('front', 'back', 'left', 'right')
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}



def write_json(path, data):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    os.replace(tmp, path)


def emit(output, event, **fields):
    record = dict(time=time.strftime('%Y-%m-%dT%H:%M:%S%z'), event=event, **fields)
    print(json.dumps(record, ensure_ascii=False), flush=True)
    with (output / 'events.jsonl').open('a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')
    write_json(output / 'status.json', record)


def compute_file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def compute_model_hash(paths):
    h = hashlib.sha256()
    for view in VIEWS:
        h.update(compute_file_hash(paths[view]).encode('utf-8'))
    return h.hexdigest()

def discover(root, manifest):
    from PIL import Image
    jobs, rejected = [], {}
    for folder in sorted(root.iterdir()):
        if not folder.is_dir():
            continue
        paths = {}
        for view in VIEWS:
            matches = [p for p in folder.iterdir() if p.is_file()
                       and p.stem.lower() == view and p.suffix.lower() in IMAGE_EXTENSIONS]
            if len(matches) != 1:
                rejected[folder.name] = f'{view}: expected one image, found {len(matches)} ({[p.name for p in matches]})'
                break
            paths[view] = matches[0]
        if folder.name in rejected:
            continue
        # Correct the previous mislabelling, without modifying user source files.
        if folder.name == 'kilt_punk_ref_1789954056754':
            paths['left'], paths['right'] = paths['right'], paths['left']
            
        model_hash = compute_model_hash(paths)
        manifest_entry = manifest.get('models', {}).get(folder.name)
        
        status = 'pending'
        if manifest_entry and manifest_entry.get('hash') == model_hash:
            status = manifest_entry.get('status', 'pending')
            
        if status == 'rejected':
            rejected[folder.name] = 'Visual QA failed (rejected in manifest).'
            continue
            
        try:
            for path in paths.values():
                with Image.open(path) as im:
                    im.load()
                    if min(im.size) < 128:
                        raise ValueError('view smaller than 128 pixels')
        except (OSError, ValueError) as e:
            rejected[folder.name] = str(e)
            continue
        jobs.append((folder.name, paths))
    return jobs, rejected


def fingerprint(paths, settings):
    h = hashlib.sha256(json.dumps(settings, sort_keys=True).encode())
    for view in VIEWS:
        h.update(view.encode())
        h.update(paths[view].read_bytes())
    return h.hexdigest()


def validate_mesh(path, require_texture=False):
    import trimesh
    mesh = trimesh.load(str(path), force='mesh')
    if not len(mesh.vertices) or not len(mesh.faces):
        raise ValueError(f'Empty mesh: {path}')
    import numpy as np
    if not np.isfinite(mesh.vertices).all():
        raise ValueError(f'Nonfinite geometry: {path}')
    result = {'vertices': len(mesh.vertices), 'faces': len(mesh.faces)}
    if require_texture:
        material = getattr(mesh.visual, 'material', None)
        texture = getattr(material, 'baseColorTexture', None)
        if texture is None:
            texture = getattr(material, 'image', None)
        if texture is None or getattr(mesh.visual, 'uv', None) is None:
            raise ValueError(f'Textured export has no embedded texture/UV: {path}')
        result['texture_size'] = list(texture.size)
    return result


def completed(folder, signature, textured):
    try:
        record = json.loads((folder / 'result.json').read_text(encoding='utf-8'))
        if record['signature'] != signature:
            return False
        for name in (['shape.glb', 'textured.glb'] if textured else ['shape.glb']):
            if hashlib.sha256((folder / name).read_bytes()).hexdigest() != record['sha256'][name]:
                return False
        return True
    except (OSError, ValueError, KeyError):
        return False


def file_result(value):
    while isinstance(value, dict):
        value = value.get('value', value.get('path'))
    if not isinstance(value, str) or not Path(value).is_file():
        raise ValueError(f'API did not return a downloaded mesh: {value!r}')
    return Path(value)


def start_server(args, output):
    # Own server/port prevents accidentally submitting to single-image mode.
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', args.port)) == 0:
            raise RuntimeError(f'Port {args.port} occupied. Choose another --port.')
    env = os.environ.copy()
    env.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', GRADIO_ANALYTICS_ENABLED='False',
               PYTHONUNBUFFERED='1', TORCH_CUDA_ARCH_LIST='8.6', NVCC_PREPEND_FLAGS='-allow-unsupported-compiler')
    cuda = Path(r'C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4')
    if cuda.exists():
        env.update(CUDA_PATH=str(cuda), CUDA_HOME=str(cuda))
        env['PATH'] = str(cuda / 'bin') + os.pathsep + env['PATH']
    command = [sys.executable, '-u', 'gradio_app.py', '--mv', '--turbo', '--profile', '4',
               '--low-vram-mode', '--host', '127.0.0.1', '--port', str(args.port),
               '--cache-path', str(output / 'server_cache')]
    if args.shape_only:
        command.append('--disable_tex')
    log = (output / 'server.log').open('a', encoding='utf-8')
    proc = subprocess.Popen(command, cwd=args.install, env=env, stdout=log,
                            stderr=subprocess.STDOUT,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    log.close()
    return proc


def connect(args, proc, output):
    from gradio_client import Client
    url = f'http://127.0.0.1:{args.port}'
    deadline = time.monotonic() + args.startup_timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f'Server exited ({proc.returncode}); see {output / "server.log"}')
        try:
            with urllib.request.urlopen(url + '/config', timeout=5) as response:
                config = json.load(response)
            text = json.dumps(config)
            if 'Hunyuan3D-2mv' not in text or 'hunyuan3d-dit-v2-mv-turbo' not in text:
                raise RuntimeError('Server is not MV Turbo')
            if not args.shape_only and 'Texture Generation (Unavailable)' in text:
                raise RuntimeError('Texture generator failed to load; see server.log')
            return Client(url, verbose=False, download_files=str(output / 'downloads'))
        except (OSError, urllib.error.URLError):
            emit(output, 'starting_server', server_pid=proc.pid)
            time.sleep(5)
    raise TimeoutError('Server startup timed out; see server.log')


def run_job(client, args, output, name, paths, settings):
    from gradio_client import handle_file
    signature = fingerprint(paths, settings)
    model_folder = output / name
    model_folder.mkdir(exist_ok=True)
    
    variant_folder = model_folder / f"variant_{signature}"
    variant_folder.mkdir(exist_ok=True)
    
    if completed(variant_folder, signature, not args.shape_only):
        emit(output, 'skipped_completed', model=name, variant=f"variant_{signature}")
        return
        
    # Preserve provenance
    write_json(variant_folder / 'request.json', dict(settings=settings, signature=signature,
               inputs={v: str(p) for v, p in paths.items()}))
    endpoint = '/shape_generation' if args.shape_only else '/generation_all'
    job = client.submit(None, None, *(handle_file(str(paths[v])) for v in VIEWS),
                        args.steps, args.guidance, args.seed, args.resolution, True,
                        args.steps, args.guidance, args.seed, args.resolution, settings['remove_background'],
                        args.chunks, False, api_name=endpoint)
    started = time.monotonic()
    while not job.done():
        if time.monotonic() - started > args.job_timeout:
            job.cancel()
            raise TimeoutError(f'{name}: job timeout; stopping server to prevent overlapping jobs')
        emit(output, 'generating', model=name, variant=f"variant_{signature}", elapsed_seconds=round(time.monotonic()-started),
             queue_status=str(job.status().code), **getattr(args, 'progress', {}))
        time.sleep(10)
    result = job.result()
    exports = {'shape.glb': file_result(result[0])}
    if not args.shape_only:
        exports['textured.glb'] = file_result(result[1])
    checks, hashes = {}, {}
    for filename, source in exports.items():
        tmp = variant_folder / ('pending_' + filename)
        shutil.copy2(source, tmp)
        checks[filename] = validate_mesh(tmp, require_texture=filename == 'textured.glb')
        hashes[filename] = hashlib.sha256(tmp.read_bytes()).hexdigest()
        os.replace(tmp, variant_folder / filename)
    write_json(variant_folder / 'result.json', dict(signature=signature, sha256=hashes, geometry=checks,
               settings=settings, stats=result[2 if args.shape_only else 3],
               elapsed_seconds=round(time.monotonic()-started, 2)))
    emit(output, 'saved', model=name, variant=f"variant_{signature}", files=list(exports), geometry=checks,
         **getattr(args, 'progress', {}))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--install', type=Path, default=ROOT / 'Hunyuan3D-2GP')
    p.add_argument('--input', type=Path, default=ROOT / 'Hunyuan3D-2GP/input_characters')
    p.add_argument('--output', type=Path, default=ROOT / 'Hunyuan3D-2GP/output/characters_mv')
    p.add_argument('--check', action='store_true', help='Validate inputs only; no GPU/server')
    p.add_argument('--shape-only', action='store_true', help='Geometry only, no textures')
    p.add_argument('--no-rembg', action='store_true', help='Skip background removal (requires RGBA images)')
    p.add_argument('--only', help='One folder name')
    p.add_argument('--limit', type=int, default=0)
    p.add_argument('--export', type=Path, default=ROOT / 'public' / 'game-assets' / 'npc_models', help='Directory to export selected variants to')
    p.add_argument('--manifest', type=Path, default=ROOT / 'src' / 'game' / 'assets' / 'hunyuan_review_manifest.json', help='Path to review_manifest.json')
    p.add_argument('--migrate-manifest', action='store_true', help='Dry-run migration of input folders into manifest')
    p.add_argument('--migrate-manifest-write', action='store_true', help='Write migration to manifest')
    p.add_argument('--steps', type=int, choices=range(1, 101), default=5)
    p.add_argument('--guidance', type=float, default=5.0)
    p.add_argument('--resolution', type=int, choices=(196, 256, 384), default=256)
    p.add_argument('--chunks', type=int, default=8000)
    p.add_argument('--seed', type=int, default=1234)
    p.add_argument('--port', type=int, default=7862)
    p.add_argument('--startup-timeout', type=int, default=900)
    p.add_argument('--job-timeout', type=int, default=3600)
    args = p.parse_args(argv)
    if not args.input.is_dir() or args.chunks < 1000 or args.limit < 0:
        p.error('Invalid input directory, chunks (<1000) or limit (<0)')
    if args.startup_timeout <= 0 or args.job_timeout <= 0 or not 1 <= args.port <= 65535:
        p.error('Timeouts must be positive and port must be 1..65535')
    args.install, args.input, args.output = args.install.resolve(), args.input.resolve(), args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    
    manifest_data = {'models': {}}
    if args.manifest.exists():
        try:
            with args.manifest.open('r', encoding='utf-8') as f:
                manifest_data = json.load(f)
        except Exception:
            pass

    if args.migrate_manifest or args.migrate_manifest_write:
        for folder in sorted(args.input.iterdir()):
            if not folder.is_dir(): continue
            paths = {}
            for view in VIEWS:
                matches = [p for p in folder.iterdir() if p.is_file() and p.stem.lower() == view and p.suffix.lower() in IMAGE_EXTENSIONS]
                if len(matches) == 1: paths[view] = matches[0]
            if len(paths) == 4:
                # Correct mislabelling
                if folder.name == 'kilt_punk_ref_1789954056754':
                    paths['left'], paths['right'] = paths['right'], paths['left']
                model_hash = compute_model_hash(paths)
                
                entry = manifest_data['models'].setdefault(folder.name, {})
                if entry.get('hash') != model_hash:
                    entry['hash'] = model_hash
                    
                    # Store per-file mapping and hash
                    entry['views'] = {}
                    for view_name, view_path in paths.items():
                        entry['views'][view_name] = {
                            'file': view_path.name,
                            'sha256': compute_file_hash(view_path)
                        }
                        
                    # legacy blocked folders
                    legacy_blocked = {
                        'flag_bearer_ref_1789954083721', 'green_alien_girl_ref_1789954007535',
                        'grunge_girl_vinyl_ref_1789929848544', 'pikachu_guy_ref_1789953988229',
                        'punk_vinyl_ref_1789929827609', 'sunflower_girl_ref_1789954066037',
                        'supergirl_cosplay_ref_1789953998637'
                    }
                    if folder.name in legacy_blocked:
                        entry['status'] = 'rejected'
                    elif 'status' not in entry:
                        entry['status'] = 'approved' # by default migrate existing as approved
                    else:
                        entry['status'] = 'pending' # changed hash -> pending
        
        if args.migrate_manifest_write:
            args.manifest.parent.mkdir(parents=True, exist_ok=True)
            write_json(args.manifest, manifest_data)
            print(f"Migrated manifest to {args.manifest}")
        else:
            print("DRY RUN migration. Add --migrate-manifest-write to save.")
            print(json.dumps(manifest_data, indent=2))
        return 0

    jobs, rejected = discover(args.input, manifest_data)
    if args.only:
        jobs = [(n, paths) for n, paths in jobs if n == args.only]
        if not jobs:
            p.error('Requested model missing or blocked by input QA')
    discovered = len(jobs) + len(rejected)
    write_json(args.output / 'input_report.json', dict(input=str(args.input), total=discovered,
               ready=[n for n, _ in jobs], blocked=rejected,
               views={n: {v: str(path) for v, path in paths.items()} for n, paths in jobs}))
    print(f'Input: {args.input}\nTotal: {discovered}; ready: {len(jobs)}; blocked: {len(rejected)}', flush=True)
    if args.check:
        return 0 if jobs else 2
    settings = dict(model='tencent/Hunyuan3D-2mv/hunyuan3d-dit-v2-mv-turbo',
                    steps=args.steps, guidance=args.guidance, seed=args.seed,
                    resolution=args.resolution, chunks=args.chunks, profile=4,
                    remove_background=not args.no_rembg, textured=not args.shape_only, views=list(VIEWS))
    ready_count = len(jobs)
    jobs = [(n, paths) for n, paths in jobs if not completed(args.output/n/f"variant_{fingerprint(paths, settings)}", fingerprint(paths, settings), not args.shape_only)]
    already_completed = ready_count - len(jobs)
    pending_count = len(jobs)
    if args.limit:
        jobs = jobs[:args.limit]
    if not jobs:
        print('No pending jobs.', flush=True)
        return 0
    lock_path = args.output / 'queue.lock'
    try:
        lock = lock_path.open('x', encoding='utf-8')
    except FileExistsError:
        raise RuntimeError('queue.lock exists: check previous process before removing a stale lock')
    proc = None
    try:
        lock.write(str(os.getpid()))
        lock.close()
        emit(args.output, 'starting', total=discovered, scheduled=len(jobs), pending=pending_count,
             already_completed=already_completed, blocked=len(rejected), pid=os.getpid())
        proc = start_server(args, args.output)
        client = connect(args, proc, args.output)
        for index, (name, paths) in enumerate(jobs, 1):
            args.progress = dict(index=index, scheduled=len(jobs), total=discovered,
                                 already_completed=already_completed)
            if (args.output / 'STOP_AFTER_CURRENT').exists():
                emit(args.output, 'stopped_between_models')
                return 0
            run_job(client, args, args.output, name, paths, settings)
        emit(args.output, 'completed', generated=len(jobs), total=discovered,
             already_completed=already_completed, remaining=pending_count-len(jobs), blocked=len(rejected))
             
        # Export selected variants
        if args.export:
            args.export.mkdir(parents=True, exist_ok=True)
            exported = 0
            for model_name, entry in manifest_data.get('models', {}).items():
                if entry.get('status') != 'approved':
                    continue
                selected = entry.get('selected_variant')
                model_dir = args.output / model_name
                if not selected:
                    # If not explicitly selected, try to find any valid variant if there's only one
                    variants = [d for d in model_dir.iterdir() if d.is_dir() and d.name.startswith('variant_')] if model_dir.is_dir() else []
                    if len(variants) == 1:
                        selected = variants[0].name
                
                if selected:
                    src_glb = model_dir / selected / ('shape.glb' if args.shape_only else 'textured.glb')
                    if src_glb.is_file():
                        dst_glb = args.export / f'{model_name}.glb'
                        shutil.copy2(src_glb, dst_glb)
                        exported += 1
            print(f"Exported {exported} models to {args.export}")
             
        return 0
    except BaseException as e:
        emit(args.output, 'failed', error=str(e), error_type=type(e).__name__)
        raise
    finally:
        if proc is not None and proc.poll() is None:
            if os.name == 'nt':
                # venv Python can be a redirector with a child Python process.
                subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            else:
                proc.terminate()
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=10)
        lock_path.unlink(missing_ok=True)


if __name__ == '__main__':
    sys.exit(main())
