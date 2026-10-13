# Festiwalowy automat: menu bijatyki

Menu bijatyki otrzymało autorską obudowę automatu: sitodrukowy szyld, metalową
ramę, naklejkę, zestawienie zawodników VS i ilustrowane przyciski aren. Wykorzystuje
istniejące ilustracje WebP i JPG; nie dodaje renderera, pętli ani zewnętrznych fontów.
Wybór trybu ma trzy przyciski; lobby nadal korzysta z obecnego protokołu online.
Sterowanie oraz ustawienia audio są domyślnie zwinięte w natywnych `details`.
Opis sterowania w wyborze postaci i pauzie nie zawiera czasów ciosów. Balans,
symulacja, muzyka walki i efekty ciosów pozostają bez zmian.

## Oryginalna muzyka

Nowy motyw menu „Bloto, pot i combo”: 120 BPM, 32 takty, 64 sekundy, stereo PCM16
22050 Hz. Cztery ośmiotaktowe części zawierają wariacje melodii, bas, perkusję,
akordy i arpeggio. Ograniczone harmoniczne łagodzą brzmienie; ogony dźwięków
zawijają się przez granicę pętli. Utwór korzysta z obecnej regulacji, cache audio
i przejścia menu–walka; odtwarzanie wymaga gestu użytkownika.

Odtworzenie wyłącznie menu i jego metadanych:

```powershell
python scripts/fighter/build_cabinet_menu.py
```

Wymaga NumPy; nie korzysta z sieci, sampli, kluczy ani płatnych usług. Własne stałe
ziarno losowości zapewnia powtarzalność. Pełny generator
`scripts/fighter/build-arcade-audio.py` wywołuje również tę kompozycję, zachowując
poprzednią sekwencję losową muzyki walki i efektów.

## Walidacja i ograniczenia

Testy obejmują brak informacji o czasach ciosów dla wszystkich 16 postaci,
zachowanie instrukcji ruchów i kosztów energii, kontrakt elementów menu oraz
poprawność plików WAV. Porównanie SHA-256 przed i po obu generatorach potwierdza
identyczny wynik oraz niezmienione 31 plików muzyki walki i efektów.

Wyniki lokalne: `ci:code` PASS (195 plików / 1831 testów oraz 6 testów narzędzi),
`ci:assets` PASS (241 zasobów, 16 rigów, sektory mgły), build produkcyjny PASS,
walidacja animacji PASS (16 postaci, 272 klipy, 1632 klatki). Niezależny review
nie wykazał problemów blokujących.

Podgląd przeglądarki był wcześniej zablokowany; nie obchodzono tej blokady.
Nie potwierdzono wizualnie działania nowego układu ani nie odsłuchano kompozycji.

- `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`
- `AUDIO_PLAYBACK_VERIFICATION_PENDING_HUMAN`

Do sprawdzenia ręcznie: komputer, telefon 360 × 800 i 844 × 390, przewijanie,
Tab/Shift+Tab oraz Enter/Spacja na rozwijanych panelach, wybór obu postaci,
trzy tryby, lobby/link zaproszenia, arena, start, pauza i powrót, suwaki oraz
płynność pętli audio. W online menu nie zatrzymuje pojedynku.

Wydanie nie zmienia backendu. Dostępność produkcyjnego online nadal zależy od
aktualizacji istniejącego serwera do protokołu bijatyki 2, opisanej w
[instrukcji online](fighter-online-release.md).
