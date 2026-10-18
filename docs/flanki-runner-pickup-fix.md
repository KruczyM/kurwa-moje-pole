# Flanki — przytrzymanie akcji podnoszenia puszki

Gałąź: `fix/flanki-runner-can-pickup`, z aktualnego `origin/main` (`bcb64c1`), osobny worktree `.ai/worktrees/flanki-runner-can-pickup`.

Wcześniej naciśnięcie E / mobilnego UŻYJ wywoływało pojedynczą próbę postawienia puszki. Naciśnięcie przed wejściem w zasięg 1,4 m nie ponawiało próby podczas dalszego podejścia. Teraz akcja pozostaje aktywna do puszczenia przycisku i jest sprawdzana po aktualizacji pozycji biegacza. Zwykłe naciśnięcie w zasięgu nadal działa.

Pozostają istniejące ograniczenia roli, fazy i odległości oraz walidacja hosta. Klient sieciowy wysyła ponowienie razem z istniejącym, ograniczonym do 10 Hz ruchem; nie dodano timera ani pętli. Puszczenie E, pointercancel, utrata fokusu, pauza, start/koniec meczu i STOP anulują przytrzymanie. Biegacz nie zaczyna pić. Po postawieniu musi wrócić za linię.

Walidacja: 58 testów w 11 plikach (Flanki, serwer Flanek i MobileControls), TypeScript, ESLint i formatowanie. Nowe regresje sprawdzają przytrzymanie przed podejściem, puszczenie przed wejściem w zasięg, naciśnięcie w zasięgu, powrót/STOP i reset meczu. Dotychczasowe testy blokady odległego podniesienia i teleportu klienta pozostają zielone.

Przeglądarka: `python scripts/verify-flanki-runner-pickup.py`, serwer Vite :5243. Chromium i WebKit — prawdziwe zdarzenia klawiatury oraz pointerdown/up mobilnego UŻYJ przez istniejące Game.key / MobileControls i FlankiGame. Cztery przypadki PASS, bez błędów JS. Raport: `reports/flanki-runner-pickup/browser-report.json`. Fixture izoluje system od ładowania całego festiwalu; pozycja podejścia jest ustawiana testowo. Nie jest to pełne przejście świata ani próba na fizycznym telefonie: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` dla takiego odbioru.

Bez push, PR ani merge. Integracja/publikacja wymaga niezależnego review i orkiestratora zgodnie z AGENTS.md.
