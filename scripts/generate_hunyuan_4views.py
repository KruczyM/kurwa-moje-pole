#!/usr/bin/env python3
"""
Skrypt do generowania modeli 3D z 4 zdjęć (front, back, left, right)
za pomocą Hunyuan3D-2 z zaawansowanym offloadingiem pamięci do RAM.

Zoptymalizowany pod konfigurację:
- RAM: 64 GB
- VRAM: 8 GB (np. RTX 3070 / RTX 4060)

Domyślnie używa profilu MMGP 2 (HighRAM_LowVRAM_Fast):
- Pełna precyzja wag (brak degradacji jakości typowej dla 8-bitowej kwantyzacji).
- Wagi trzymane w 64 GB pamięci RAM i przesyłane do VRAM w locie tylko dla aktywnej warstwy.
- Budżet VRAM ograniczony do ~2200 MB, co zabezpiecza przed błędami CUDA OOM.
"""

import os
import sys
import time
import argparse
import logging
from pathlib import Path

# Optymalizacje pamięci CUDA
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
os.environ["PYTHONUNBUFFERED"] = "1"

# Ścieżka do instalacji Hunyuan3D-2GP
REPO_ROOT = Path(__file__).resolve().parents[1]
HUNYUAN_DIR = REPO_ROOT / "Hunyuan3D-2GP"
if not HUNYUAN_DIR.exists():
    HUNYUAN_DIR = Path(r"E:\kodowanie\gra\Hunyuan3D-2GP")

if str(HUNYUAN_DIR) not in sys.path:
    sys.path.insert(0, str(HUNYUAN_DIR))

