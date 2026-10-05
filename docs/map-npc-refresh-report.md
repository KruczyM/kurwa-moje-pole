# Mapa, proporcje NPC i pliki robocze — 2026-10-04

Zmiany na `feat/festival-next`, bez push/PR/merge.

- Grzybek usunięty z punktów mapy i legendy; obiekt w świecie pozostaje.
- Mapa w grze korzysta z 350 aktualnych footprintów świata, zmierzonych przed batchingiem: drogi, namioty, pasaż, scena, ASP, FOH, barierki i Młyn Allegro. Granice obejmują północne obozy i rozszerzają się dla przemieszczonych modeli. Tło jest zielone, cementowe drogi szare; etykiety rozdzielane i ograniczane do obszaru canvasu. Przed wczytaniem świata pozostaje schematyczny fallback mapy.
- Wszystkie modele obsługiwane przez NpcManager i wspólną fabrykę aktorów mają 86% poprzedniej szerokości, 94% głębokości i niezmienioną wysokość docelową 2,45 m. Zwężenie na grupie zewnętrznej, bez edycji kości, wag i współdzielonych assetów. Pomiar przy dopasowaniu uwzględnia rzeczywistą zdeformowaną geometrię.
- Globalny własny motyw scrollbarów dla Firefox/Chromium; istniejące indywidualne motywy paneli nadal działają.
- Ignorowane nowe lokalne projekty i backupy Blender, referencje, staging postaci, źródłowe grafiki scen i pliki tymczasowego eksportu. Runtime GLB nie jest ignorowany. Nic nie usunięto z dysku ani indeksu/historycznych LFS.

## Weryfikacja

55 testów w 5 plikach: FestivalMap, NpcManager, FlankiActors, AuthoredFestivalWorld, RemotePlayersManager — PASS. Build i lint wskazanych plików — PASS; istniejące ostrzeżenie o wielkości bundla.

Chromium na produkcyjnym podglądzie: wszystkie 107 NPC doczytane, stosunki skali szerokości/głębokości sprawdzone dla każdego dostępnego visual; 350 elementów mapy; brak grzybka w legendzie; zoom i zamknięcie mapy działają; style przewijania nie są `auto`; brak błędów JavaScript. Obejrzano screenshot mapy i kilku NPC przy pasażu. Artefakty: `reports/map-npc-refresh/browser-report.json`, `map.png`, `npc.png`. To nie jest pełny wizualny audyt każdej animacji każdej postaci; nie naprawiano tu źródłowych rigów.

Pierwsze podejście testowało 22 modele podczas streamingu. Kolejne próby przerwano przy zmianach/HMR; osobny preview wymagał przekierowania prefiksu `/kurwa-moje-pole/` na lokalne zasoby. Ostateczny test produkcyjnego buildu zakończył się PASS dla całego doczytanego tłumu. Tymczasowy podgląd zamknięto.

Instrukcja aktualizacji backendu i ograniczenia `git pull`/LFS: `docs/server-update.md`.
