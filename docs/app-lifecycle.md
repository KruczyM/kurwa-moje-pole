# Lifecycle aplikacji

Jedynym źródłem prawdy o aktywnym ekranie jest `AppStateMachine`. Aplikacja
używa stanów `start`, `loading`, `playing`, `inspecting`, `dialog`, `inventory`,
`paused` i `error`. Nie należy otwierać modali przez bezpośrednią zmianę
atrybutu `hidden`; widoczność interfejsu jest skutkiem przejścia stanu.

## Escape i Pointer Lock

Priorytet klawisza `Escape` jest stały:

1. inspekcja, dialog lub ekwipunek wracają do `playing`;
2. w `playing` klawisz przechodzi do `paused`;
3. w `paused` kolejne, osobne naciśnięcie `Escape` wraca do głównego ekranu wyboru postaci;
4. przycisk „Wróć do gry” w menu pauzy wznawia rozgrywkę.

Utrata Pointer Lock w stanie `playing` również przełącza grę do `paused`.
Programowe wyjście z Pointer Lock po otwarciu modala nie otwiera pauzy, ponieważ
automat znajduje się już w stanie modala.

`Escape` zamykający preview/inspekcję jest konsumowany w całości. Powtórzone
zdarzenie klawisza jest ignorowane, a utrata Pointer Lock wywołana przez to samo
naciśnięcie ma krótki okres ochronny. Dopiero następne świadome naciśnięcie
`Escape` może otworzyć menu pauzy.

## Własność zasobów

Każda instancja `Game` ma dokładnie:

- jedną pętlę `requestAnimationFrame`;
- jeden `EventScope` dla listenerów okna i dokumentu;
- jeden renderer główny oraz opcjonalny renderer inspekcji;
- jeden timeout komunikatu `toast`.

`Game.dispose()` anuluje RAF i timeout, usuwa listenery, zatrzymuje animatory i
audio, zwalnia postprocessing, trawę, geometrie, materiały, tekstury oraz oba
renderery. `dispose()` jest idempotentne. Ponowna próba po błędzie zawsze usuwa
poprzednią instancję przed utworzeniem nowej.

Renderer inspekcji jest tworzony tylko raz i ponownie używany. Zamknięcie
preview ukrywa modal natychmiast, bez synchronicznego niszczenia kontekstu WebGL.
Pełne zwolnienie kontekstu następuje dopiero w `Game.dispose()`.

## Obsługa błędów

Błąd WebGL lub ładowania przechodzi do `error`. Ekran błędu zachowuje działające
przyciski ponowienia oraz powrotu do wyboru postaci. Powrót odtwarza przezroczysty
podgląd, a ponowienie tworzy nową, czystą instancję gry.

## Dodawanie nowego modala

1. Dodaj stan i dozwolone przejścia w `AppStateMachine.ts`.
2. Dodaj widoczność sekcji w `Game.syncState()`.
3. Określ zachowanie `Escape` w `escapeTarget()`.
4. Nie dodawaj osobnego globalnego listenera klawiatury.
5. Dodaj test poprawnego przejścia i niedozwolonych konfliktów.
