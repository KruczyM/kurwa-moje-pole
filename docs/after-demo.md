# After: ostatnia noc — zdalna demonstracja

Adres po wdrożeniu Pages: <https://kruczym.github.io/kurwa-moje-pole/after-demo.html>.
Lokalnie: `npm run dev:client`, następnie `/after-demo.html`.
Produkcja: `npm run build` generuje zarówno dotychczasowe `index.html`, jak i `after-demo.html`.
Główna gra pozostaje bez zmian; demo nie wymaga serwera Socket.IO ani modeli 3D.

## Co można zobaczyć

- Wybór Ampera lub Chlebaka, mapa pilota 24×18, animowany ruch i kamera.
- Trzy zadania: flaga, znajomy, światło; finał po powrocie do obozu.
- Polskie rozmowy, wybory odpowiedzi i opcjonalne relacje.
- Klawiatura WASD/strzałki, Shift, E, Escape; ekranowe kierunki, sprint, interakcja,
  zamknięcie rozmowy, pauza i restart. Escape najpierw zamyka rozmowę.
- Offline solo: brak sieciowego lobby, zapisu i kontynuacji po odświeżeniu.

Grafika pochodzi z gałęzi Gemini `f08434f`; zaimportowano tylko mały zestaw 2D
(dwa atlasy postaci, tiles/props i dwa portrety, razem około 384 KiB plików).
Mapa to prosty pilot z istniejącej symulacji, nie wierny eksport festiwalu.
NPC wykorzystują tymczasowo ten sam sprite Chlebaka; różne tożsamości i pełna
reżyseria mapy pozostają kolejnym etapem. Bieg korzysta z szybszego chodu,
nie osobnej animacji. To demo postępu, nie pełne wydanie ani 10–15 minut kampanii.

## Pliki

- `after-demo.html`: osobny punkt wejścia, HUD, przyciski i panele.
- `src/games/after/demo/main.ts`: izolowany host demo, Canvas 2D, cache obrazów,
  routing wejść, lifecycle i integracja istniejącej kampanii.
- `src/games/after/demo/demo.css`: responsywny układ, safe-area i kontrolki.
- `vite.config.ts`: dwa niezależne wejścia produkcyjne; dotychczasowy URL zachowany.
- `scripts/verify-after-demo.py`: WebKit/iPhone 13 i Chromium; prawdziwe przyciski,
  klawiatura i pointer, deterministyczne przejście questów bez teleportacji.
- `scripts/verify-after-production.py`: smoke test produkcyjnego HTML/bundla,
  dotykowe wejście, pauza i brak żądań 3D/sieci gry.

Demo korzysta z istniejących `AnimationLoop` i `EventScope`. Ma jeden RAF, jeden
Canvas 2D, żadnego WebGL. Festiwal 3D nie jest uruchamiany równolegle. To izolowany
adapter demonstracyjny, nie druga implementacja docelowego wspólnego GameHost/registry.
Przy integracji menu należy przenieść jego lifecycle pod SHARED-01.

Obrazy są ładowane raz na stronę. DPR canvasa ograniczono do 2, resize zmienia
istniejący canvas i kamerę. Ukrycie karty czyści wejścia i pauzuje. Wyjście sprząta
RAF, listenery, ResizeObserver i cache; powrót z bfcache zachowuje pauzę.
Teksty dialogów trafiają przez `textContent`, nie HTML. Diagnosticzny uchwyt
`?verify=1` istnieje tylko w development i jest usuwany z produkcji.

## Weryfikacja

Lokalny WebKit (profil iPhone 13) i Chromium przeszły wejście, ruch klawiaturą
i pointerem, zatrzymanie ticków podczas pauzy, zamknięcie dialogu przez Escape
bez otwierania pauzy, trzy questy, finał, restart i orientację landscape.
Brak błędów JavaScript i pobrań GLB/filmów/Socket.IO. Zrzuty obejrzano.
Artefakty: ignorowany `reports/after-demo/`.

Autorski review sprawdził izolację wejścia/bundla, cleanup i bfcache, ścieżki Pages,
komendy dialogu, brak teleportacji w teście, ograniczenie DPR oraz brak kluczy/API.
Poprawiono iterację NodeList zgodnie z tsconfig oraz lifecycle przy bfcache.
Poprawiono też bazową ścieżkę `vite preview`, aby sprawdzać dokładnie podkatalog Pages.
Pełna regresja: 1467 testów w 159 plikach, 6 testów narzędziowych; lint, format,
typecheck, UTF-8 i build przeszły. Produkcyjny smoke test WebKit potwierdził
HTTP 200, skompilowane wejście, dotykowy start/pauzę/wznowienie, brak błędów HTTP/JS
oraz brak pobrań 3D. Bundle After ma około 32 KiB przed gzip (11 KiB po gzip),
osobny od dużego bundla festiwalu.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: fizyczny iPhone, ergonomia multi-touch,
czytelność finalnej grafiki, balans i czas kampanii. Emulacja WebKit nie jest pomiarem
FPS/RAM fizycznego telefonu. Sam test integralności assetu nie potwierdza jego wyglądu.
