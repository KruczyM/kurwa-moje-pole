# Wybór postaci — grafiki v1

Zmieniono wyłącznie ekran wyboru w fighter-demo. Pozostałe gry, modele 3D, portrety HUD i animacje walki pozostają bez zmian.

- 16 nowych miniatur 192×192: kadr od góry oryginału, twarz i garda zamiast miniaturowej pełnej sylwetki.
- 16 pełnych podglądów 384×576: proporcje 2:3, object-fit: contain bez rozciągania ani obcinania butów.
- WebP, razem 543036 bajtów. Menu nie pobiera pełnych źródeł PNG z art/.
- Poniżej 600 px: siatka nad panelem podglądu, przewijanie całego menu.
- Prompty i źródła oryginałów znajdują się w lokalnym art/fighter/stance-anchors-v1/prompts.json. Folder art/ jest ignorowany przez Git; dostarczane pliki WebP znajdują się w public/game-assets/2d/fighter/selection-v1/.
- Odtworzenie pochodnych: node scripts/build-fighter-selection-art.mjs (ImageMagick 7, lokalne źródła PNG).

## Weryfikacja

Testy selectionArt.test.ts sprawdzają kompletność wszystkich 16 postaci, nagłówki WebP, budżet rozmiaru i adresy dla deploymentu w podkatalogu. Typecheck zakończony powodzeniem.

VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN — brak podłączonej przeglądarki (lista przeglądarek narzędzia jest pusta). Nie deklarujemy przetestowania kadrowania w działającej przeglądarce.

Otworzyć fighter-demo.html, sprawdzić wszystkie 16 postaci, zmianę gracza/przeciwnika i losowanie na desktopie oraz przy szerokościach 320, 390 i 600 px. Upewnić się, że twarze są czytelne, cała sylwetka mieści się w podglądzie, a przycisk rozpoczęcia walki jest osiągalny przez przewijanie. Tło/poświata są świadomie zachowane z zatwierdzanych ilustracji; to grafiki menu, nie wycięte sprite'y walki.
