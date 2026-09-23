# Młyn Allegro — prototyp konstrukcji i ruchu

Punktem wyjścia są zdjęcia młyna dołączone przez użytkownika. [Oficjalny materiał organizatora 2026](https://newsroom.polandrockfestival.pl/466935-festiwal-trwa-w-najlepsze-co-znajdziecie-w-strefach-naszych-partnerow) potwierdza obecność atrakcji, ale nie jej parametry techniczne. Zdjęcie OneBox z tego artykułu nie jest referencją konstrukcji młyna.

## Aktualny zakres

- Autorski GLB `world/festival/allegroWheel.glb`, generator `scripts/blender/build-festival-wheel.py`.
- Roboczo: promień 15 m, oś na 18 m, 24 gondole, wysokość około 33 m. **Liczba gondoli i wymiary nie są potwierdzonymi parametrami młyna z 2026.**
- Podwójna obręcz, szprychy, stężenia, podpory, oś, pomarańczowy podest i ogrodzenie, uproszczony szyld. Gondole otwarte z daszkiem, siedziskiem i barierkami.
- Listwy świetlne z sześcioma stałymi kolorami emissive; bez stroboskopu, dodatkowych lamp punktowych ani migania. Drobna lokalna faktura lakieru i mapa szorstkości.
- 1233516 B, 31120 trójkątów widocznego modelu, 61 instancji meshy. GLB przechowuje 15 definicji siatek; 24 gondole współdzielą dwie geometrie i dwa materiały. Nie jest to instancing GPU ani zmierzony koszt klatki.
- Pozycja testowa X=37, Z=0, nie docelowe miejsce z mapy 2026. Stały collider obejmuje strefę pracy, maska trawy tylko podest. Nie można wejść na atrakcję ani wsiąść.

## Animacja i cykl życia

Istniejący `Game.updateFrame` przekazuje delta time do `CampWorld.update`. `FestivalWheel` obraca jedynie rotor i kontruje obrót lokalny gondoli, utrzymując je w pionie. Obrót trwa umownie 120 s. Nie ma nowej pętli renderowania, zegara, timera ani listenerów.

Pauza gry nie aktualizuje młyna. `reduceMotion` zamraża obrót bez zerowania pozycji. Błędne/ujemne delta time są ignorowane. Po `dispose` aktualizacje nie działają; geometrie i materiały zwalnia raz istniejący mechanizm sprzątania sceny. Nie zmieniamy obiektów z cache loadera.

## Weryfikacja

- Testy rzeczywistego GLB: budżet, skala, 24 pivoty, współdzielenie geometrii, PBR i emissive, brak klipów wymagających dodatkowego miksera.
- Pełny obrót w próbkach: wszystkie gondole pionowo, stały promień, brak kontaktu z podestem. Zgodność przy 30/144 FPS, zamrożenie reduceMotion, brak mutacji źródła i pojedyncze sprzątanie.
- Kolizje poza namiotami/sklepem, podest ponad terenem, trawa usunięta spod podestu. Test tras obozowiska uwzględnia teraz oba nowe obiekty.
- Podgląd dzień: `reports/festival-landmarks/allegroWheel.png`; noc i inny kąt obrotu: `reports/festival-landmarks/wheel-night/allegroWheel.png`. Obejrzane, są renderami offline, nie raportem gry. Model nadal uproszczony, bez pełnego wyposażenia technicznego i obsługi kolejki.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**. Sprawdzić w grze ruch, pion gondoli, jasność nocą, cienie, kolizje, ustawienie ograniczenia ruchu oraz FPS. Backend przeglądarki `iab` pozostaje niedostępny.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/build-festival-wheel.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --factory-startup --python scripts/blender/audit-tents.py -- --root public/game-assets/world/festival --output reports/festival-landmarks/wheel-night --models allegroWheel --views beauty front --wheel-angle 67 --night
```
