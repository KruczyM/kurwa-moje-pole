# Robocze sektory obozowiska

Dodano 47 namiotów (T20–T67 z celowo pominiętym T56), zachowując wszystkie wcześniejsze 19. Łącznie 66 namiotów. Cztery parcele na X/Z od ±20 do ±50 metrów wykorzystują cztery nowe konstrukcje i sześć palet kolorów. T56 jest pominięty, bo miejsce kolidowałoby z obszarem T19.

**To układ do gry i testowania biblioteki, nie mapa Czaplinka–Broczyna 2026.** Gęstość jest celowo niewielka. Nie deklarujemy odwzorowania położenia obozowisk ani skali całego festiwalu.

## Mechanizmy

- Stałe sloty i deterministyczne ziarno 2026; niewielkie różnice pozycji/obrotu, różne konstrukcje i kolory. Pasy przejść mają 3 m szerokości.
- Wszystkie namioty korzystają z jednego katalogu, loadera, geometrii GLB i tekstur. Cache palet klonuje tylko materiały poszycia, współdzieląc je między egzemplarzami i LOD.
- W nowych GLB splot tkaniny jest neutralny, kolor zapisany jako `baseColorFactor`, a role materiałów jako `tentFabricRole`. Nie trzeba generować osobnych tekstur dla każdego koloru. Atlasy starych modeli nie zostały zmienione.
- Podłogi nowych sektorów ustawiane nad najwyższym próbkowanym punktem terenu w obrysie. Istniejące namioty zachowują autorskie korekty wysokości. To nie wyrównywanie gruntu — na spadkach możliwa niewielka szczelina przy skraju.
- Maska trawy używa kubełków przestrzennych 8×8 m. Sampler nie skanuje już wszystkich namiotów dla każdego źdźbła. Alejki usuwają trawę z dodatkową miękką krawędzią.
- Brak nowej pętli renderowania, listenerów, loadera i płatnych usług.

## Testy i podgląd

Sprawdzone: powtarzalność generatora, pokrycie wszystkich modeli/palet, unikalne ID, brak przecinających się colliderów, odstęp od alejek, dojście od starego obozu do każdego wejścia siatką 0,5 m, podłogi wszystkich 47 modeli ponad terenem, zgodność szybkiej maski z pełnym skanem, współdzielenie i sprzątanie materiałów.

```powershell
npx tsx scripts/export-festival-camp.ts
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/render-festival-camp.py
```

Eksport używa tych samych pozycji, skali, kolorów i wysokości co gra. `reports/festival-camp/sector-SE.png` pokazuje 11 nowych namiotów w sektorze SE; stare T19 i reszta świata są pominięte. Podłoże, zaznaczenie alejek i oświetlenie są uproszczeniem do oceny układu, nie zrzutem gameplayu. Render obejrzany.

357 testów jednostkowych i 23 orkiestratora zaliczone; 176 assetów i 8 rigów poprawnych. Build zaliczony po korekcie typowania palet. Nadal wymagane pomiary FPS, kontrola cieni poza dawnym obozem i oględziny w ruchu.
**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**.
