# Aktualizacja własnego serwera

Samo `git pull` zmienia pliki na dysku, ale nie restartuje działającego serwera Socket.IO. Repozytorium uruchamia backend przez `npm run server` (`tsx server/roomServer.ts`), bez automatycznego obserwowania zmian. CI publikuje frontend na GitHub Pages po zmianach `main`; nie znaleziono konfiguracji wdrażania backendu ani konkretnej nazwy usługi na prywatnym serwerze.

Po opublikowaniu i review zmian, na właściwej gałęzi serwera:

```sh
git pull --ff-only
npm ci
```

Następnie zrestartować istniejący proces za pomocą używanego menedżera (PM2, systemd, Docker albo ręczne zatrzymanie i ponowne `npm run server`). Restart rozłączy aktualnych graczy. `tsx` jest w devDependencies, więc przy obecnym sposobie startu nie stosować `npm ci --omit=dev`.

Jeżeli ta maszyna hostuje również frontend, wykonać `npm run build` i opublikować/serwować aktualne `dist/` zgodnie z konfiguracją hostingu. Zmienne `VITE_*` są uwzględniane przy buildzie, nie przy późniejszym restarcie backendu. Nie publikować `.env`.

Backend Socket.IO nie potrzebuje modeli ani tekstur klienta. Na serwerze przeznaczonym wyłącznie dla backendu można wykonać w powłoce POSIX `GIT_LFS_SKIP_SMUDGE=1 git pull --ff-only`, aby nie pobierać dużych assetów. Nie stosować tego na maszynie budującej frontend bez późniejszego pobrania potrzebnych obiektów LFS.

Zmiany lokalne na `feat/festival-next`, które nie zostały jeszcze opublikowane, nie pojawią się na serwerze przez `git pull`. Potrzebna jest publikacja po walidacji i review zgodnie z zasadami repozytorium.

`.gitignore` blokuje dodawanie nowych lokalnych projektów Blender, backupów, referencji i stagingu; nie usuwa już śledzonych plików ani obiektów z historii LFS i nie zwraca wykorzystanego transferu. Runtime `public/game-assets/` pozostaje wersjonowany, a używane przez testy i pipeline źródłowe riggi nie zostały wyłączone hurtowo.
