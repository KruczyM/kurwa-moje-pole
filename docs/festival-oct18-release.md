# Wspólne wydanie Bongo i sektorów mobilnych

Wydanie opiera się na `main` / `bcb64c1` i łączy dwa osobno zlecone zakresy:

- Bongo: siedem commitów `3d27842..67e20b2` — opis w
  [raporcie wydania Bongo](bongo-ui-audio-release.md).
- Świat mobilny: wyłącznie `d119e5a` i `b21acc6` z gałęzi
  `fix/mobile-sector-boundaries`, opis w
  [raporcie sektorów i telebimów](mobile-sector-boundaries.md).

Nie publikowano starej gałęzi świata zamiast aktualnego main. Zachowano
bieżący `TentMenuAudio`, pozostałe zmiany muzyki menu oraz nowe źródła Bongo.
Proces `npm run build` kompiluje wszystkie cztery strony przez Vite;
historyczny snapshot Bongo nie nadpisuje wyniku.

Jedyny konflikt w `Game.ts` rozwiązano przez zachowanie nowszej osłony
`!isGuitarActive` wokół aktualizacji streamera, odległej widoczności,
debuggera NPC i ekranów sceny. Dodane oznaczenia sektorów są ukrywane
podczas gry na gitarze. Zachowano istniejące `pointer-events: auto` w CSS.
Nie dołączono osobnego niewersjonowanego audytu ani lokalnych zmian
niezwiązanych z tymi dwoma zakresami.

Niezależny review Bongo, sektorów, telebimów oraz połączonej integracji:
PASS. Sumy patch-ID Bongo są identyczne z serią źródłową; różnice względem
serii mobilnej ograniczają się do opisanych zachowań zachowanych z main.
Walidatory potwierdzają 221 sektorów desktopowych, siedem obszarów mobilnych,
15 plików, 14993 siatki, 402 siatki ASP oraz dwa prawdziwe rezydentne telebimy.

Końcowa walidacja po integracji: `ci:code` PASS (236 plików, 2402 testy
jednostkowe i 8 narzędzi; lokalnie `VITEST_MAX_WORKERS=2`), `ci:assets` PASS,
produkcyjny build czterech stron PASS. Standardowe CI GitHuba pozostaje
wymagane przed scaleniem.

Gotowy bundle Bongo jest identyczny przed i po integracji świata mobilnego.
Test produkcyjnego Bongo przeszedł w Chromium, WebKit w pionie i poziomie
oraz Chromium 320×480. Test sektorów w Chromium potwierdził przejście do ASP,
anulowanie, ponowienie po celowo przerwanym pobieraniu i powrót do obozu,
bez błędów JavaScript. Test telebimów w Chromium i WebKit potwierdził
rzeczywiste dekodowane klatki, postęp czasu i współdzieloną teksturę obu
ekranów. Chromium dodatkowo potwierdził odblokowanie audio po geście;
testowy WebKit na Windows nie udostępnia Web Audio API.

Testy przeglądarkowe można uruchomić na własnym buildzie i lokalnym backendzie:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5254
# W drugim terminalu:
$env:PORT = '3157'
npm run server
# W kolejnym terminalu, z Pythonem zawierającym Playwright:
python scripts/bongo-v6/verify-ui-release.py
python scripts/verify-mobile-sector-boundaries.py 'http://127.0.0.1:5254/kurwa-moje-pole/?server=http://127.0.0.1:3157'
python scripts/verify-mobile-stage-video.py 'http://127.0.0.1:5254/kurwa-moje-pole/?server=http://127.0.0.1:3157'
```

Parametry URL skryptów mobilnych są opcjonalne; stare adresy domyślne
zachowano. Raporty są zapisywane w ignorowanym katalogu `reports/`.
Testy nie zastępują fizycznego telefonu. Odsłuch muzyczny, komfort,
pamięć i FPS na urządzeniu pozostają `PENDING_HUMAN`.
