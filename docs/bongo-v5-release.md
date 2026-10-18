# Publikacja Bongo Rush v5

Integracja na `7c79845` zachowuje opublikowane zmiany bijatyki z PR #124.
Przeniesiono kolejno `9333f48`, `5a3f021`, `4c6c65e`: kampania,
24 plansze i nowe atlasy, następnie wykluwanie Kobry.

Niezależny review wykrył pomijanie fizyki komór w kroku teleportacji.
Poprawka wykonuje fizykę celu oraz wszystkich pozostałych komór dokładnie raz;
test regresyjny sprawdza grawitację podczas wejścia, powrót i wzrost kolonii.
Ponowny review: PASS, bez dalszych blokerów. Zmiany bijatyki, menu i serwera
pozostały niezmienione względem bazy integracji.

Walidacja integracji: `ci:code` PASS (206 plików, 1950 testów jednostkowych
oraz 6 testów narzędzi), `ci:assets` PASS, produkcyjny build czterech stron PASS.
Audyt po poprawce: 24 zwycięskie trasy oraz 24 celowo błędne sekwencje.
Raporty autora obejmują przejścia wszystkich plansz w Chromium i WebKit,
animację wykluwania oraz pauzę. Raporty lokalne integracji znajdują się w
ignorowanym katalogu `reports/`.

Wyniki WebKit nie potwierdzają płynności na fizycznym telefonie; wcześniejsze
pomiary wykazują skoki czasu klatek. Odbiór wygody, atrakcyjności, odsłuchu
i płynności na fizycznym urządzeniu pozostaje `PENDING_HUMAN`.
Historia lokalnych raportów w dokumentach v4/v5 opisuje stan przed publikacją.
