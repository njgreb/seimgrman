import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

// Serves the built game (dist/) alongside the API, so one Railway service hosts the whole thing.

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  // the strategy guide: the PDF opens in the browser instead of downloading, the font loads for its page
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
};

export function staticFiles(root: string) {
  const dir = path.resolve(root);

  return async function serve(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const file = path.resolve(dir, `.${rel}`);
    if (file !== dir && !file.startsWith(dir + path.sep)) return false; // no climbing out of dist/
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) return false;

    const ext = path.extname(file).toLowerCase();
    // Vite fingerprints everything in assets/, so those can be cached forever; the rest must stay fresh.
    const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': cache,
    });
    if (req.method === 'HEAD') return void res.end(), true;
    createReadStream(file).pipe(res);
    return true;
  };
}
