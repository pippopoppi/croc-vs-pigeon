/* Coccodrillo vs Piccione — world ranking. A Cloudflare Worker with one KV key.
 *
 *   GET  /?top=10          -> { top: [ { name, score, time, eaten, at } ... ] }
 *   GET  /?name=LOLLO      -> { rank, row } for one nickname (rank 0 = not ranked)
 *   POST / { name, score, time, eaten }
 *                          -> { rank, improved, best, top }
 *
 * One row per nickname (case-insensitive). A score only replaces the stored row when it
 * is better, so reusing a name keeps the record. Deploy: see ../README.md.
 */
const KEY = 'board';
const KEEP = 500;              // rows stored
const MAX_TOP = 50;            // rows a GET may ask for
const NAME_RE = /[^\p{L}\p{N}\p{Emoji_Presentation} _.\-!?*]/gu;

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'no-store',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers });
const cleanName = v => String(v || '').replace(NAME_RE, '').replace(/\s+/g, ' ').trim().slice(0, 12).toUpperCase();
const int = v => (Number.isFinite(+v) ? Math.floor(+v) : -1);
const cmp = (a, b) => b.score - a.score || b.time - a.time || (a.at || 0) - (b.at || 0);

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(req.url);
    const board = JSON.parse((await env.BOARD.get(KEY)) || '[]');

    if (req.method === 'GET') {
      const name = cleanName(url.searchParams.get('name'));
      if (name) {
        const i = board.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
        return json({ rank: i + 1, row: i < 0 ? null : board[i] });
      }
      const top = Math.max(1, Math.min(MAX_TOP, int(url.searchParams.get('top')) || 10));
      return json({ top: board.slice(0, top), total: board.length });
    }

    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    let b;
    try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const row = { name: cleanName(b.name), score: int(b.score), time: int(b.time), eaten: int(b.eaten), at: Date.now() };
    // Sanity limits: the game cannot score more than a few thousand points per second.
    if (!row.name || row.score < 0 || row.eaten < 0 || row.time < 0 || row.time > 7200 || row.score > row.time * 6000 + 6000 || row.eaten > row.time * 6 + 6) return json({ error: 'invalid score' }, 400);

    const key = row.name.toLowerCase();
    const i = board.findIndex(r => r.name.toLowerCase() === key);
    let improved = false;
    if (i < 0) { board.push(row); improved = true; }
    else if (cmp(row, board[i]) < 0) { board[i] = row; improved = true; }
    board.sort(cmp);
    if (board.length > KEEP) board.length = KEEP;
    if (improved) await env.BOARD.put(KEY, JSON.stringify(board));
    const rank = board.findIndex(r => r.name.toLowerCase() === key) + 1;
    return json({ rank, improved, best: rank ? board[rank - 1].score : row.score, top: board.slice(0, 10) });
  },
};
