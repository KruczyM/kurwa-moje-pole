"""Reuse real browser terrain checks for the new art without duplicating the gameplay harness."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / 'scripts/verify-bongo-textures.py').read_text(encoding='utf-8')
source = source.replace("reports/bongo-textures", "reports/bongo-art-v2")
source = source.replace('127.0.0.1:5205', '127.0.0.1:5210')
source = source.replace("'/tiles-ai/'", "'-terrain.png'")
exec(compile(source, str(root / 'scripts/verify-bongo-textures.py'), 'exec'))
