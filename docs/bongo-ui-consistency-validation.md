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
