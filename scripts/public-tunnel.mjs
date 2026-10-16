import http from 'node:http';
import { spawn } from 'node:child_process';

const PREVIEW_PORT = 5174;
const PROXY_PORT = 5175;

// 1. Start Vite preview on PREVIEW_PORT
const vite = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--host', '127.0.0.1'], {
  stdio: 'inherit',
  shell: true,
});

// 2. Start Proxy on PROXY_PORT that rewrites Host header and redirects '/' to '/kurwa-moje-pole/'
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '') {
    res.writeHead(302, { Location: '/kurwa-moje-pole/' });
    res.end();
    return;
  }
  const headers = { ...req.headers, host: `127.0.0.1:${PREVIEW_PORT}` };
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: PREVIEW_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end('Proxy error: ' + err.message);
  });
  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[Proxy] Listening on http://127.0.0.1:${PROXY_PORT}`);

  // 3. Start cloudflared on PROXY_PORT
  const tunnel = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${PROXY_PORT}`], {
    shell: true,
  });

  const parseUrl = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      console.log('\n======================================================');
      console.log('PUBLICZNY LINK DO GRY (DZIAŁA NA DANYCH KOMÓRKOWYCH / POZA WI-FI):');
      console.log(match[0]);
      console.log('======================================================\n');
    }
  };

  tunnel.stdout.on('data', parseUrl);
  tunnel.stderr.on('data', parseUrl);
});
