# Kalibracja locomotion NPC

## Zasada

Jedna jednostka świata odpowiada jednemu metrowi. Animator nie używa stałego `timeScale`: pobiera rzeczywisty czas klipu `Walk` lub `Run` i wiąże go z aktualną prędkością transformacji:

```text
referenceSpeed = cycleMeters / clipDuration
timeScale = worldSpeed / referenceSpeed
```

Pełny cykl `Walk` odpowiada 1,45 m, a `Run` 3,20 m. Wartości, prędkości docelowe, progi oraz przyspieszenie znajdują się w `src/game/npc/locomotionCalibration.json`.

## Zmierzone klipy

Walidator GLB odczytuje maksymalny czas accessorów każdego klipu. Aktualne paczki mają następujące zakresy:

| Klip | Czas cyklu w paczkach | Prędkość referencyjna przy 1× |
| ---- | --------------------- | ----------------------------- |
| Walk | 1,042–1,083 s         | 1,34–1,39 m/s                 |
| Run  | 0,667–0,750 s         | 4,27–4,80 m/s                 |

Pełne wyniki dla każdej postaci zapisuje `npm run check:rigs` w `reports/character-rig-validation.json`, w polu `locomotion`.

## Płynność ruchu

- `NpcManager` dochodzi do prędkości docelowej przez ograniczone przyspieszenie i hamowanie.
- Przed celem prędkość jest ograniczana na podstawie pozostałej drogi hamowania.
- Stan animacji wynika z rzeczywistej prędkości, a nie wyłącznie z decyzji `returning`.
- `NpcAnimator` aktualizuje skalę czasu obu klipów przed przejściem, więc ustawienie pozostaje aktywne po `Walk → Run`.
- Maszyna stanów przenosi znormalizowaną fazę cyklu, aby zmiana klipu nie gubiła rytmu lewej i prawej stopy.

## Strojenie

Najpierw należy zmieniać `walkSpeed` albo `runSpeed`. Jeżeli postać reaguje zbyt gwałtownie, należy obniżyć `acceleration`; jeżeli za długo dojeżdża do celu, zwiększyć `deceleration`. Dystans cyklu powinien być zmieniany tylko wtedy, gdy obserwacja kontaktu stóp z podłożem wykaże stałe ślizganie we wszystkich postaciach.
