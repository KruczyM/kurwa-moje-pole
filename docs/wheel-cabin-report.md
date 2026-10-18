# Młyn Allegro: kabina i szybszy cykl

Przyczyna błędnej pozycji: importowany pivot gondoli znajduje się na zawieszeniu. Kontroler dodawał do niego +1.15 m, ustawiając kamerę ponad dachem. FestivalWheel wylicza teraz lokalny punkt pasażera z rzeczywistego bounding box kabiny (1.05 m ponad podłogą, pozycja siedząca), a kontroler transformuje go razem z gondolą. Matematyczny fallback i jawne eyeOffset pozostają dla modeli bez tego kontraktu.

Cykl: 3 s na wejście, 20 s wjazdu, 3 s postoju widokowego, 20 s zjazdu. Dolny postój wraca co 46 s zamiast 89 s. Istniejąca kolejka E pozwala czekać na bezpieczny dolny postój; nie teleportuje do kabiny w ruchu. Wysiadanie tylko na dole, poziomy horyzont, ograniczenie ruchu zgodne z dotychczasowym mechanizmem. Brak nowej pętli animacji.

Nie skalowano całego młyna ani nie zmieniano pliku Blender/GLB. Wymiary kabiny wraz z zawieszeniem: 1.7 × 2.13 × 1.3 m. Naprawa dotyczy siedzącego punktu widzenia, nie deklaruje miejsca do stania dla każdego avatara. Dopasowanie widocznych ciał pasażerów/animacji siedzenia w multiplayerze pozostaje osobnym zagadnieniem.

QA: 23 testy harmonogramu, kontrolera i rzeczywistego GLB PASS; typecheck i lint PASS. Chromium: wejście rzeczywistym E, automatyczny start przed upływem 6 s, punkt kamery wewnątrz bounding box przy 4/13/24/36 s, zawsze 1.05 m ponad podłogą i roll=0. Po powrocie dolny postój i bezpieczne wysiadanie. Brak page errors. Raport i widok z kabiny w `reports/wheel-cabin/`. Nie wykonano push/merge.
