# Scheduler zachowania NPC

Plik NpcBehaviorScheduler.ts oddziela długoterminowe decyzje postaci od nawigacji A* i lokalnego steeringu. Każdy z ośmiu NPC posiada osobną instancję schedulera, profil czasów oraz deterministyczny generator losowy.

## Stany

- idle — postać stoi przez czas wynikający ze swojego profilu;
- wander — wybiera odległy punkt w jednym z dziewięciu sektorów pełnego pola;
- social — podchodzi w pobliże pojedynczej innej postaci i pozostaje tam przez krótki czas;
- run-home — awaryjnie wraca z krawędzi do centralnej, bezpiecznej strefy.

Pierwsze akcje mają różne opóźnienia, a zakresy idle, szanse social i długości spotkań różnią się między postaciami. Jednocześnie w stanie społecznym mogą znajdować się najwyżej dwa NPC, co zapobiega zbieganiu się całej populacji w jedno miejsce.

## Ochrona przed oscylacją

Scheduler pamięta trzy ostatnio wybrane sektory i preferuje pozostałe. Spotkania społeczne oraz powrót od granicy mają osobne cooldowny. run-home może rozpocząć się wyłącznie przy krawędzi i kończy się po wejściu do bezpiecznej strefy, dlatego NPC nie biegnie bez końca do geometrycznego środka.

Scheduler wybiera intencję, NpcNavigationGrid wyznacza pełną trasę, a NpcSteering wykonuje lokalne omijanie. Nie należy przenosić logiki colliderów ani animacji do schedulera.
