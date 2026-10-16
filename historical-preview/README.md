# Bongo Rush v6 — stan po poprawieniu postaci

Gałąź: `preview/bongo-v6-after-characters`.

Zachowany build z 15 października 2026, po ukończeniu ilustrowanych postaci v6, animacji zależnej od dystansu i odbioru kampanii. Nie zawiera późniejszych prac nad trzema szatami graficznymi ani zmian Gemini.

## Podgląd

Uruchom z katalogu tej gałęzi:

```powershell
python -m http.server 5198 --bind 127.0.0.1 --directory historical-preview
```

Otwórz: http://127.0.0.1:5198/kurwa-moje-pole/bongo-rush.html

To samodzielny, zamrożony build gry. Nie wymaga npm ani ponownej kompilacji. Menu i wybór postaci działają; odnośniki do innych gier festiwalu nie należą do tego podglądu.

## Pochodzenie i ograniczenia

Źródło to istniejący katalog `reports/bongo-campaign-v6/production-verification` w worktree `bongo-rush-v6`. Pliki HTML, JavaScript, CSS i grafiki skopiowano bez zmian bajtów. Manifest SHA-256 i wcześniejsze raporty są w `docs/historical-preview/`.

Ten etap nie miał osobnego commita źródłowego. Gałąź zabezpiecza autentyczny skompilowany wynik, a nie odtworzony kod źródłowy z tego momentu. Bazowy kod projektu pochodzi z `c6284e5`; `npm run build` nie odtworzy tego historycznego podglądu. Do oglądania używaj katalogu `historical-preview`, nie standardowego serwera Vite.

Zachowany build był wersją weryfikacyjną: parametr `?verify` włącza diagnostykę tylko do odczytu. Bez parametru podgląd służy do zwykłej gry. Raporty z 15 października opisują poprzedni odbiór; nie są wynikami nowego uruchomienia. Test na fizycznym telefonie i subiektywna ocena pozostają `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`.
