# Bongo Rush — interfejs, sterowanie mobilne i kamera

Zmiany na branchu fix/bongo-ui-consistency po e54f7ad. Nie zmieniano plansz, tempa fizyki ani zasad zbierania.

## Wynik

- Stopka porad jest widoczna tylko podczas rozgrywki. Nie nachodzi na wybór postaci, poziomów, pauzę ani wynik. HUD znika wizualnie pod panelami pauzy/wyniku, zachowując wymiary dla stabilności kadru. Na małym ekranie podczas gry usunięto dodatkowy wiersz logo nad narzędziami.
- W Oprawa i muzyka → Sterowanie mobilne można zapisać położenie lewo/środek/prawo, rozmiar kompaktowy/standardowy/duży i widoczność 60–100%. Cały krzyżak ma 148/168/192 px w pionie i 148–168 px w krótkim poziomie; pojedyncza strzałka ma minimum 48 px. Restart jest po przeciwnej stronie dla lewego krzyżaka i nie nachodzi na duży środkowy krzyżak na ekranie szerokości 320 px.
- Zapis preferencji jest zgodny ze starszymi zapisami: domyślnie środek, standardowy rozmiar i 90% widoczności. Wróć anuluje zmiany; Zastosuj zapisuje je bez resetowania kampanii.
- Skala zależy od viewportu, a nie wielkości mapy: 40–80 px na kafel. Małe komory nie powiększają wszystkich elementów do około 94–131 px. Wolne otoczenie wypełnia istniejąca, przyciemniona grafika.
- Istniejący CameraRig otrzymał opcjonalne marginesy dla HUD i sterowania. W pionie gracz pozostaje nad krzyżakiem, a w krótkim poziomie obok niego. Ograniczono opóźnienie śledzenia przed wejściem całej sylwetki pod interfejs. Klienci bez marginesów zachowują poprzednie kadrowanie.
- Minimapę rozmieszcza się w wolnej części ekranu także dla prawego i środkowego krzyżaka w poziomie. Nadal używane są ten sam renderer, kamera, RAF, loader, cache i sprzątanie listenerów.

## Walidacja

- Testy Bongo Rush i After: 53 pliki / 786 testów PASS. Objęto starsze kadrowanie bez marginesów, ograniczenie opóźnienia kamery w wąskim oknie, małe mapy, narożne spawny, wszystkie położenia krzyżaka, rozmiary celów i zapis ustawień.
- TypeScript, ESLint zmienionych modułów, Prettier, git diff --check i build PASS. Pozostaje istniejące ostrzeżenie dużego bundla głównej gry 3D.
- `verify-mobile-safe-camera.py`: Chromium i WebKit, 40 kombinacji poziomu/ekranu. Poziomy 1, 12, 18 i 24; viewporty 390×844, 844×390, 320×480, 568×320 i 1440×900. Sprawdzono stałą skalę, brak nakładania bohatera na HUD i krzyżak, oddzielenie restartu/minimapy, ukrycie stopki w menu oraz zapis/odtworzenie ustawień.
- Dodatkowe przypadki obejmują zmianę położenia na środek/prawo w krótkim poziomie i duży środkowy krzyżak na 320×480. Raporty i zrzuty: reports/bongo-mobile-safe-camera.
- Obejrzano zrzuty galerii 390×844 oraz małych komór w pionie i poziomie. Nie wykonano próby na fizycznym telefonie ani pomiaru FPS na urządzeniu; komfort kciuka i wydajność pozostają do oceny użytkownika.

Nie wykonano push, PR ani merge. Niezależny review i publikacja pozostają po stronie orkiestratora.
