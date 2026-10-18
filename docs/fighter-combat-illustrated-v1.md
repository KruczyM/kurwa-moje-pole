# Animacje walki — ilustracje v1

Przygotowano i podłączono 256 animacji dla wszystkich 16 grywalnych postaci: po 12 ataków, dwa bloki i dwie reakcje na trafienie. Każdy klip zawiera sześć klatek, łącznie 1536 klatek. Dodatkowo wyeksportowano statyczne pozy gotowości i kucania z nowych ilustracji.

Praca znajduje się w worktree `.ai/worktrees/fighter-demo`, branch `feat/fighter-demo`. Nie wykonano push, PR ani merge. Zachowano wcześniejsze lokalne zmiany ekranu wyboru postaci.

## Zawartość

| Ruch symulacji               | Klip                       |
| ---------------------------- | -------------------------- |
| light_punch / heavy_punch    | jab / cross                |
| light_kick / heavy_kick      | kick / heavy_kick          |
| uppercut / sweep             | uppercut / sweep           |
| crouch_punch / crouch_kick   | crouch_punch / crouch_kick |
| jump_punch / jump_kick       | jump_punch / air_kick      |
| special / ultimate           | special / ultimate         |
| block_high / block_low       | block / block_low          |
| hit_stun: high / mid lub low | hit_head / hit_body        |

Postacie: Amper, Korba, Klątwa, Chlebak, Kobra, Zawór, Szerszeń, Dziąsło, Hemoroid, Jęczmień, Ambona, Antena, Gruczoł, Krwiak, Pień, Pierścień.

Runtime: `public/game-assets/2d/fighter/combat-illustrated-v1/{id}/`. Na postać przypada 18 pasków PNG RGBA, 1536 × 256 px; manifest zawiera dodatkowo odwołania do istniejących klipów walk, fall i get_up wraz z ich geometrią. Ich odnowienie nie należało do zakresu uderzeń i obrony. Cały nowy zestaw PNG zajmuje 46,15 MiB. Dekodowane obrazy utrzymuje dotychczasowy CombatSpriteBank tylko dla aktywnych zawodników; zmiana wyboru usuwa stare obrazy i anuluje oczekujące żądania.

Nie dodano renderera, kontrolera ani pętli requestAnimationFrame. Ataki nadal korzystają z ticków symulacji: klatki 0–1 odpowiadają startup, 2–3 active, 4–5 recovery. Granica active jest zgodna z CombatResolver: startup < moveTick <= startup + active. Blok natychmiast utrzymuje klatkę osłony 2, również gdy symulacja zeruje stateTicks podczas trzymania przycisku. Reakcja na trafienie rozpoczyna się od klatki 2 i nie zapętla się. Kierunek nowych ilustracji jest prawy, a odbicie dla drugiego zawodnika wykonuje istniejący FighterView. Efekty ruchów specjalnych i obrażenia pozostają w swoich istniejących systemach.

## Źródła i odtwarzanie eksportu

71 wygenerowanych arkuszy, w tym siedem poprawek, zapisano lokalnie w `art/fighter/combat-illustrated-v1/`. Ostatni wpis dla pary id/pack jest używany do eksportu. Źródła są objęte istniejącym ignorowaniem katalogu art; gotowe assety runtime oraz prompty są plikami projektu. Wersjonowany rejestr promptów: [fighter-combat-generation.json](fighter-combat-generation.json). Wbudowane image_gen, bez kluczy API i zewnętrznych płatnych usług.

Eksporter rozpoznaje połączone sylwetki po kanale alfa, izoluje postacie i zachowuje wspólną skalę w arkuszu. Nie ucina kończyn na nominalnych liniach siatki. Stała skala świata kompensuje marginesy potrzebne przy wydłużonych kończynach. Pozycje stóp są wyrównane do pivotu. Źródła pozostają niezmienione. `packing.json` zapisuje SHA-256 źródeł, skale i prostokąty wycięcia.

Wymagania narzędzi eksportu: Python, Pillow, numpy. W katalogu worktree:

```powershell
python scripts/fighter/audit-illustrated-sources.py
python scripts/fighter/pack-illustrated-combat.py
python scripts/fighter/test-illustrated-packing.py
python scripts/fighter/validate-illustrated-combat.py
npm run test:unit -- src/games/fighter
npm run build
```

## Wyniki walidacji

- Audyt 64 wybranych arkuszy: PASS, bez brakujących sylwetek lub obcięcia na krawędzi źródła.
- Walidacja 256 klipów / 1536 klatek: PASS. Sprawdzono rozmiary, przezroczystość, marginesy, niepuste klatki, różne sylwetki i odwołania do starszych klipów.
- Dwa deterministyczne testy eksportera: PASS, w tym nierówna siatka i odrzucenie brakującego rzędu.
- 55 testów minigry: PASS. Obejmują cały roster, granice startup/active/recovery, utrzymanie gardy, reakcje, obecność assetów, cache, anulowanie i fallback.
- Build: PASS. Istniejące ostrzeżenie Vite o dużym bundlu głównej gry.
- Lint zmienionego kodu animacji: PASS. Pełny lint zgłasza cztery istniejące błędy: nieużywane themeColor/glowColor/description w roster.ts i _rate w FighterAudio.test.ts. Tych plików nie zmieniano.
- Wyeksportowane podglądy obejrzano lokalnie: wszystkie postacie, gotowość, cross, heavy_kick i block_low. To kontrola assetów, nie test rozgrywki.

**VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN**

Test przeglądarkowy nie został wykonany. Środowisko odmówiło dostępu do gniazda lokalnego, a kontrola uprawnień wbudowanej przeglądarki odrzuciła otwarcie adresu lokalnego. Po odmowie nie podejmowano obejścia. Lokalne raporty i dwa arkusze porównawcze są w `reports/fighter-combat-illustrated-v1/`.

Po udostępnieniu lokalnej przeglądarki uruchom Vite na porcie 5183 i `python scripts/fighter/verify-illustrated-combat-browser.py`. Skrypt używa rzeczywistego FighterDemo i jego istniejącego canvasu, sprawdza trzy fazy każdego ataku oraz obronę/reakcje dla 16 postaci, odbicie i sterowanie. Raport wymaga uzupełnienia testem płynności, stóp, zasięgu względem hitboxów, przejść do starszych klipów chodzenia/upadku oraz unikalnych efektów special/ultimate podczas normalnej gry, także na telefonie.
