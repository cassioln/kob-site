// Isolated HTTP fixtures: WebKit service-worker requests bypass Playwright routes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
const root = new URL('../../', import.meta.url);
export async function boardingHttp(api) {
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  const server = createServer(async (req, res) => {
    if (api.down) return req.socket.destroy();
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/bus-admin-data') { api.financial++; return json(res, 200, { reservas: [], resumo: {}, frota: { onibus: [] } }); }
    if (url.pathname === '/api/bus-admin-reconcile') return json(res, 200, {});
    if (url.pathname === '/api/bus-boarding') {
      if (api.reject) return json(res, 404, { error: 'not_found' });
      if (req.method === 'GET') return json(res, 200, api.data);
      let text = ''; for await (const chunk of req) text += chunk;
      const body = JSON.parse(text); api.posts.push(body);
      if (api.hold) await api.hold;
      if (api.fail) return json(res, 503, { error: 'boarding_unavailable' });
      const person = api.data.people.find(p => p.id === body.passenger_id);
      if (!person || person.bus_number !== body.bus_number) return json(res, 409, { error: 'manifest_changed' });
      if (person[body.leg].revision !== body.expected_revision) return json(res, 409, { error: 'revision_conflict', checkin: person[body.leg] });
      person[body.leg] = { present: body.present, revision: body.expected_revision + 1, checked_at: '2026-10-16T15:00:00Z' };
      if (api.lost) { api.lost = false; return req.socket.destroy(); }
      return json(res, 200, { checkin: person[body.leg] });
    }
    try {
      const path = new URL(url.pathname.slice(1), root);
      if (!path.href.startsWith(root.href)) { res.writeHead(404); return res.end(); }
      const content = await readFile(path), type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }[extname(url.pathname)];
      res.writeHead(200, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content);
    } catch (_) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
  return async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); };
}
