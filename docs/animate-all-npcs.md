# Hurtowe dodawanie animacji

Skrypt `scripts/animate_all_npcs.py` działa lokalnie na Pythonie 3.10+ i Blenderze 5. Korzysta z istniejącego `build-character-animation-library.py`, a nie z drugiego retargetera. Obejmuje postacie grywalne, przygotowywane postacie oraz wszystkie 91 botów festiwalowych.

## Uruchomienie z bieżącego worktree

```powershell
cd E:\kodowanie\gra\.ai\worktrees\festival-2026-tent-upgrades
$npcPython = 'E:\kodowanie\gra\Hunyuan3D-2GP\.venv\Scripts\python.exe'

# Inwentaryzacja i lista brakujących rigów; nie uruchamia Blendera.
& $npcPython scripts/animate_all_npcs.py

# Wszystkie modele z gotowym szkieletem i skinningiem.
& $npcPython scripts/animate_all_npcs.py --execute

# Jedna postać lub kilka powtórzonych parametrów --only.
& $npcPython scripts/animate_all_npcs.py --execute --only amper

# Dodatkowy klip z lokalnego pliku, po jego dostarczeniu.
& $npcPython scripts/animate_all_npcs.py --execute --only amper --clip 'LieDown=E:\animacje\lying-down.fbx'
```

Można wskazać `--blender`, `--donor`, `--rig-root` i limit czasu na model przez `--timeout`. Skrypt pracuje kolejno, zapisuje log dla każdego modelu i kontynuuje po błędzie. Kod wyjścia 2 po budowie oznacza, że część modeli jest zablokowana/brakująca lub nie przeszła eksportu. Nigdy nie oznacza całej partii jako wykonanej przy brakujących rigach.

## Jak przygotować statyczne modele

Do modeli bez kości służy teraz lokalny `scripts/rig_all_npcs.py`. Działa bez usług AI i bez kluczy API:

```powershell
# Sama inwentaryzacja.
& $npcPython scripts/rig_all_npcs.py
# Budowa wersji roboczych, bez zmiany gry.
& $npcPython scripts/rig_all_npcs.py --execute
# Budowa i instalacja zweryfikowanych plików; oryginały są archiwizowane.
& $npcPython scripts/rig_all_npcs.py --execute --install
# Opcjonalnie: --only 001_pirate_parrot_girl --jobs 1
```

Rigowanie obejmuje 22 kości ciała zgodne nazwami z Mixamo, dopasowanie do sylwetki T-pose i wzrostu 2,45 m, wagi Bone Heat oraz zastępcze wygładzone wagi względem segmentów kości dla nieprzypisanych wierzchołków. Każdy wierzchołek ma najwyżej cztery wpływy, sumujące się do 1. Istniejące szkielety są sprawdzane i zachowywane. Nowe modele otrzymują klipy Idle, Walk i Run przez istniejący retargeter. Nie powstaje nowy loader ani pętla animacji.

To **automatyczny rig roboczy**, nie ręcznie dopracowany skinning. Włosy, szerokie ubrania i zespolone rekwizyty mogą wymagać ręcznej korekty. Nie ma indywidualnego rigowania palców ani twarzy. Dla wadliwego `dino` z czterema widokami w jednej siatce wyodrębniono przednią postać i odtworzono symetryczną połowę kostiumu; oryginał pozostaje w kopii.

Raporty, logi, oryginały i wygenerowane GLB są w `reports/npc-rig-batch/<czas-UTC>/`. Flaga `--install` zastępuje pliki pod istniejącymi adresami katalogu dopiero po walidacji wag i klipów. Zachowuje też bazowe `t-pose.glb` w `source-assets/rigged-festival/<id>/`, aby później dodawać kolejne animacje bez ponownego rigowania. Katalog `reports` jest lokalny i ignorowany przez Git — nie kasować go, jeśli potrzebny jest rollback.

Alternatywnie można dostarczyć ręcznie poprawiony rig, np. eksport Mixamo ze skórą w:

```text
source-assets/rigged-festival/<id-modelu>/t-pose.fbx
```

Obsługiwany jest też `t-pose.glb`. Dla ośmiu pierwotnych postaci skrypt odnajduje istniejące riggi w `source-assets/characters/<id>/t-pose.glb`. Alternatywnie potrafi wykorzystać już rigowany model runtime. FBX jest ostatecznie sprawdzany w Blenderze; samo istnienie pliku nie oznacza gotowego rigu.

Sam `animate_all_npcs.py` dodaje klipy do gotowych szkieletów; automatyczne tworzenie kości i wag jest zadaniem `rig_all_npcs.py`. Dodawanie klipów do obiektu bez wag nie porusza kończyn. Nieludzkie sylwetki i pozy inne niż T mogą wymagać osobnego przygotowania.

## Wynik i kontrola

Każde uruchomienie tworzy osobny katalog `reports/npc-animation-batch/<czas-UTC>/`. Zawiera raport JSON, pliki `npc-animations.glb`, bazowe `t-pose.glb` oraz logi Blendera. Oryginały i pliki gry pozostają niezmienione. Po obejrzeniu deformacji należy wdrożyć zaakceptowane wyniki do odpowiednich ścieżek runtime w osobnym kroku.

Eksport jest sprawdzany pod kątem obecności siatki ze skinningiem oraz niepustych klipów Idle, Walk i Run. Raport zawiera rozmiar i SHA-256. Nie zastępuje to kontroli deformacji, ciągłości kroku i dopasowania tempa w grze. Klipy dodatkowe są dołączane do GLB, ale siadanie/leżenie wymaga jeszcze odpowiednich stanów zachowania NPC.

Pierwotna próba na Amperze: 41 kości i 13 klipów, 5 953 148 B (`reports/npc-animation-batch/20260924T172027861259Z/report.json`). Pierwotna inwentaryzacja przed automatycznym rigowaniem: 8 baz ze skinningiem oraz 99 statycznych modeli. Bieżący stan pokazuje raport `rig_all_npcs.py`, a nie ten historyczny pomiar.

Testy skryptu:

```powershell
& $npcPython scripts/test_animate_all_npcs.py
& $npcPython scripts/test_rig_all_npcs.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/blender/test-rig-retarget.py
```

## Robocze sceny i wzrost NPC

Historyczna weryfikacja przed rigowaniem: 5 testów skryptu zaliczonych; 546 testów gry zaliczonych, 2 błędy ówczesnego modelu Klątwy. Build i kontrola typów zaliczone. HTTP 200 dla obu scen pod `http://127.0.0.1:5174/`. Kontrola wizualna obejmowała rendery offline scen, nie rozgrywkę.

Duża i Mała Scena wykorzystują dostarczone `main_stage.glb` i `small_stage.glb`. Są wpięte w istniejący katalog, loader, kolizje i maskę trawy. Duża stoi na wschodzie (X=116, Z=18), zwrócona w stronę środka terenu; Mała na południu (X=52, Z=116), zwrócona na północ. Skalowanie zachowuje proporcje; to miejsca robocze, nie pozycje geodezyjne z mapy.

Obejrzano rendery offline obu modeli: mają typowe dla generowania AI artefakty geometrii i napisów. Są prototypami, nie końcowym odwzorowaniem scen festiwalu. Wszystkie postacie i boty mają teraz wysokość 2,45 m. **VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN** — brak odbioru runtime w przeglądarce.
