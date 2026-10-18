# Bongo Rush — rozbudowane jaskinie

Data: 2026-10-11. Gałąź: `feat/bongo-expanded-caves`.
Worktree: `.ai/worktrees/bongo-caves`.

## Zmiany

- 12 autorskich plansz o rozmiarach od 46×34 do 60×44 pól, zamiast 24×18.
  Powierzchnia wzrosła około 3,6–6,1 raza.
- 9–16 komór na poziom, galerie, szyby, pętle, skróty i boczne złoża.
  Wymagane zbiory: 18, 24 lub 32 przedmioty; dostępnych jest więcej niż wymagane minimum.
- Zróżnicowana architektura komór, podparte złoża skał, bramki do przepychania,
  boczne kieszenie patroli i zachowany rozrastający się Krzak/Kobra.
- Chropowate ściany i ziemia, korzenie, minerały, przygaszone tła i delikatne światło
  wokół gracza. Grafika kafelków powstaje w istniejącym cache Canvas.
- Kamera uwzględnia faktyczny rozmiar planszy. Renderowane są tylko widoczne kafelki.
- Minimapa, przełączana przyciskiem lub klawiszem M, odświeżana po zmianie ticka.

Inspiracja: eksploracja jaskiń, spadające skały i odmienne światy opisane w
[oficjalnym przeglądzie Boulder Dash](https://boulder-dash.com/BoulderDash_General.pdf).
Nie kopiowano cudzych plansz, kodu ani grafik.

## Wyniki lokalne

- `npm run ci:code`: PASS — kodowanie, formatowanie, lint, TypeScript,
  1525 testów jednostkowych w 166 plikach oraz 6 testów narzędziowych.
- Wszystkie 12 tras przechodzi rzeczywistą symulację bez teleportacji i bez
  zablokowanego kroku. Każda trasa obejmuje co najmniej trzy przepchnięcia skały.
- Testy deterministyczności, rozmiaru, dodatkowych złóż i połączeń całej mapy: PASS.
  Graf przejść zawiera cykle, więc nie jest pojedynczym korytarzem.
- `npm run build`: PASS. Pozostaje wcześniejsze ostrzeżenie dotyczące wielkości
  bundla festiwalu 3D, niezależnego od wejścia Bongo Rush.
- `git diff --check`: PASS.

## Weryfikacja przeglądarkowa

- `python scripts/verify-bongo-expanded.py`: PASS w Chromium i WebKit z profilem
  iPhone 13. Ukończono pierwszy rozbudowany poziom przez interfejs w obu silnikach.
  Sprawdzono atlasy postaci, sterowanie, pauzę, restart, fokus i orientację telefonu.
- Galeria załadowała wszystkie 12 poziomów, sprawdziła ich rozmiary oraz przełączanie
  minimapy przyciskiem i M. Galeria używa jawnego fixture odblokowania poziomów;
  nie jest testem zdobycia całego postępu kampanii.
- `python scripts/verify-bongo-production.py`: PASS dla buildu z prefiksem
  `/kurwa-moje-pole/`, w Chromium i mobilnym WebKit. Sprawdzono sterowanie,
  pauzę, działający RAF, restart, menu i brak dev API.
- `python scripts/verify-bongo-bush.py`: PASS — Kobra poza wyborem postaci,
  aktywacja, rozrost, blokada przejścia, pauza i restart.
- Brak błędów JavaScript i HTTP w powyższych przebiegach.

Raporty i zdjęcia pozostają lokalnie w ignorowanych katalogach:
`reports/bongo-expanded/`, `reports/bongo-rush/` oraz `reports/bongo-bush/`.

## Samodzielne code review

Sprawdzono początkowe podparcie złóż, wolne kieszenie do przepychania skał,
spójność tras, kadrowanie kamery i sprzątanie minimapy. Zachowano istniejącą
pojedynczą pętlę RAF, fizykę, cache assetów i obsługę listenerów. Nie zmieniano
assetów After ani lokalnych zmian w głównym worktree.

## Ograniczenia odbioru

Wszystkie poziomy ukończono w testach symulacji, ale pełne przejście przeglądarkowe
obejmuje tylko pierwszy poziom. Trudność całej kampanii, ergonomia i wydajność
fizycznego iPhone’a wymagają sprawdzenia przez gracza. Emulacja nie potwierdza
60 FPS na rzeczywistym telefonie. Nie wykonano push, PR ani merge.