# Ustawienie CUDA toolkit jeśli istnieje
CUDA_PATH = Path(r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4")
if CUDA_PATH.exists():
    os.environ["CUDA_PATH"] = str(CUDA_PATH)
    os.environ["CUDA_HOME"] = str(CUDA_PATH)
    os.environ["PATH"] = str(CUDA_PATH / "bin") + os.pathsep + os.environ.get("PATH", "")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("Hunyuan4Views")


def print_memory_stats(label=""):
    import torch
    import psutil
    vm = psutil.virtual_memory()
    ram_used_gb = (vm.total - vm.available) / (1024**3)
    ram_total_gb = vm.total / (1024**3)
    vram_alloc_mb = torch.cuda.memory_allocated() / (1024**2) if torch.cuda.is_available() else 0
    vram_res_mb = torch.cuda.memory_reserved() / (1024**2) if torch.cuda.is_available() else 0
    logger.info(f"[{label}] RAM: {ram_used_gb:.1f}/{ram_total_gb:.1f} GB | VRAM: alloc={vram_alloc_mb:.0f}MB, res={vram_res_mb:.0f}MB")


def replace_property_getter(instance, property_name, new_getter):
    original_class = type(instance)
    original_property = getattr(original_class, property_name)
    custom_class = type(f'Custom{original_class.__name__}', (original_class,), {})
    new_property = property(new_getter, original_property.fset)
    setattr(custom_class, property_name, new_property)
    instance.__class__ = custom_class
    return instance


def find_view_images(input_path: Path):
    """
    Automatycznie wykrywa 4 zdjecia w podanym folderze lub plikach.
    Oczekiwane nazwy: front, back, left, right (png/jpg/jpeg/webp).
    """
    valid_exts = {".png", ".jpg", ".jpeg", ".webp"}
    views = {}
    
    if input_path.is_dir():
        files = [p for p in input_path.iterdir() if p.is_file() and p.suffix.lower() in valid_exts]
        for f in files:
            stem = f.stem.lower()
            if stem in ("front", "przod", "przód"):
                views["front"] = f
            elif stem in ("back", "tyl", "tył"):
                views["back"] = f
            elif stem in ("left", "lewo", "lewy"):
                views["left"] = f
            elif stem in ("right", "prawo", "prawy"):
                views["right"] = f
    
    return views


def main():
    parser = argparse.ArgumentParser(description="Hunyuan3D-2 Multiview (4 views) with Offloading for 64GB RAM / 8GB VRAM")
    parser.add_argument("--input", "-i", type=str, help="Sciezka do folderu z 4 zdjeciami (front, back, left, right) lub pliku front.png")
    parser.add_argument("--front", type=str, help="Sciezka do widoku z przodu (front)")
    parser.add_argument("--back", type=str, help="Sciezka do widoku z tylu (back)")
    parser.add_argument("--left", type=str, help="Sciezka do widoku z lewej (left)")
    parser.add_argument("--right", type=str, help="Sciezka do widoku z prawej (right)")
    parser.add_argument("--output", "-o", type=str, default=None, help="Folder docelowy lub sciezka do pliku wyjsciowego .glb")
    
    # Model & Offloading settings
    parser.add_argument("--mode", choices=["mv-full", "mv-turbo", "h2"], default="mv-full", 
                        help="Tryb modelu: 'mv-full' = NAJMOCNIEJSZY 4-rzutowy DiT (30-50 krokow flow-matching), 'mv-turbo' = szybki 4-rzutowy (5 krokow), 'h2' = 1-zdjeciowy 3B")
    parser.add_argument("--profile", type=int, choices=[1, 2, 3, 4, 5], default=2,
                        help="Profil MMGP offloadingu: 2 = HighRAM_LowVRAM_Fast (pelna precyzja FP16 dla 64GB RAM / 8GB VRAM), 4 = 8-bit kwantyzacja")
    parser.add_argument("--budget", type=int, default=2200, help="Limit VRAM w MB dla MMGP (domyslnie 2200 MB dla 8GB VRAM)")
    parser.add_argument("--steps", type=int, default=None, help="Liczba krokow dyfuzji (domyslnie 30 dla mv-full, 5 dla mv-turbo)")
    parser.add_argument("--guidance", type=float, default=5.0, help="Guidance scale (domyslnie 5.0)")
    parser.add_argument("--octree-resolution", type=int, choices=[128, 196, 256, 384], default=256, 
                        help="Rozdzielczosc octree siatki (256 standard, 384 = ultra gesta geometria)")
    parser.add_argument("--chunks", type=int, default=100000, help="Liczba chunks do rekonstrukcji siatki")
    parser.add_argument("--seed", type=int, default=1234, help="Seed generatora losowego")
    
    # Texture & Post-processing
    parser.add_argument("--shape-only", action="store_true", help="Generuj tylko biala bryle geometryczna, pomin generowanie tekstur PBR")
    parser.add_argument("--no-rembg", action="store_true", help="Nie usuwaj tla (uzyj jesli zdjecia maja juz przezroczyste tlo RGBA)")
    parser.add_argument("--face-count", type=int, default=40000, help="Docelowa liczba wielokatow po redukcji (domyslnie 40 000)")
    parser.add_argument("--export-format", choices=["glb", "obj"], default="glb", help="Format pliku wyjsciowego")

    args = parser.parse_args()

    # Domyślna liczba kroków w zależności od modelu
    if args.steps is None:
        args.steps = 5 if args.mode == "mv-turbo" else 30

    # Weryfikacja wejść
    image_paths = {}
    if args.input:
        in_path = Path(args.input).resolve()
        if in_path.is_dir():
            image_paths = find_view_images(in_path)
        elif in_path.is_file():
            image_paths = find_view_images(in_path.parent)

    # Nadpisanie jawnymi flagami
    if args.front: image_paths["front"] = Path(args.front).resolve()
    if args.back:  image_paths["back"]  = Path(args.back).resolve()
    if args.left:  image_paths["left"]  = Path(args.left).resolve()
    if args.right: image_paths["right"] = Path(args.right).resolve()

    if not image_paths or "front" not in image_paths:
        logger.error("BLAD: Nie znaleziono wymaganych zdjec!")
        logger.error("Podaj folder z 4 zdjeciami: --input <folder>")
        logger.error("lub wskaz zdjecia: --front przod.png --back tyl.png --left lewy.png --right prawy.png")
        sys.exit(1)

    logger.info("=== HUNYUAN3D-2 MULTIVIEW (4 VIEWS) GENERATOR ===")
    logger.info(f"Tryb modelu: {args.mode} (Kroki: {args.steps}, Octree: {args.octree_resolution})")
    logger.info(f"Znalezione rzuty: {list(image_paths.keys())}")
    for k, v in image_paths.items():
        logger.info(f"  [{k.upper()}]: {v}")

    # Wyznaczenie folderu wyjściowego
    if args.output:
        out_target = Path(args.output).resolve()
        if out_target.suffix in (".glb", ".obj"):
            out_dir = out_target.parent
            base_name = out_target.stem
        else:
            out_dir = out_target
            base_name = "model_4views"
    else:
        out_dir = Path("output_4views").resolve()
        base_name = image_paths["front"].parent.name if "front" in image_paths else "model_4views"

    out_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Folder wyjsciowy: {out_dir}")
    logger.info(f"Konfiguracja pamieci: Profil MMGP={args.profile}, Budzet VRAM={args.budget} MB (optymalizacja dla 64GB RAM / 8GB VRAM)")

    # Importy ciężkich bibliotek AI
    import torch
    from PIL import Image
    import trimesh
    from mmgp import offload

    from hy3dgen.rembg import BackgroundRemover
    from hy3dgen.shapegen import (
        Hunyuan3DDiTFlowMatchingPipeline,
        FaceReducer,
        FloaterRemover,
        DegenerateFaceRemover,
    )
    from hy3dgen.shapegen.pipelines import export_to_trimesh
    from hy3dgen.texgen import Hunyuan3DPaintPipeline

    print_memory_stats("Przed zaladowaniem modeli")

    # 1. Przygotowanie obrazów wejściowych (wczytanie i ewentualne usunięcie tła)
    logger.info("Wczytywanie i przygotowanie 4 rzutow...")
    rembg_tool = BackgroundRemover() if not args.no_rembg else None
    
    prepared_images = {}
    for view_name in ("front", "back", "left", "right"):
        if view_name not in image_paths:
            logger.warning(f"Brak rzutu '{view_name}' - kontynuowanie z dostepnymi rzutami.")
            continue
        img = Image.open(image_paths[view_name])
        if rembg_tool and (args.no_rembg is False or img.mode == "RGB"):
            logger.info(f"  Usuwanie tla z {view_name}...")
            img = rembg_tool(img.convert("RGB"))
        prepared_images[view_name] = img

    # Zapis przetworzonych rzutów do weryfikacji
    for v_name, v_img in prepared_images.items():
        v_img.save(out_dir / f"input_rembg_{v_name}.png")

    print_memory_stats("Po usunieciu tla")

    # 2. Załadowanie modelu kształtu (ShapeGen)
    if args.mode == "mv-full":
        model_path = "tencent/Hunyuan3D-2mv"
        subfolder = "hunyuan3d-dit-v2-mv"
        logger.info(f"Ladowanie NAJMOCNIEJSZEGO 4-rzutowego DiT: {model_path}/{subfolder}...")
    elif args.mode == "mv-turbo":
        model_path = "tencent/Hunyuan3D-2mv"
        subfolder = "hunyuan3d-dit-v2-mv-turbo"
        logger.info(f"Ladowanie szybkiego 4-rzutowego DiT (Turbo): {model_path}/{subfolder}...")
    else:
        model_path = "tencent/Hunyuan3D-2"
        subfolder = "hunyuan3d-dit-v2-0"
        logger.info(f"Ladowanie 1-zdjeciowego bazowego DiT: {model_path}/{subfolder}...")

    torch.set_default_device("cpu")
    i23d_worker = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        model_path,
        subfolder=subfolder,
        use_safetensors=True,
        device="cuda"
    )
    i23d_worker.enable_flashvdm(mc_algo="dmc")

    # 3. Załadowanie modelu teksturowania (TexGen) jeśli włączone
    texgen_worker = None
    if not args.shape_only:
        logger.info("Ladowanie Hunyuan3DPaintPipeline (delight + multiview diffusion texture)...")
        texgen_worker = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2")
        texgen_worker.models["multiview_model"].pipeline.vae.use_slicing = True

    # 4. Zastosowanie MMGP Offloadingu (do 64 GB RAM / 8 GB VRAM)
    logger.info(f"Konfigurowanie MMGP Offload: Profil {args.profile}, budzet VRAM={args.budget} MB, RAM pinning...")
    replace_property_getter(i23d_worker, "_execution_device", lambda self: "cuda")
    
    pipe = offload.extract_models("i23d_worker", i23d_worker)
    if texgen_worker is not None:
        pipe.update(offload.extract_models("texgen_worker", texgen_worker))

    offload_kwargs = {}
    if args.profile < 5:
        offload_kwargs["pinnedMemory"] = "i23d_worker/model"
    if args.profile not in (1, 3):
        offload_kwargs["budgets"] = {"*": args.budget}

    offload.profile(pipe, profile_no=args.profile, verboseLevel=1, **offload_kwargs)
    print_memory_stats("Po aktywacji MMGP offload")

    # 5. Generowanie siatki 3D (Shape Generation)
    is_mv = args.mode.startswith("mv")
    logger.info(f"Generowanie ksztaltu 3D z {'4 rzutow' if is_mv else '1 zdjecia'} (kroki={args.steps}, octree={args.octree_resolution})...")
    t0_shape = time.time()
    
    generator = torch.Generator(device="cpu").manual_seed(args.seed)
    outputs = i23d_worker(
        image=prepared_images if is_mv else prepared_images["front"],
        num_inference_steps=args.steps,
        guidance_scale=args.guidance,
        generator=generator,
        octree_resolution=args.octree_resolution,
        num_chunks=args.chunks,
        output_type="mesh"
    )
    
    mesh = export_to_trimesh(outputs)[0]
    t_shape = time.time() - t0_shape
    logger.info(f"Bryla wygenerowana w {t_shape:.1f}s: {len(mesh.vertices)} wierzcholkow, {len(mesh.faces)} scianek.")
    print_memory_stats("Po generacji ksztaltu")

    # Czyszczenie i optymalizacja siatki
    logger.info(f"Redukcja i optymalizacja geometrii (cel: do {args.face_count} trojkatow)...")
    mesh = FloaterRemover()(mesh)
    mesh = DegenerateFaceRemover()(mesh)
    mesh = FaceReducer()(mesh, max_facenum=args.face_count)
    logger.info(f"Po redukcji: {len(mesh.vertices)} wierzcholkow, {len(mesh.faces)} scianek.")

    # Zapis siatki bazowej (white mesh)
    white_glb_path = out_dir / f"{base_name}_white.{args.export_format}"
    mesh.export(str(white_glb_path))
    logger.info(f"Zapisano biala bryle: {white_glb_path} ({white_glb_path.stat().st_size / (1024*1024):.2f} MB)")

    # 6. Generowanie fotorealistycznej tekstury PBR (TexGen)
    if texgen_worker is not None:
        logger.info("Generowanie tekstury PBR za pomoca Hunyuan3DPaintPipeline...")
        t0_tex = time.time()
        ref_image = prepared_images["front"]
        textured_mesh = texgen_worker(mesh, ref_image)
        t_tex = time.time() - t0_tex
        logger.info(f"Tekstura wygenerowana w {t_tex:.1f}s.")
        print_memory_stats("Po generacji tekstury")

        textured_glb_path = out_dir / f"{base_name}_textured.{args.export_format}"
        textured_mesh.export(str(textured_glb_path))
        file_size_mb = textured_glb_path.stat().st_size / (1024 * 1024)
        logger.info(f"SUKCES! Zapisano oteksturowany model 3D: {textured_glb_path} ({file_size_mb:.2f} MB)")
    else:
        logger.info("Pominieto etap teksturowania (--shape-only).")

    torch.cuda.empty_cache()
    logger.info("=== ZAKONCZONO POMYSLNIE ===")


if __name__ == "__main__":
    main()
