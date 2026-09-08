# System audio obozu i przestrzenny głośnik (Audio System)

Dokumentacja architektury dźwiękowej, przestrzennego tłumienia muzyki z głośnika, proceduralnego ambientu obozu oraz odporności na polityki autoplay przeglądarek w grze _Kurwa, moje pole!_.

---

## 1. Zakres i cel wdrożenia (Issue #28)

Wcześniejsza wersja gry odtwarzała muzykę obozową z głośnika jako globalny strumień stereo o stałej głośności na całym obszarze świata.
Zgodnie z wymaganiami zadania #28:

1. **Przestrzenne tłumienie odległości**: Muzyka musi być głośna i wyrazista pod zadaszeniem obozu w pobliżu głośnika, a w miarę oddalania się gracza na pole ma płynnie zanikać aż do zera.
2. **Płynne wyciszanie/włączanie (crossfade)**: Interakcja z głośnikiem (`E`) nie może powodować natychmiastowego ucinania ścieżki ani trzasków – głośność płynnie narasta i gaśnie w czasie ~0.45 s.
3. **Proceduralny ambient wiatru/obozu**: Dyskretny szum otwartego pola generowany w Web Audio API bez obciążania transferu sieciowego dodatkowymi plikami dźwiękowymi.
4. **Trwałość ustawień i ochrona przed wyciekami**: Niezależna regulacja głośności muzyki i ambientu w menu pauzy, zapamiętywanie stanu w `localStorage` oraz brak dublowania instancji audio po ponownym wejściu do obozu.
5. **Odporność na politykę autoplay**: Brak nieobsłużonych wyjątków konsolowych (`NotAllowedError`) i automatyczne wznawianie po pierwszym geście użytkownika.

---

## 2. Architektura komponentów

```
┌─────────────────────────────────────────────────────────────┐
│                           Game.ts                           │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │     SpeakerAudio      │       │    CampAmbientAudio   │  │
│  │ (HTMLAudioElement +   │       │   (Web Audio API:     │  │
│  │  spatial attenuation) │       │   noise + LFO filter) │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
└──────────────┼───────────────────────────────┼──────────────┘
               ▼                               ▼
    Głośnik obozowy (Amper)              Całe pole 3D
  - Promień pełny: 3.5 m               - Szum różowy (wiatr)
  - Promień wygaszania: 35 m           - Modulacja LFO 0.11 Hz
  - Tłumienie kwadratowe               - Niezależna głośność
```

### 2.1. `SpeakerAudio` (`src/game/audio/SpeakerAudio.ts`)

Klasa zarządzająca ścieżką muzyczną obozu:

- **Tłumienie odległości**:
  - $r_{\text{inner}} = 3.5\,\text{m}$: pełna głośność w bezpośrednim sąsiedztwie głośnika.
  - $r_{\text{outer}} = 35.0\,\text{m}$: całkowite wyciszenie na obrzeżach obozu.
  - Współczynnik odległości dla $d \in (r_{\text{inner}}, r_{\text{outer}})$:
    $$t = 1 - \frac{d - r_{\text{inner}}}{r_{\text{outer}} - r_{\text{inner}}}$$
    $$\text{attenuation} = t^2$$
    Kwadratowa krzywa zapewnia naturalne wrażenie akustyczne przestrzeni otwartej.
- **Formuła głośności końcowej**:
  $$\text{volume} = \text{clamp}(V_{\text{user}} \times \text{attenuation} \times V_{\text{effect}} \times F_{\text{fade}}, 0, 1)$$
  - $V_{\text{user}}$: suwak głośności głośnika gracza (`#setting-speaker-volume`, domyślnie `0.7`).
  - $V_{\text{effect}}$: mnożnik z `EffectManager` modyfikujący audio podczas tripa (zgodność z interfejsem `EffectAudioTarget`).
  - $F_{\text{fade}}$: współczynnik przejścia (0..1) przy włączaniu (`fading-in`) lub wyłączaniu (`fading-out`).

### 2.2. `CampAmbientAudio` (`src/game/audio/CampAmbientAudio.ts`)

Lekki syntezator ambientu wiatru w Web Audio API:

- **Generator szumu różowego**: 4-sekundowy bufor algorytmicznego szumu różowego (filtracja 1/f) zapętlony bez kliknięć.
- **Filtr górnoprzepustowy (Highpass)**: Odcięcie poniżej $70\,\text{Hz}$ usuwające niepożądane dudnienie basowe.
- **Filtr dolnoprzepustowy (Lowpass) sterowany LFO**:
  - Filtr dolnoprzepustowy o częstotliwości środkowej $450\,\text{Hz}$ z dobrocią $Q = 1.2$.
  - Wolny generator fal sinusoidalnych ($0.11\,\text{Hz}$, cykl ok. 9 sekund) modulujący pasmo odcięcia w zakresie $\pm 240\,\text{Hz}$, tworzący naturalne, powolne podmuchy wiatru.
- **Wzmocnienie**: Węzeł `GainNode` sterowany suwakiem `#setting-ambient-volume` (domyślnie `0.35`).
- **Pauza i wznawianie**: Automatyczne wyciszanie węzła wzmocnienia podczas pauzy w menu i płynne powracanie po wznowieniu gry.

---

## 3. Integracja z UI i menu pauzy

W menu pauzy (`#pause`) dodano dwa suwaki głośności:

- `#setting-speaker-volume`: głośność głośnika muzycznego (0–100%).
- `#setting-ambient-volume`: głośność tła ambientowego pola (0–100%).

Wartości są zapisywane w `localStorage` pod kluczem `camp-audio-settings`:

```json
{
  "speakerVolume": 0.7,
  "ambientVolume": 0.35,
  "speakerEnabled": false
}
```

---

## 4. Ochrona przed polityką autoplay i wyciekami

1. **Polityka autoplay przeglądarek**:
   - Wywołania `audio.play()` oraz `audioContext.resume()` są zabezpieczone klauzulami `try ... catch`.
   - W przypadku odmowy (`NotAllowedError`) rejestrowany jest jednorazowy nasłuch `pointerdown` oraz `keydown`, który wznawia audio przy pierwszej fizycznej interakcji gracza ze stroną.
2. **Brak duplikacji instancji przy ponownym wejściu**:
   - `Game.dispose()` zatrzymuje `speakerAudio.dispose()`, zwalnia kontekst Web Audio `campAmbient.dispose()`, zeruje flagi odtwarzania i odłącza listenery DOM.
   - Po powrocie do ekranu wyboru postaci i ponownym kliknięciu "WEJDŹ NA POLE" nie powstają zdublowane procesy dźwiękowe.
