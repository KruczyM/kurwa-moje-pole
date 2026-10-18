@echo off
setlocal
title Hunyuan3D-2 (4 Zdjecia) - Offloading 64GB RAM / 8GB VRAM
set "APP_DIR=E:\kodowanie\gra\Hunyuan3D-2GP"
set "CUDA_PATH=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4"
set "CUDA_HOME=%CUDA_PATH%"
set "PATH=%CUDA_PATH%\bin;%PATH%"
set "TORCH_CUDA_ARCH_LIST=8.6"
set "NVCC_PREPEND_FLAGS=-allow-unsupported-compiler"
set "HF_HUB_ENABLE_HF_XET=1"
set "PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True"
set "PYTHON_EXE=%APP_DIR%\.venv\Scripts\python.exe"
set "ROOT_DIR=E:\kodowanie\gra"

if not exist "%PYTHON_EXE%" (
  echo [BLAD] Nie znaleziono srodowiska Python: %PYTHON_EXE%
  pause
  exit /b 1
)

:MENU
cls
echo ===============================================================================
echo        HUNYUAN3D-2: GENEROWANIE 3D Z 4 ZDJEC (FRONT / BACK / LEFT / RIGHT)
echo        ZOPTYMALIZOWANE POD: 64 GB RAM + 8 GB VRAM (RTX 3070 / RTX 4060)
echo ===============================================================================
echo.
echo Twoj komputer posiada 64 GB RAM oraz 8 GB VRAM.
echo Profil 2 (HighRAM_LowVRAM_Fast) trzyma caly model w 64 GB RAM w PELNEJ PRECYZJI FP16,
echo a do 8 GB VRAM przesyla dane w locie, zapobiegajac brakom pamieci VRAM.
echo.
echo WYBIERZ OPCJE DLA 4 ZDJEC:
echo  [1] Web UI: NAJMOCNIEJSZY MODEL 4-ZDJECIOWY (Pelny Hunyuan3D-2mv, 30-50 krokow, 4 ZDJECIA)
echo  [2] Web UI: SZYBKI MODEL TURBO (Hunyuan3D-2mv Turbo, 5 krokow, 4 ZDJECIA)
echo  [3] CLI: Generuj z folderu 4 zdjec (wiersz polecen - pelny model mv-full + tekstury)
echo  [4] CLI: Test demonstracyjny na przykladowych 4 zdjeciach
echo  [5] Web UI: Model 1-zdjeciowy (Hunyuan3D-2 H2 Base z pojedynczego zdjecia)
echo  [0] Wyjscie
echo.
set /p CHOICE=Wybierz numer [1-5, 0]: 

if "%CHOICE%"=="1" goto LAUNCH_WEBUI_MV_FULL
if "%CHOICE%"=="2" goto LAUNCH_WEBUI_MV_TURBO
if "%CHOICE%"=="3" goto LAUNCH_CLI
if "%CHOICE%"=="4" goto LAUNCH_DEMO
if "%CHOICE%"=="5" goto LAUNCH_WEBUI_H2
if "%CHOICE%"=="0" exit /b 0
goto MENU

:LAUNCH_WEBUI_MV_FULL
cls
echo ===============================================================================
echo  [INFO] Uruchamianie NAJMOCNIEJSZEGO modelu 4-zdjeciowego: Hunyuan3D-2mv (Full)
echo  Tryb: 4 sloty na zdjecia (Front, Back, Left, Right), pelne 30-50 krokow flow-matching
echo  Offloading: Profil 2 (pelne FP16 w 64 GB RAM, budzet 8 GB VRAM)
echo ===============================================================================
set "APP_URL=http://127.0.0.1:7861"
cd /d "%APP_DIR%"
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$u='%APP_URL%'; for($i=0;$i -lt 180;$i++){try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $u | Out-Null; Start-Process $u; exit}catch{Start-Sleep -Seconds 1}}"
call "%PYTHON_EXE%" gradio_app.py --mv --profile 2 --host 127.0.0.1 --port 7861
echo.
echo Hunyuan3D-2 zostal zatrzymany.
pause
goto MENU

