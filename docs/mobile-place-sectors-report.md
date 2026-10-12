# Mobilne sektory miejsc i ograniczony tłum

Branch: `feat/mobile-place-sectors`, bazujący na `main` po PR #113.

Status: `VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN`. Nie wykonano testu rozgrywki ani pomiarów pamięci na fizycznym telefonie; nie potwierdzono płynności przy 16 osobach w jednym sektorze.

## Podział mapy

Siatkę 64 × 64 m zastępuje sześć nazwanych obszarów. Wspólną definicję granic, nazw i budżetów czytają kod gry oraz istniejący eksporter GLB. Całe placementy pozostają w jednym logicznym sektorze; eksport nie rozcina budynków, namiotów, barierek ani wież między miejscami.

| Sektor                                | Maksimum botów otoczenia | Pliki scenografii |
| ------------------------------------- | -----------------------: | ----------------: |
| Pierwszy pasaż                        |                        3 |                 1 |
| Kurwa Moje Pole i sąsiednie namioty   |                        3 |                 7 |
| Lidl i karuzela                       |                        2 |                 1 |
| Duża scena, bariery i wieże           |               3 tańczące |                 1 |
| Obozy za pasażem                      |                        1 |                 3 |
| Drugi pasaż, ASP, słoneczniki i brama |                        2 |                 1 |

Lidl i koło są obecnie w dwóch oddalonych miejscach mapy. Należą do jednego logicznego sektora atrakcji, z dwoma regionami wejścia. Współrzędne świata i kolizje pozostają takie same dla telefonu, desktopu i serwera.

Pytanie oraz ekran ładowania podają nazwę docelowego miejsca. Poprzedni obszar jest zwalniany przed pobieraniem następnego. Większe obszary składają się z kolejno pobieranych plików, ale ruch wraca dopiero po załadowaniu całego sektora. Instancje tej samej geometrii źródłowej są eksportowane razem, aby nie powielać ciężkiego modelu w kilku plikach sektora.

## Boty i wydajność

Mobilny menedżer NPC używa puli sześciu instancji istniejących modeli postaci; nie pobiera osobnego ciężkiego tłumu. Nieaktywne instancje są odłączone od sceny i nie uczestniczą w animacji, interakcji ani unikaniu przeszkód. Aktywne boty otoczenia stoją w sprawdzonych miejscach, a pod sceną tańczą. Nie wędrują samodzielnie do niezaładowanych sektorów.

Liczba botów to minimum z budżetu miejsca, limitu wydajności i pozostałego budżetu sześciu aktorów obejmującego lokalnego gracza oraz ludzi w sektorze. Obecność pięciu innych graczy wyłącza boty otoczenia; sami ludzie nie są usuwani z powodu budżetu botów. Bot nie używa postaci zajętej przez obecnego gracza.

Pomiar rzeczywistego czasu klatek obniża dopuszczalną liczbę botów o jeden po około dwóch sekundach poniżej 28 FPS. Odbudowa jest powolna: jeden po co najmniej ośmiu sekundach powyżej 45 FPS. Ładowanie, pauza i długie przerwy karty nie są próbkami tego pomiaru. Aktywny mecz flanków zachowuje swoich zawodników do ich zwolnienia przez mecz.

Wspólne modele dynamiczne świata bazowego (m.in. koło i drzwi), teren, scaffold kolizji oraz szablony postaci nadal pozostają rezydentne. Dynamiczna geometria spoza aktywnego miejsca nie jest renderowana, ale jej pamięć nie jest zwalniana przy przejściu. Prywatne zasoby odłączonych botów obejmuje wspólny przebieg sprzątania przy zamknięciu gry.

Najcięższy sektor obozowy nadal zawiera około 87,5 MB plików scenografii, a największy pojedynczy plik około 37,9 MB, ponieważ istniejący model źródłowy sam jest tak duży. To rozmiary plików, nie pomiar RAM/VRAM; tekstury i dekodowanie zwiększają pamięć. Podział miejsc i ograniczenie botów nie zastępują przyszłej optymalizacji najcięższych modeli.

## Multiplayer

Protokół, serwer, pokoje, logowanie i limit 16 graczy nie zmieniają się. Sektory są lokalnym wyborem tego, co telefon ładuje; nie tworzą osobnych instancji świata ani nowych pokoi.

Telefon tworzy modele, szkielety, animatory i nametagi tylko dla graczy z aktywnego sektora. Wyjście gracza lub zmiana lokalnego sektora zwalnia jego instancję. Powrót odtwarza ją z aktualnego snapshotu, bez rozłączenia. Gracze w innych sektorach pozostają na wspólnej mapie i mają aktualne pozycje dla dźwięku przestrzennego. Desktop zachowuje dotychczasowy widok.

Podczas lokalnego pytania/ładowania host nadal aktualizuje współdzieloną rozgrywkę i wysyła nieruchomą pozycję gracza. Nie zatrzymuje pokoju pozostałym uczestnikom. Boty otoczenia są lokalne; nie stają się dodatkowymi graczami ani wspólnie synchronizowanym tłumem.

## Kontrole

- Testy deterministyczne granic, landmarków, budżetów, reakcji na FPS, bezpiecznego spawnu, odłączania botów, tańca oraz powrotów innych graczy między sektorami.
- Walidator eksportu sprawdza oba kompletne podziały: desktopowy oraz mobilne sześć miejsc/14 plików, bez pominiętych i podwójnych siatek, z niezmienioną geometrią, teksturami i transformacjami. Weryfikuje też spójność placementów między plikami.
- Wymagane przed uznaniem rozgrywki za sprawdzoną: przejść każdą granicę na telefonie, sprawdzić nazwy i całe budynki; powtórzyć przejścia; połączyć telefon i desktop z jednym pokojem, zmienić sektory i wrócić; sprawdzić boty przy rosnącej liczbie graczy, spadku FPS oraz podczas flanków. Osobno sprawdzić pamięć i płynność z pełnym pokojem.
