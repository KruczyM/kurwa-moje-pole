# Bongo Rush: spójność interfejsu

Branch: `fix/bongo-ui-consistency`, baza `bcb64c1f4651c59c46d3a6c7fb1b5ea9d4f2d786`.

Przed zmianami wygenerowano trzy koncepcje: Ciepłe ruiny, Kamienny atlas, Lekka oprawa. Wobec braku odpowiedzi na opcjonalny wybór zastosowano polecone Ciepłe ruiny, zachowując istniejące sceny wybranych postaci. Nowe podglądy koncepcyjne nie są assetami runtime.

Usunięto branding AFTER oraz oba odnośniki do after-demo.html. Wspólna ciepła paleta, typografia, ramki i przyciski obejmują nagłówek, HUD, wybór map, postaci, pauzę, wyniki i ustawienia. Dodano bezpośredni powrót do menu głównego z pauzy, wyniku i zakończenia kampanii. Powrót zachowuje bohatera i zapisane postępy.

Szata Standardowa pokazuje tylko Standardowe znajdźki; Artystyczna pokazuje Zestaw 1 i Zestaw 2 z rzeczywistymi podglądami. Wartości zapisu festival/fantasy pozostają zgodne z istniejącymi zapisami.

## Walidacja

- TypeScript, ESLint zmienionych plików, Prettier i git diff --check: PASS.
- Testy Bongo Rush: 46 plików, 717 testów PASS.
- Produkcyjny build: PASS (istniejące ostrzeżenie dużego bundla głównej gry 3D).
- `python scripts/bongo-v6/verify-ui-consistency.py`: Chromium i WebKit PASS; 1280×800, 390×844, 320×568, 844×390. Rzeczywiste kliknięcia: wybór poziomu, start, pauza, powrót na tytuł, przełączanie i zapis szaty oraz znajdziek. Zachowana postać, brak błędów pageerror, brak poziomego overflow, aktywny istniejący RAF. Pauza zatrzymuje kroki symulacji.
- Zrzuty i JSON: lokalny katalog reports/bongo-ui-consistency. Obejrzano desktopowy wybór poziomów i mobilną pauzę; kontrast opisu zaznaczonej mapy dodatkowo poprawiono.
- Pierwsze uruchomienie szerokich testów wykryło nieodtworzone obiekty Git LFS w nowym worktree. Odtworzono oryginalne pliki bez zmian ich zawartości, a testy następnie przeszły.
- Fizyczny telefon: nie testowano. Testy rozmiarów ekranu nie potwierdzają wygody na urządzeniu ani płynności pełnej rozgrywki. Nie zmieniano fizyki ani map.

Niezależny review oraz publikacja przez orkiestratora pozostają do wykonania. Nie wykonano push, PR ani merge.

## Uzupełnienie: menu bez przewijania kolumny i krzyżak

Usunięto wewnętrzny obszar przewijania z lewej kolumny tytułowej. Zmniejszono logo, przeniesiono informację o muzyce do stopki i usunięto powtarzające się podpisy. W niskim poziomym oknie przyciski układają się w trzy kolumny. Przy małym ekranie lub powiększeniu pozostaje dostępne przewijanie całego menu, bez zagnieżdżonego suwaka i utraty przycisków.

Zamiast analogowej gałki zastosowano cyfrowy krzyżak czterech strzałek: pola około 55 px (48 px w poziomie), środek zatrzymujący ruch, podświetlenie kierunku, przechwytywanie jednego palca i przesuwanie między strzałkami. Narożniki zachowują poprzedni kierunek, dopóki nowy nie jest jednoznaczny. Początkowy dotyk na całej strzałce wybiera dokładnie jej kierunek. Krótki tap jest zachowany do jednego kroku istniejącej symulacji; przytrzymanie nie przyspiesza fizyki. Anulowanie gestu, pauza i reset usuwają ruch i oczekujący tap.

Dobór krzyżaka oparto na zaleceniu Microsoft GDK dla gier 2D bez analogowej prędkości i kąta: https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-streaming/building-touch-layouts/game-streaming-tak-designers-guide (sekcja Left wheel / Inner).

- Testy Bongo Rush: 46 plików, 721 testów PASS; cztery nowe przypadki obejmują tap, przytrzymanie, zmianę kierunku, stabilność narożników, środek, daleki zasięg, obcy palec i anulowanie.
- TypeScript, ESLint zmienionych modułów, formatowanie, build i diff --check: PASS.
- `verify-direction-pad.py`: Chromium/WebKit, siedem rozmiarów menu, brak przewijania wewnętrznej kolumny, cele dotykowe minimum 44 px, dotyk poza środkiem strzałki, narożnik, skręt, neutralny środek, wyjście poza obrys i zwolnienie ruchu: PASS. Zrzuty i JSON w reports/bongo-direction-pad. Obejrzano desktop 1280×800, poziomy telefon 844×390 oraz pionowy telefon 390×844.
- Powtórzony `verify-ui-consistency.py`: Chromium i WebKit PASS dla nawigacji i ustawień.
- Fizyczny telefon: nadal nie testowano; komfort kciuka wymaga oceny użytkownika. Nie publikowano zmian.
