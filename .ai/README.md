# Lokalny pipeline AI — wyłącznie w ramach subskrypcji

Pipeline obsługuje po jednym GitHub Issue z etykietą `ai-ready`. Implementacja odbywa się w osobnym branchu i worktree, po czym kod przechodzi prawdziwe polecenia projektu, uruchomienie gry, kontrolę browser/WebGL oraz niezależny review. Wynikiem może być PR do ręcznego sprawdzenia; pipeline nigdy sam go nie scala.

## Bez kosztów dodatkowych

`assertSubscriptionOnlyMode()` blokuje konfigurację dopuszczającą płatne API, kredyty lub auto-merge. Dla wszystkich procesów AI usuwane są z lokalnej kopii środowiska:

- `OPENAI_API_KEY`;
- `GEMINI_API_KEY`;
- `GOOGLE_API_KEY`.

Zmienne na komputerze użytkownika nie są kasowane. Ich obecność jest raportowana wyłącznie po nazwie. Pipeline nie używa OpenAI API, Gemini API, AI Studio, Vertex AI ani pay-as-you-go. W ustawieniach konta Antigravity trzeba ręcznie ustawić paid overage / AI credit fallback na **NEVER**. Pipeline nie zmienia ustawień billing.

Codex jest dopuszczany tylko wtedy, gdy `codex login status` zawiera `Logged in using ChatGPT`. Gdy oba źródła subskrypcyjne są niedostępne lub wyczerpane, stan zmienia się na `BLOCKED`, a worktree, logi i stan pozostają na dysku.

## Stan wykryty 14 września 2026

- Node.js `22.20.0`, npm `10.9.3`;
- Git `2.49.0`, GitHub CLI `2.87.3`;
- Codex CLI `0.104.0`, zalogowany przez ChatGPT;
- Antigravity CLI `agy 1.2.2`, zalogowany kontem Google z aktywnym limitem Gemini;
- `agy /usage`: 100% pozostałego limitu tygodniowego i pięciogodzinnego w chwili konfiguracji;

Oficjalny program znajduje się domyślnie w `%LOCALAPPDATA%\agy\bin\agy.exe`. Instalator dopisał katalog do PATH użytkownika; nowe terminale znajdą komendę `agy` bez pełnej ścieżki. Pipeline wykrywa również tę domyślną lokalizację, dlatego ponowne uruchomienie terminala nie jest dla niego wymagane.

Adapter używa oficjalnego trybu headless `stream-json`: prompt trafia jako NDJSON przez stdin, wynik końcowy jest wymuszany schematem i odczytywany z `structured_output`. Implementacja używa `gemini-3.1-pro-high`, a kontrola przeglądarkowa szybszego `gemini-3.8-flash-medium`. Oba procesy działają z `--sandbox`; pipeline celowo nie używa `--dangerously-skip-permissions`. Antigravity SDK ani `GEMINI_API_KEY` nie są potrzebne.

Przed pierwszym rzeczywistym zadaniem sprawdź ręcznie w ustawieniach Antigravity lub selektorze modeli, że **AI Credit Overages** są ustawione na **Never**. Tego ustawienia billingowego pipeline nie zmienia. Samo sprawdzenie logowania i quota:

```powershell
agy -p /usage --output-format json
```

## Komendy

```powershell
npm run ai:dry-run   # bez AI, branchy i serwera; pokazuje plan i provider status
npm run ai:one       # przetwarza pierwsze Issue ai-ready
npm run ai:start     # kolejne Issue ai-ready aż kolejka będzie pusta lub zadanie się zablokuje
npm run ai:continue  # wznawia Issue zapisane w state.json
npm run ai:status    # pokazuje trwały stan
npm run ai:reset     # usuwa tylko state.json, nie branche/worktree/zmiany
npm run test:ai      # mockowe testy orkiestratora, bez wywołań AI
```

Te same akcje są w `.vscode/tasks.json` pod prefiksem `AI:`.

## Pełny cykl jednego Issue