:LAUNCH_WEBUI_MV_TURBO
cls
echo ===============================================================================
echo  [INFO] Uruchamianie szybkiego modelu 4-zdjeciowego: Hunyuan3D-2mv (Turbo)
echo  Tryb: 4 sloty na zdjecia (Front, Back, Left, Right), szybkie 5 krokow
echo  Offloading: Profil 2
echo ===============================================================================
set "APP_URL=http://127.0.0.1:7861"
cd /d "%APP_DIR%"
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$u='%APP_URL%'; for($i=0;$i -lt 180;$i++){try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $u | Out-Null; Start-Process $u; exit}catch{Start-Sleep -Seconds 1}}"
call "%PYTHON_EXE%" gradio_app.py --mv --turbo --profile 2 --host 127.0.0.1 --port 7861
echo.
echo Hunyuan3D-2 zostal zatrzymany.
pause
goto MENU

:LAUNCH_CLI
cls
echo ===============================================================================
echo                GENEROWANIE Z 4 ZDJEC PRZEZ WIERSZ POLECEN (CLI)
echo =============================================================================== 
echo.
echo Wskaz folder, w ktorym znajduja sie 4 zdjecia (front, back, left, right):
set /p INPUT_FOLDER=Podaj sciezke do folderu: 
echo.
echo Wybierz jakosc modelu:
echo  [1] Najmocniejszy model mv-full (30 krokow flow-matching, najwyzsza precyzja)
echo  [2] Szybki model mv-turbo (5 krokow)
set /p MODE_CHOICE=Wybierz jakosc [1-2, domyslnie 1]: 
set "MODE_PARAM=mv-full"
set "STEPS_PARAM=30"
if "%MODE_CHOICE%"=="2" (
  set "MODE_PARAM=mv-turbo"
  set "STEPS_PARAM=5"
)
echo.
echo Podaj rozdzielczosc octree [256 = standard, 384 = ultra gesta siatka]:
set /p RES_CHOICE=Rozdzielczosc (domyslnie 256): 
if "%RES_CHOICE%"=="" set "RES_CHOICE=256"
cd /d "%ROOT_DIR%"
call "%PYTHON_EXE%" scripts\generate_hunyuan_4views.py --input "%INPUT_FOLDER%" --mode %MODE_PARAM% --steps %STEPS_PARAM% --octree-resolution %RES_CHOICE% --profile 2
echo.
echo [INFO] Proces zakonczony.
pause
goto MENU

:LAUNCH_DEMO
cls
echo [INFO] Uruchamianie testu na folderze demonstracyjnym 001_pirate_parrot_girl (Najmocniejszy model)...
set "DEMO_FOLDER=%APP_DIR%\input_characters\001_pirate_parrot_girl"
cd /d "%ROOT_DIR%"
call "%PYTHON_EXE%" scripts\generate_hunyuan_4views.py --input "%DEMO_FOLDER%" --mode mv-full --steps 30 --octree-resolution 256 --profile 2
echo.
pause
goto MENU

:LAUNCH_WEBUI_H2
cls
echo ===============================================================================
echo  [INFO] Uruchamianie modelu bazowego Hunyuan3D 2.0 (H2) z 1 POJEDYNCZEGO ZDJECIA
echo ===============================================================================
set "APP_URL=http://127.0.0.1:7861"
cd /d "%APP_DIR%"
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$u='%APP_URL%'; for($i=0;$i -lt 180;$i++){try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $u | Out-Null; Start-Process $u; exit}catch{Start-Sleep -Seconds 1}}"
call "%PYTHON_EXE%" gradio_app.py --h2 --profile 2 --host 127.0.0.1 --port 7861
echo.
echo Hunyuan3D-2 zostal zatrzymany.
pause
goto MENU
