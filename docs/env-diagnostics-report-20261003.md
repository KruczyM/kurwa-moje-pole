# Raport diagnostyczny konfiguracji lokalnego ENV (Zadanie G2)

**Data audytu:** 2026-10-03  
**Status:** Zakończony pomyślnie

---

### 1. Zidentyfikowany problem

Użytkownik zgłosił, że klucze API (w tym ElevenLabs) zostały dodane, ale gra ich nie ładowała.

### 2. Wyniki analizy diagnostycznej (Audit bezpieczeństwa)

1. **Brak pliku `.env` w katalogu głównym projektu:**
   - W katalogu `E:\kodowanie\gra` istniał jedynie szczątkowy plik `.env.example`.
   - Pliki `.env`, `.env.local`, `.env.development` nie istniały w katalogu głównym projektu.
   - W zmiennych środowiskowych powłoki/rejestru Windows (HKCU/HKLM) nie wykryto zarejestrowanych zmiennych o nazwach `VITE_ELEVENLABS_API_KEY` ani `VITE_GEMINI_API_KEY`.
2. **Mechanizm działania Vite:**
   - Klient przeglądarkowy (Vite) odczytuje zmienne wyłącznie o prefiksie `VITE_` z pliku `.env` (lub `.env.local`) znajdującego się w katalogu roboczym projektu.
   - Vite parsuje te pliki w momencie startu serwera deweloperskiego (`npm run dev`). Dodanie lub modyfikacja pliku `.env` w trakcie działania procesu Node wymaga restartu serwera dev, aby wartości zostały wstrzyknięte do `import.meta.env`.
3. **Alternatywny, bezpieczny magazyn `localStorage`:**
   - Zarówno `ElevenLabsNpcService.ts`, jak i `GeminiNpcService.ts` posiadają priorytetowe odczytywanie kluczy z lokalnego magazynu przeglądarki (`localStorage.getItem('elevenlabs_api_key')` oraz `gemini_api_key`).
   - Pozwala to graczowi wprowadzić klucz bezpośrednio w interfejsie gry (np. w oknie ustawień pod ikoną zębatki), co działa natychmiastowo bez konieczności restartu serwera i całkowicie eliminuje ryzyko przypadkowego wycieku klucza do gita.
4. **Zgodność z `AGENTS.md` (Zasada 2 i 10):**
   - Podczas diagnostyki nie odczytywano ani nie zapisywano żadnych wartości prywatnych kluczy do raportów, konsoli ani logów.
   - Brak jakichkolwiek sekretów w repozytorium.

### 3. Wdrożone poprawki

- Zaktualizowano `.env.example` z pełnym zestawem placeholderów (`VITE_SERVER_URL`, `PORT`, `CORS_ORIGIN`, `VITE_GEMINI_API_KEY`, `VITE_ELEVENLABS_API_KEY`).
- Dodano jasne instrukcje kopiowania do `.env` oraz przypomnienie o konieczności restartu serwera dev.
- Zapewniono pełną izolację fallbacków offline (jeśli brak klucza ElevenLabs, gra płynnie przełącza się na Web Speech API przeglądarki).
