# Instrukcja wdrożenia serwera Multiplayer na VPS / Własny serwer

Ten dokument zawiera instrukcję krok po kroku, jak uruchomić serwer pokojów (WebSocket / Socket.IO) na własnym serwerze (VPS z systemem Linux, np. Ubuntu 22.04 / 24.04 / Debian) tak, aby współpracował z grą hostowaną na **GitHub Pages** (`https://kruczym.github.io/kurwa-moje-pole/`).

---

## 📋 Wymagania wstępne

1. **Serwer VPS** z publicznym adresem IP (np. Hetzner, OVH, DigitalOcean, Oracle Cloud).
2. **Domena lub subdomena** skierowana rekordem `A` na IP Twojego VPS (np. `game.twojadomena.pl` lub darmowa domena z [DuckDNS.org](https://www.duckdns.org)).
3. Zainstalowany **Node.js (v20+)** i **npm**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

---

## Krok 1: Wgranie projektu na serwer

Zaloguj się na serwer przez SSH i sklonuj repozytorium (lub wgraj pliki do wybranego katalogu, np. `/var/www/gra`):

```bash
cd /var/www
git clone https://github.com/KruczyM/kurwa-moje-pole.git gra
cd gra
npm install
```

---

## Krok 2: Konfiguracja zmiennych środowiskowych (`.env`)

Utwórz plik `.env` w głównym katalogu projektu:

```bash
nano .env
```

Wklej konfigurację:

```env
# Port, na którym nasłuchuje aplikacja Node.js:
PORT=3001

# Dozwolona domena klienta (CORS):
CORS_ORIGIN=https://kruczym.github.io,http://localhost:5173
```

---

## Krok 3: Uruchomienie serwera w tle za pomocą PM2 (Autostart)

Narzędzie `pm2` dba o to, aby serwer działał nieprzerwanie w tle i wstawał automatycznie po restarcie VPS:

```bash
# 1. Zainstaluj PM2 globalnie:
sudo npm install -g pm2

# 2. Uruchom serwer pokojów:
pm2 start "npm run server" --name "gra-multiplayer"

# 3. Zapisz konfigurację autostartu:
pm2 save
pm2 startup
# (Wykonaj polecenie wygenerowane przez PM2)
```

Przydatne polecenia PM2:
- `pm2 status` – podgląd statusu serwera
- `pm2 logs gra-multiplayer` – podgląd logów w czasie rzeczywistym
- `pm2 restart gra-multiplayer` – restart serwera

---

## Krok 4: Konfiguracja Nginx jako Reverse Proxy (HTTPS + WSS)

Ponieważ GitHub Pages działa po **HTTPS**, połączenie WebSocket z Twoim serwerem musi również iść po **HTTPS/WSS** (port 443).

1. Zainstaluj Nginx i Certbot:
   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. Utwórz konfigurację dla Twojej subdomeny (np. `game.twojadomena.pl`):
   ```bash
   sudo nano /etc/nginx/sites-available/gra-server
   ```

3. Wklej poniższą konfigurację (zamień `game.twojadomena.pl` na swoją domenę):
   ```nginx
   server {
       server_name game.twojadomena.pl;

       location / {
           proxy_pass http://127.0.0.1:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # Timeouty dla WebSocket:
           proxy_read_timeout 86400;
           proxy_send_timeout 86400;
       }
   }
   ```

4. Aktywuj stronę w Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/gra-server /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. Wygeneruj darmowy certyfikat SSL Let's Encrypt:
   ```bash
   sudo certbot --nginx -d game.twojadomena.pl
   ```
   *(Certbot automatycznie skonfiguruje HTTPS i odnawianie certyfikatu).*

---

## Krok 5: Sprawdzenie poprawności działania serwera

Otwórz w przeglądarce adres:
```text
https://game.twojadomena.pl/health
```
Powinieneś otrzymać odpowiedź JSON:
```json
{"status":"ok","protocol":"1.0.0","rooms":0}
```

---

## Krok 6: Podłączenie klienta na GitHub Pages

Masz teraz dwie możliwości połączenia graczy:

### Opcja A: Bezpośredni link z parametrem (Brak konieczności rekompilacji)
Wyślij graczom link z parametrem serwera:
```text
https://kruczym.github.io/kurwa-moje-pole/?server=https://game.twojadomena.pl
```
Gra automatycznie połączy się z Twoim serwerem na VPS!

### Opcja B: Ustawienie na stałe w GitHub Actions
W repozytorium na GitHubie:
1. Przejdź do **Settings** → **Secrets and variables** → **Actions** → **Variables**.
2. Dodaj zmienną:
   - **Name:** `VITE_SERVER_URL`
   - **Value:** `https://game.twojadomena.pl`
3. Przy kolejnym deployu na GitHub Pages gra domyślnie połączy się z Twoim VPS.

