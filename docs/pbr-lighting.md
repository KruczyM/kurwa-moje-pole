# PBR i oświetlenie

## Kontrakt materiałów

Każdy zatwierdzony GLB przechodzi przez `applyPbrMaterialPolicy()` po załadowaniu. Polityka nie zastępuje tekstur i nie zmienia wartości sterowanych mapą metallic/roughness. Koryguje wyłącznie przestrzeń barw oraz skrajne wartości liczbowe materiałów bez odpowiedniej mapy.

- Base Color (`map`) i Emission (`emissiveMap`) używają `SRGBColorSpace`.
- Normal, Roughness, Metalness, AO, Alpha, Bump i Displacement pozostają mapami danych w `NoColorSpace`.
- Postacie: roughness `0,55–0,90`, metalness `0–0,04`.
- Tkaniny namiotów i flagi: roughness `0,68–0,98`, metalness `0–0,04`.
- Plastik: roughness `0,32–0,78`, metalness `0–0,05`.
- Papier: roughness `0,72–1,00`, metalness `0–0,02`.
- Materia organiczna: roughness `0,68–0,96`, metalness `0–0,02`.
- Drewno: roughness `0,62–0,94`, metalness `0–0,03`.
- Materiały z autorską mapą metallic/roughness zachowują jej pełny zakres.

Profile są przypisywane centralnie w `AssetLoader`. Podgląd postaci ładuje modele osobno, dlatego stosuje ten sam profil `character` bezpośrednio po wczytaniu GLB.

## Wynik audytu źródeł

Wszystkie zatwierdzone modele mają teksturę Base Color. Część eksportów postaci, namiotów i rekwizytów nie deklaruje `metallicFactor`. Specyfikacja glTF przyjmuje wtedy wartość `1`, co może powodować metaliczny wygląd skóry, ubrań i płótna. Runtime zeruje ten przypadkowy połysk zgodnie z profilem powierzchni. Modele posiadające mapy metallic/roughness (`big2`, `small`, `small2`, krzesło) zachowują dane autora.

`npm run check:assets` zapisuje w `reports/asset-validation.json` dla każdego GLB profil runtime i sekcję `pbr` zawierającą liczbę map Base Color, metallic/roughness, normal, emission oraz materiałów wymagających korekty domyślnej metaliczności.

## Tone mapping i ekspozycja

Wszystkie trzy renderery korzystają z wyjścia sRGB oraz `ACESFilmicToneMapping`:

| Renderer             | Ekspozycja |
| -------------------- | ---------: |
| świat gry            |       1,10 |
| preview postaci      |       1,35 |
| inspekcja przedmiotu |       1,20 |

Wartości znajdują się w `src/game/rendering/colorPipeline.ts`. Nie należy kompensować ciemnego modelu przez zmianę koloru tekstury albo materiał `MeshBasicMaterial`.

## Światło pod Mad Dog

Światło świata składa się z miękkiego światła nieba i kierunkowego słońca. Mad Dog ma dodatkowo subtelny ambient oraz lokalne ciepłe światło punktowe o ograniczonym zasięgu. Dzięki temu twarze i ubrania pozostają czytelne pod płachtą, bez rozjaśniania całego obozu.

## Kontrola wizualna

Po zmianie modeli należy sprawdzić scenę dzienną i nocną oraz preview każdej postaci:

1. skóra i tkaniny nie wyglądają jak chrom ani mokry plastik;
2. czarne ubrania zachowują detale w cieniu;
3. białe powierzchnie nie tracą faktury w słońcu;
4. kolory namiotów i flagi odpowiadają Base Color;
5. normal mapy nie zmieniają koloru materiału;
6. preview i inspekcja nie są wyraźnie ciemniejsze lub jaśniejsze od świata.
