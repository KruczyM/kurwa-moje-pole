# Wydanie bijatyki arcade i prywatnych pojedynków

Menu festiwalu otwiera `fighter-demo.html` bez uruchamiania świata 3D. Gra ma własny wygląd arcade, wybór postaci i areny oraz tryby: z botem, trening i online ze znajomym. Wersja online obsługuje dwa urządzenia, link lub kod zaproszenia, niezależny wybór postaci, gotowość obu graczy i rewanż za obopólną zgodą.

Serwer używa osobnej przestrzeni Socket.IO `/fighter`. Prowadzi istniejącą symulację walki w 60 krokach/s i wysyła stan 20 razy/s. Klient interpoluje pozycje we własnej, istniejącej pętli renderowania. Trafienia, blok, wybicie, supermoce, rundy i wynik rozstrzyga serwer. Krótkie naciśnięcia są kolejkowane; sekwencje odrzucają powtórzenia sterowania i efektów. Walidacja obejmuje uczestnictwo, postacie, areny i limity wiadomości.

Rozłączenie lub odświeżenie zamraża sesję na maksymalnie 20 sekund. Powrót w tej samej karcie odzyskuje miejsce zapisanym tokenem. Token nie trafia do linku zaproszenia. Wznowienie walki ma nowe trzysekundowe odliczanie. Przekroczenie terminu lub celowe wyjście kończy sesję bez przyznawania zwycięstwa. Menu podczas walki online nie zatrzymuje przeciwnika, a utrata fokusu zeruje sterowanie.

## Walidacja

- `npm run ci:code`: 191 plików testów, 1800 testów; formatowanie, lint, typecheck i 6 testów narzędzi.
- `npm run ci:assets`: 241 zasobów, 16 rigów, sektory mgły i obszary mobilne; bez błędów.
- `npm run build`: wszystkie cztery strony, w tym bijatyka, z bazą `/kurwa-moje-pole/`.
- `python scripts/fighter/validate-illustrated-combat.py`: 16 postaci, 272 animacje, 1632 klatki.
- `python scripts/fighter/test-illustrated-packing.py`: 2 testy pakowania.
- `python scripts/fighter/validate-combat-powers.py`: 16 postaci, 64 klipy, 384 klatki. Kontrolę źródeł wykonano w zachowanym worktree `fighter-demo`, ponieważ źródłowe ilustracje `art/` nie są publikowanymi zasobami runtime.

Testy obejmują rzeczywistych dwóch klientów Socket.IO, zgodność snapshotów, pełny pokój, izolację od festiwalu, własność wyboru areny, tę samą postać, gotowość, krótkie naciśnięcia, trafienie, blok, wybicie, błędne/powtórzone wejście, limity wiadomości, rewanż, zerwanie i odzyskanie połączenia, samotnego gospodarza oraz ramkę odebraną przed potwierdzeniem członkostwa.

Niezależne review kodu zakończone: poprawiono wznowienie samotnego gospodarza, zablokowano zmianę zawodników podczas wznowienia starej symulacji, wyzerowano tożsamość prezentacji między pokojami oraz odróżniono odświeżenie strony od celowego opuszczenia pokoju. Końcowy przegląd nie wykazał dalszych problemów blokujących publikację w sprawdzonym zakresie.

`VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`: podgląd przeglądarki był zablokowany; nie potwierdzono wyglądu ani rozgrywki na komputerze i telefonie. Skrypty przeglądarkowe dostosowano do nowego wyboru trybu, ale ich nie uruchomiono. Po wdrożeniu należy sprawdzić menu, dotyk, fokus, przewijanie, odliczanie, animacje i cały pojedynek dwóch urządzeń.

## Aktualizacja backendu — wykonuje właściciel serwera

Frontend GitHub Pages aktualizuje się automatycznie po scaleniu. Backend `https://kmp.aleksanderkruk.site` wymaga osobnej aktualizacji. W katalogu istniejącej instalacji backendu, przy czystym checkoutcie gałęzi `main`, wykonać w powłoce POSIX:

```sh
git status --short
git branch --show-current
git fetch origin main
GIT_LFS_SKIP_SMUDGE=1 git pull --ff-only origin main
npm ci --include=dev
```

Jeśli checkout zawiera lokalne zmiany lub inną gałąź, najpierw zachować je i przygotować właściwy checkout; nie resetować ich. Backend nie potrzebuje obrazów LFS. `tsx` znajduje się w devDependencies i jest wymagany przez `npm run server`.

Następnie zrestartować **istniejącą** usługę tym samym menedżerem procesu. Dla systemd: `sudo systemctl restart <rzeczywista-nazwa-usługi>`; dla PM2: `pm2 restart <rzeczywista-nazwa-procesu>`. Nazwa procesu nie jest zapisana w repozytorium. Przy uruchomieniu ręcznym zatrzymać poprzedni proces i uruchomić `npm run server` z dotychczasowymi `PORT` i `CORS_ORIGIN`. Restart rozłączy bieżące sesje festiwalu.

Proxy musi przekazywać istniejącą ścieżkę `/socket.io/`, w tym upgrade WebSocket. `/fighter` jest przestrzenią Socket.IO, a nie oddzielną ścieżką proxy. Zachować obecny adres i konfigurację CORS. Frontend ma już skonfigurowaną zmienną repozytorium `VITE_SERVER_URL` na ten backend.

```sh
curl --fail https://kmp.aleksanderkruk.site/health
```

Odpowiedź zaktualizowanego serwera zawiera `"fighterProtocol":2` oraz `"status":"ok"`. Sam pozytywny healthcheck nie potwierdza rozgrywki. Otworzyć bijatykę na dwóch urządzeniach, utworzyć pokój, dołączyć kodem, potwierdzić postacie i rozegrać mecz z rewanżem; przetestować krótki zanik sieci i powrót. **PRODUCTION_ONLINE_VERIFICATION_PENDING_BACKEND_UPDATE** pozostaje aktualny do wykonania aktualizacji i udanego pojedynku dwóch klientów na opublikowanej stronie.

Wcześniejsze prace pozostają zachowane na `feat/fighter-demo`; wydanie przygotowano osobno na `feat/fighter-menu-release` z aktualnego `main`.
