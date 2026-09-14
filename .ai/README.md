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
- Antigravity IDE `1.107.0` i rozszerzenie `google-antigravity 1.3.0`;
- brak headless `agy` w `PATH`.

Zainstalowane `antigravity-ide chat` otwiera sesję IDE, lecz nie udostępnia w tej wersji headless JSON/stream-JSON ani wskazania pliku wyniku. Nie jest więc bezpiecznym adapterem automatycznym. Antigravity SDK nie został zainstalowany, ponieważ nie potwierdzono pracy SDK na limicie subskrypcyjnym bez `GEMINI_API_KEY`.

Po zainstalowaniu oficjalnego headless CLI należy najpierw sprawdzić jego lokalne `--help`, potwierdzić logowanie kontem Google i wyłączony overage, a dopiero potem wpisać dokładne argumenty w `pipeline.config.json`. Adapter rozpoznaje placeholdery `{cwd}`, `{schema}` i `{output}`. Treść Issue/prompt zawsze płynie przez stdin i nigdy nie trafia do polecenia shell. Pipeline celowo nie wpisuje domniemanych, potencjalnie przestarzałych komend Antigravity.

## Komendy

```powershell
npm run ai:dry-run   # bez AI, branchy i serwera; pokazuje plan i provider status
npm run ai:one       # przetwarza pierwsze Issue ai-ready
npm run ai:start     # obecnie również maksymalnie jedno Issue na uruchomienie
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
4. Antigravity jest preferowany tylko przy poprawnym headless CLI i potwierdzonej subskrypcji. W obecnym środowisku wybierany jest Codex ChatGPT.
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

1. Obecny Antigravity IDE nie ma automatyzowalnego headless JSON, dlatego implementacja przechodzi na Codex ChatGPT, a wizualny test runtime wymaga człowieka.
2. Pipeline nie instaluje automatycznie Playwright ani innej przeglądarki; używa tylko narzędzia istniejącego w repozytorium.
3. Stan wznawia fazę i worktree, ale po nieoczekiwanym przerwaniu w środku pojedynczej komendy może bezpiecznie powtórzyć tę komendę.
4. Timeout nie jest dowodem wyczerpania quota — klasyfikacja opiera się na rzeczywistym komunikacie CLI.
5. Nie ma pixel-perfect automatycznej akceptacji zmian artystycznych.
