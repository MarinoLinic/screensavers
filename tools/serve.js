import http from 'node:http';
import path from 'node:path';
import { realpath, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const configuredPort = process.env.PORT ? Number(process.env.PORT) : null;
const ports = configuredPort !== null
  ? [configuredPort]
  : Array.from({ length: 27 }, (_, index) => 8094 + index);
if (ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) {
  throw new Error('PORT must be a valid TCP port number.');
}

const mimeTypes = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
};
const blockedSegments = new Set([
  '.git',
  'artifacts',
  'node_modules',
  'tests',
  'work',
  '__pycache__',
]);

const server = http.createServer(async (request, response) => {
  const commonHeaders = {
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Screensavers-Launcher': '1',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { ...commonHeaders, Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  } catch {
    response.writeHead(400, commonHeaders);
    response.end('Bad request');
    return;
  }

  if (pathname.includes('\\') || pathname.includes('\0')) {
    response.writeHead(400, commonHeaders);
    response.end('Bad request');
    return;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.') || blockedSegments.has(segment.toLowerCase()))) {
    response.writeHead(404, commonHeaders);
    response.end('Not found');
    return;
  }

  let target = path.resolve(root, '.' + pathname);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403, commonHeaders);
    response.end('Forbidden');
    return;
  }

  try {
    let details = await stat(target);
    if (details.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(302, { ...commonHeaders, Location: pathname + '/' + new URL(request.url, 'http://127.0.0.1').search });
        response.end();
        return;
      }
      target = path.join(target, 'index.html');
      details = await stat(target);
    }
    if (!details.isFile()) {
      response.writeHead(404, commonHeaders);
      response.end('Not found');
      return;
    }

    const canonicalTarget = await realpath(target);
    const canonicalRelative = path.relative(root, canonicalTarget);
    if (canonicalRelative.startsWith('..') || path.isAbsolute(canonicalRelative)) {
      response.writeHead(403, commonHeaders);
      response.end('Forbidden');
      return;
    }

    const contentType = (mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream') + '; charset=utf-8';
    const body = request.method === 'HEAD' ? null : await readFile(canonicalTarget);
    response.writeHead(200, { ...commonHeaders, 'Content-Length': details.size, 'Content-Type': contentType });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    response.end(body);
  } catch (error) {
    const status = error.code === 'EACCES' ? 403 : 404;
    response.writeHead(status, commonHeaders);
    response.end(status === 403 ? 'Forbidden' : 'Not found');
  }
});

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], {
      windowsHide: true,
      stdio: 'ignore',
    }).on('error', () => console.log('Open the URL above in your browser.'));
  } else {
    console.log('Open the URL above in your browser.');
  }
}

async function listen(port) {
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

async function isOurLauncher(port) {
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/', {
      signal: AbortSignal.timeout(500),
    });
    return response.headers.get('x-screensavers-launcher') === '1';
  } catch {
    return false;
  }
}

let activePort = null;
let firstError = null;
for (const port of ports) {
  try {
    await listen(port);
    activePort = port;
    break;
  } catch (error) {
    if (error.code !== 'EADDRINUSE') {
      throw error;
    }
    if (!firstError) firstError = error;
    if (await isOurLauncher(port)) {
      activePort = port;
      break;
    }
  }
}

if (activePort == null) {
  console.error(
    configuredPort
      ? 'Port ' + configuredPort + ' is occupied. Set PORT to a free port and try again.'
      : 'Ports 8094–8120 are occupied. Set PORT to a free port and try again.',
  );
  if (firstError) process.exitCode = 1;
} else {
  const url = 'http://127.0.0.1:' + activePort + '/';
  const reused = !server.listening;
  console.log(
    (reused ? 'Screensavers is already running' : 'Screensavers') + ': ' + url +
    (reused ? '' : '\nKeep this window open. Close it or press Ctrl+C to stop.'),
  );
  if (process.argv.includes('--open') && !process.argv.includes('--no-open')) openBrowser(url);
}
