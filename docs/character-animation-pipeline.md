# Pipeline rigów i animacji postaci

## Kanoniczne pliki

Każda postać ma trzy odrębne zastosowania modelu:

- `public/game-assets/characters/<id>/preview.glb` — lekki podgląd w menu;
- `public/game-assets/characters/<id>/npc-animations.glb` — model ze skórą,
  szkieletem i pełną biblioteką ruchów używany przez grę;
- `source-assets/characters/<id>/t-pose.glb` — pozbawiona animacji baza do
  ponownego rigowania i odbudowy biblioteki.

Pierścień dodatkowo zachowuje cztery źródłowe eksporty w
`source-assets/characters/pierscien/mixamo/`. Są wersjonowane przez Git LFS,
aby nie utracić ponownie modelu źródłowego.

## Kontrakt szkieletu

Postacie używają szkieletu `mixamo-humanoid` z nazwami kości
`mixamorig:*`. Wymagane kości i 13 kanonicznych nazw klipów znajdują się w
`src/game/animation/characterAnimationContract.json`. Pień ma uproszczony
szkielet bez części kości palców, ale zachowuje komplet kości wymaganych dla
lokomocji. Nie należy automatycznie łączyć rigu, jeżeli walidator zgłosi brak
którejkolwiek wymaganej kości.

## Pobieranie z Mixamo

Pierwszy plik dla nowej postaci:

- `FBX Binary`;
- `With Skin`;
- T-pose;
- 30 FPS;
- bez redukcji klatek kluczowych.

Kolejne animacje można pobierać `Without Skin`, ponieważ skrypt wykorzystuje
mesh, materiały i wagi wyłącznie z pliku bazowego. Dla `Walking` i `Running`
należy zaznaczyć `In Place`; przesunięciem NPC steruje kod gry. Nazwy źródeł
mogą być mapowane przez aliasy, ale wynikowe klipy muszą nazywać się dokładnie
`Idle`, `Walk` oraz `Run`.

## Budowanie biblioteki

Skrypt wymaga Blendera 5.x i odrzuca animację, jeśli zestaw kości różni się od
bazy. Przykład odbudowy Pierścienia w PowerShell:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' `
  --factory-startup --background `
  --python scripts/blender/build-character-animation-library.py -- `
  --base source-assets/characters/pierscien/mixamo/t-pose.fbx `
  --library public/game-assets/characters/pierscien/npc-animations.glb `
  --exclude-library-clip Idle `
  --exclude-library-clip Walk `
  --exclude-library-clip Run `
  --clip 'Idle=source-assets/characters/pierscien/mixamo/idle-neutral.fbx' `
  --clip 'Walk=source-assets/characters/pierscien/mixamo/walking.fbx' `
  --clip 'Run=source-assets/characters/pierscien/mixamo/running.fbx' `
  --t-pose-output source-assets/characters/pierscien/t-pose.glb `
  --output public/game-assets/characters/pierscien/npc-animations.glb
```

Skrypt bierze rig, siatkę, wagi i materiały z `--base`. Importowane kopie mesha
z plików animacji są usuwane. Pozostałe dziesięć ruchów może zostać przejęte z
istniejącej zgodnej biblioteki za pomocą `--library`.

## Kontrola deformacji

Po zbudowaniu biblioteki uruchom walidację strukturalną:

```powershell
npm run check:rigs
```

Następnie wyrenderuj próbki lokomocji:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' `
  --factory-startup --background `
  --python scripts/blender/render-animation-audit.py -- `
  --model public/game-assets/characters/pierscien/npc-animations.glb `
  --output reports/pierscien-animation-audit `
  --clips Idle Walk Run
```

Należy obejrzeć przód i bok początku, środka oraz końca każdego klipu. Kontrola
obejmuje barki, łokcie, dłonie, rękawy, biodra, kolana, stopy oraz ciągłość
pierwszej i ostatniej klatki. Dopiero po tej kontroli status postaci w
`characterRigApproval.json` może zostać ustawiony na `approved`.

## Dodawanie kolejnych ruchów

Nową animację pobiera się tylko raz ze zgodnego szkieletu Mixamo. Dodaj jej
kanoniczną nazwę do kontraktu, przekaż plik jako kolejny argument `--clip`,
odbuduj biblioteki postaci i uruchom walidację. Osobny eksport animacji dla
każdej postaci jest potrzebny wyłącznie wtedy, gdy proporcje powodują widoczne
problemy kontaktu z podłożem albo rekwizytem.