1. GitHub zwraca najstarsze otwarte Issue z etykietą `ai-ready`.
2. Quality gate wymaga celu/kontekstu oraz oczekiwanego zachowania lub kryteriów akceptacji. Braki dają `NEEDS_HUMAN_CLARIFICATION`.
3. Powstaje `ai/<numer>-<slug>` i `.ai/worktrees/issue-<numer>`. Nie ma pracy na `main`.
4. Antigravity Headless jest preferowany przy dostępnym limicie subskrypcji. Codex ChatGPT pozostaje bezpłatnym fallbackiem przy awarii, rate limit albo wyczerpaniu quota.
5. Implementer dostaje Issue, kryteria, `AGENTS.md`, zasady Three.js i worktree. Issue jest oznaczone jako niezaufane dane.
6. Orkiestrator wykonuje kolejno format check, lint, typecheck, testy/asset/rig i build. Rejestruje exit code, stdout, stderr oraz czas.
7. Dla zmian runtime startuje `npm run dev`, czeka na `http://localhost:5173/`, zapisuje PID i bezpiecznie kończy całe znane drzewo procesów.
8. Antigravity Browser otrzymuje scenariusz konkretnego Issue i localhost-only. Raport sprawdza canvas, WebGL, render, konsolę, assety oraz przepływ użytkownika. Screenshoty trafiają do `.ai/artifacts/issue-N/`; wideo jest wymagane tylko dla zachowania czasowego.
9. Jeśli Browser Agent jest niedostępny, pipeline wykrywa istniejący Playwright/Cypress/Puppeteer. Gdy go nie ma, zapisuje `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` — nigdy fałszywy PASS.
10. Świeży, niepowiązany proces Codex w sandboxie read-only dostaje diff, Issue, wyniki komend i raport runtime. Sprawdza również render loop, delta time, resize, GLTF, miksery, cleanup, raycast, shadery, post-processing i networking.
11. `CHANGES_REQUIRED`, błąd testów lub browsera wraca jako konkretna lista poprawek. Po poprawce powtarzane są komendy, test gry i świeży review. Limity prób chronią quota.
12. Po `PASS` orkiestrator commituje branch, wykonuje push i tworzy/aktualizuje PR z dowodami. Nie wykonuje merge.

## Weryfikacja gry Three.js

Raport browsera obejmuje zależnie od Issue:

- istnienie canvas i kontekstu WebGL, render sceny, RAF, brak context lost/shader errors/black screen;
- 404 i błędy GLB, tekstur, skyboxów, dźwięków oraz modułów;
- widoczność, skalę, pozycję, orientację, PBR, przezroczystość i animacje modeli;
- przejścia Idle/Walk/Run, crossfade, blokowanie/odblokowanie ruchu i `AnimationMixer`;
- WASD, ruch ukośny, kolizje, granice i niezależność od FPS;
- kamerę, Pointer Lock, resize, raycast/interakcje i podgląd przedmiotów;
- kolejność EffectComposer/passów, shadery, uniformy i włączanie/wyłączanie efektów;
- oczywiste spadki płynności, spam, powtarzane requesty i duplikowane obiekty;
- cleanup po wielokrotnym otwarciu/zamknięciu UI;
- połączenie Socket.IO, stan gracza zdalnego i — dla Issue sieciowego — dwa klienty, o ile narzędzie na to pozwala;
- audio po interakcji, z osobnym oznaczeniem polityki autoplay.

Subiektywna jakość grafiki, nastrój światła i proporcje artystyczne są dokumentowane screenshotem, ale pozostają do decyzji człowieka.

## Stan, logi i bezpieczeństwo procesów

Stan jest zapisywany atomowo w `.ai/runtime/state.json`: Issue, faza, branch, worktree, provider, wyniki, PID serwera, raport browsera, review, próby, PR, timestamps i ostatni błąd. Blokada `.ai/runtime/pipeline.lock` (PID + timestamp) nie pozwala dwóm orkiestratorom sterować repozytorium. Martwa blokada jest bezpiecznie zastępowana.

Logi są w `.ai/logs/issue-N/`, a obrazy/wideo w `.ai/artifacts/issue-N/`. Pipeline nie zapisuje credentiali. Nie wykonuje hard reset, force push, usuwania niepowiązanych plików ani kasowania nieudanych worktree. `Ctrl+C`, timeout i zwykłe zakończenie sprzątają wyłącznie procesy uruchomione przez pipeline.

## Remote Control

Remote Control może służyć wyłącznie do opcjonalnego podglądu sesji Antigravity. Nie jest silnikiem testowym i pipeline od niego nie zależy. Nie wystawia localhost publicznie, nie używa prywatnego profilu przeglądarki i nie przyznaje dostępu do arbitralnych domen.

## Ograniczenia

1. Antigravity Headless może automatyzować implementację i zwracać raport JSON. Rzeczywiste możliwości sterowania przeglądarką nadal zależą od narzędzi udostępnionych agentowi w danej wersji CLI; brak narzędzia daje jawne oczekiwanie na test człowieka, nie fałszywy PASS.
2. Pipeline nie instaluje automatycznie Playwright ani innej przeglądarki; używa tylko narzędzia istniejącego w repozytorium.
3. Stan wznawia fazę i worktree, ale po nieoczekiwanym przerwaniu w środku pojedynczej komendy może bezpiecznie powtórzyć tę komendę.
4. Timeout nie jest dowodem wyczerpania quota — klasyfikacja opiera się na rzeczywistym komunikacie CLI.
5. Nie ma pixel-perfect automatycznej akceptacji zmian artystycznych.
