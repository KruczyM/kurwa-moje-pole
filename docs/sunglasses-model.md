# Model okularów przeciwsłonecznych

Źródło: [Glasses — iPoly3D](https://poly.pizza/m/9xOJlCsQzX), CC0-1.0.
Model runtime: `public/game-assets/interactables/sunglasses.glb`, ~39 KB,
952 trójkąty, bez bitmap i zewnętrznych zależności. Ciemnoszare oprawki,
ciemnoniebieskie soczewki; geometria oryginalna. Licencja i źródło obok modelu.
Regeneracja: `node scripts/import-sunglasses.mjs` (pobiera publiczny plik bez kluczy).

Przyczyna zastępczej bryły: `sunglasses` istniały w `inspectableItems` oraz
konfiguracji gestu zakładania, ale nie w katalogu/manifestach ładowanych GLB.
Dodano model do obu rejestrów. Korzysta z istniejącego loadera/cache, stołu,
inspekcji i gestu, bez dodatkowego renderera czy pętli. Na stole soczewki
są skierowane do góry, rozmiar pozostaje 18 cm i nie zmienia strefy interakcji.

Sprawdzono: test zgodności wszystkich przedmiotów z rejestrem modeli,
1394 testy jednostkowe, walidacja assetów/rigów, lint/typecheck i build.
Test przeglądarkowy `python scripts/verify-sunglasses.py` potwierdza rzeczywisty
model z 968 wierzchołkami w dwóch meshach na stole, wpis w cache oraz działający
podgląd inspekcji. Brak błędów JavaScript; podgląd sprawdzono wizualnie.
Raport i zrzuty: `reports/sunglasses/` (lokalne, ignorowane przez Git).
