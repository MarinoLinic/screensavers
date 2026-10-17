import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 8103);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/plain', '.json': 'application/json' };
function open(url) {
  if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' }).on('error', () => console.log('Open the URL above in your browser.'));
}
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': (types[path.extname(target)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', async err => {
  if (err.code === 'EADDRINUSE') {
    const url = `http://127.0.0.1:${port}/`;
    try {
      const response = await fetch(url);
      if ((await response.text()).includes('biome-worlds-app')) {
        console.log(`Biome Worlds is already running: ${url}`);
        if (process.argv.includes('--open')) open(url);
        return;
      }
    } catch { /* An occupied port must never be killed or repurposed. */ }
    console.error(`Port ${port} is in use. Set PORT to another number and try again.`);
  } else console.error(err.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  console.log(`Biome Worlds: ${url}\nKeep this window open. Close it or press Ctrl+C to stop.`);
  if (process.argv.includes('--open')) open(url);
});
