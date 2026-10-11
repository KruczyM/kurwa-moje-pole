# Świat na urządzeniach mobilnych

Na telefonie mgła jest wyłączona, kamera ma zasięg 500 m i wyświetla się skybox.
Istniejący streamer ładuje przy starcie wszystkie sektory poza północnym rzędem
obozów N1 za północnym pasażem. Dodatkowy tłum nadal pozostaje wyłączony.

Reguły znajdują się w `src/game/world/mobileWorldStreaming.ts`:

- `CAMP_LOAD_DISTANCE = 48` — odległość od granicy sektora, przy której zaczyna się ładowanie.
- `CAMP_RETAIN_DISTANCE = 80` — odległość zwalniania sektora po odejściu; różnica zapobiega ciągłemu przeładowywaniu.
- `CAMP_SECTOR_MARGIN = 16` — margines kwalifikacji sektorów przy działkach N1.

Aktualny manifest ma 207 sektorów: 159 pozostaje w pamięci, a 48 jest doczytywanych.
Podział jest sektorowy, więc rekwizyty współdzielące sektor z obozem są doczytywane razem.
Drogi i geometria obejmująca cały świat nie są odkładane. Obiekty poza widokiem
kamery nadal korzystają ze standardowego frustum cullingu Three.js.

`FogSectorStreamer.ts` zachowuje pojedynczą kolejkę i sprzątanie zasobów.
`Game.ts` wybiera profil mobilny i ukrywa nieaktualny suwak mgły.
`AssetLoader.ts` oraz `CampWorld.ts` przywracają skybox dla tego profilu.
Na komputerze można sprawdzić profil przez `?mobileWorld=1`; domyślny profil desktopowy pozostaje bez zmian.

## Weryfikacja

Testy deterministyczne: `src/game/world/mobileWorldStreaming.test.ts`.
Skrypt przeglądarkowy: `python scripts/verify-mobile-open-world.py` (Chromium i WebKit,
lokalny klient na 5186 i serwer na 3106). Raporty oraz zrzuty trafiają do
ignorowanego `reports/mobile-open-world/`.

Emulacja telefonu sprawdza brak mgły, skybox, doczytywanie, zwalnianie sektorów
i dostępność menu. Nie potwierdza wydajności fizycznego telefonu.
Większy zakres ładowania zwiększa zużycie pamięci i liczbę renderowanych obiektów.
Pomiar FPS, pamięci i temperatury na docelowym telefonie pozostaje do wykonania:
`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN` dla fizycznego urządzenia.
