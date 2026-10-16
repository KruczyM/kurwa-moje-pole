"""Add direct level selection while keeping the existing hero and menu controller."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREVIEW = ROOT / "historical-preview/kurwa-moje-pole"
SOURCE = PREVIEW / "assets/bongo-no-decorative-chambers.js"
TARGET = PREVIEW / "assets/bongo-preview-quick-levels.js"
bundle = SOURCE.read_text(encoding="utf-8")
replacements = [
    ('openHeroes(){this.screen="heroes",this.confirmed=!1}',
     'openLevels(){this.screen="levels",this.confirmed=!0}openHeroes(){this.screen="heroes",this.confirmed=!1}'),
    ('returnToMenu(){this.menu.title(),this.selected=this.progress.unlocked-1,this.showMenu(),this.loadRun(this.selected)}',
     'returnToMenu(){this.menu.openLevels(),this.selected=this.game.level.id-1,this.showMenu(),this.loadRun(this.selected)}'),
    ('e("begin",()=>{this.begin()}),e("play",',
     'e("begin",()=>{this.begin()}),e("choose-level",()=>{this.audio.unlock(),this.returnToMenu()}),e("play",'),
]
for before, after in replacements:
    assert bundle.count(before) == 1, before
    bundle = bundle.replace(before, after, 1)
TARGET.write_text(bundle, encoding="utf-8", newline="")
page = PREVIEW / "bongo-rush.html"
html = page.read_text(encoding="utf-8").replace(SOURCE.name, TARGET.name)
if 'id="choose-level"' not in html:
    needle = '<button id="play" class="primary">Graj →</button>'
    assert html.count(needle) == 1
    html = html.replace(needle, needle + '\n            <button id="choose-level">Wybierz poziom</button>')
html = html.replace('id="to-menu">Wybór poziomu i postaci', 'id="to-menu">Wybór poziomu')
html = html.replace('id="level-back">← Wybór postaci', 'id="level-back">← Zmień postać')
page.write_text(html, encoding="utf-8", newline="")
print("Direct level selection added; existing hero confirmation and explicit hero change retained.")
