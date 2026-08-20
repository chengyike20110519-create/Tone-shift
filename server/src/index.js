// server/src/index.js
// Tone-Shift 后端：单进程 Node 服务，同时托管静态文件 + REST API。
//
//   静态文件  → /                web/index-modular.html 等
//   REST API  → /api/v1/*        字典 / 声痕卡 / 打卡 / 点赞 / 评论 / 匹配 / 漂移
//
// 前端通过 api.js 调用 /api/v1/*；前端 IndexedDB 是另一份客户端缓存，跟此后端完全物理隔离。
// 设计取舍：单进程 JSON 文件当 DB，演示用足够。将来切 SQLite / Postgres 时只换 db.js 即可。

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { openDb, getState, flush,
         dict, setDict,
         putMark, getMark, delMark, listMarksByOwner, listGallery,
         addCheckin, getCheckinDays, getLastCheckinMark, computeStreak,
         addLike, removeLike, countLikes,
         putComment, listCommentsByMark,
         putDriftChain, getDriftChain, listTopics } from './db.js';
import { seedIfEmpty, seedSocialIfEmpty } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');           // 仓库根
const WEB_DIR = join(ROOT, 'web');
const DATA_PATH = join(__dirname, '..', 'data', 'toneshift.db.json');

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const STATIC_PREFIX = '/';

const nid = () => randomUUID().replace(/-/g, '');

// ── 请求上下文 ──────────────────────────────────────────
function send(res, status, body, headers = {}) {
  const isJSON = typeof body !== 'string' && !(body instanceof Buffer);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Owner-Token',
    'Content-Type': isJSON ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...headers
  });
  res.end(isJSON ? JSON.stringify(body) : body);
}
async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ── 静态文件 ────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8'
};
async function serveStatic(res, urlPath) {
  let p = normalize(join(WEB_DIR, urlPath === '/' ? '/index-modular.html' : urlPath));
  if (!p.startsWith(WEB_DIR)) return send(res, 403, 'forbidden');
  try {
    const st = await stat(p);
    if (st.isDirectory()) p = join(p, 'index-modular.html');
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    // 文件不存在 → 退回 SPA 入口（前端用 hash 路由）
    try {
      const body = await readFile(join(WEB_DIR, 'index-modular.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch { send(res, 404, 'not found'); }
  }
}

// ── 路由 ────────────────────────────────────────────────
function getOwner(req) {
  // 浏览器匿名 token：先用 query，再 header，最后用 IP+UA 散列（demo 用）
  const h = req.headers['x-owner-token'];
  if (h && typeof h === 'string' && h.length < 128) return h;
  const ip = req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return 'anon:' + Buffer.from(ip + ua).toString('base64').slice(0, 16);
}

// 同频匹配 —— 余弦相似度（颜色直方图）
function colorHistogram(mark) {
  // 从 stats 中拿颜色直方图；空对象就用调色板平均色做兜底
  const h = (mark.stats && mark.stats.colorHist) || {};
  const keys = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
  return keys.map(k => h[k] || 0);
}
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;
  const q = u.searchParams;

  // ── 健康检查
  if (p === '/api/v1/health') {
    return send(res, 200, { ok: true, time: new Date().toISOString(), db_path: DATA_PATH });
  }

  // ── 字典
  if (p === '/api/v1/palette')         return send(res, 200, { palette: dict('palette'), recommended_index: dict('recommended_index') });
  if (p === '/api/v1/words')           return send(res, 200, { words: dict('word_bank') });
  if (p === '/api/v1/personalities')   return send(res, 200, { personalities: dict('personalities') });
  if (p === '/api/v1/mem-options')     return send(res, 200, { colors: dict('mem_colors'), eras: dict('mem_eras') });
  if (p === '/api/v1/mock-songs')      return send(res, 200, { songs: dict('mock_songs') });
  if (p === '/api/v1/time-config')     return send(res, 200, { listen_end: dict('listen_end'), paint_end: dict('paint_end') });
  if (p === '/api/v1/copy')             return send(res, 200, { copy: dict('copy') });
  if (p === '/api/v1/topics' && req.method === 'GET') return send(res, 200, { topics: listTopics() });

  // 字典修改（demo 用；生产应加 auth）
  const m = p.match(/^\/api\/v1\/dicts\/([\w_]+)$/);
  if (m && req.method === 'PUT') {
    const body = await readBody(req);
    setDict(m[1], body.value);
    return send(res, 200, { ok: true, key: m[1] });
  }

  // ── 声痕卡 CRUD
  if (p === '/api/v1/marks' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.mode) return send(res, 400, { error: 'mode required' });
    const owner = body.owner_token || getOwner(req);
    const id = body.id || nid();
    const mark = {
      id, mode: body.mode,
      title: body.title || null,
      is_public: !!body.is_public,
      owner_token: owner,
      palette: body.palette || null,
      stats: body.stats || null,
      summary: body.summary || null,
      thumb: body.thumb || null,
      created_at: body.created_at || new Date().toISOString()
    };
    putMark(mark);
    return send(res, 200, { ok: true, mark });
  }
  if (p === '/api/v1/marks' && req.method === 'GET') {
    const owner = q.get('owner_token');
    const mode = q.get('mode');
    let arr = owner ? listMarksByOwner(owner) : listGallery({ page: 1, limit: 1000, mode });
    if (mode) arr = arr.filter(m => m.mode === mode);
    return send(res, 200, { marks: arr });
  }

  const mk = p.match(/^\/api\/v1\/marks\/([\w-]+)$/);
  if (mk) {
    const m = getMark(mk[1]);
    if (!m) return send(res, 404, { error: 'not found' });
    if (req.method === 'GET')  return send(res, 200, { mark: m });
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      if ('title' in body)     m.title = body.title;
      if ('is_public' in body) m.is_public = !!body.is_public;
      if ('summary' in body)   m.summary = body.summary;
      flush();
      return send(res, 200, { ok: true, mark: m });
    }
    if (req.method === 'DELETE') {
      const owner = getOwner(req);
      if (m.owner_token !== owner && !q.get('force')) return send(res, 403, { error: 'not your mark' });
      delMark(mk[1]);
      return send(res, 200, { ok: true });
    }
  }

  // ── 公开画廊
  if (p === '/api/v1/gallery' && req.method === 'GET') {
    const page = parseInt(q.get('page') || '1', 10);
    const limit = Math.min(parseInt(q.get('limit') || '20', 10), 100);
    const mode = q.get('mode');
    const arr = listGallery({ page, limit, mode });
    return send(res, 200, { page, limit, marks: arr });
  }

  // ── 打卡
  if (p === '/api/v1/checkin' && req.method === 'POST') {
    const body = await readBody(req);
    const owner = body.owner_token || getOwner(req);
    const today = new Date().toISOString().slice(0, 10);
    addCheckin(owner, today, body.mark_id || null);
    return send(res, 200, { ok: true, day: today, ...computeStreak(owner) });
  }
  const cs = p.match(/^\/api\/v1\/checkin\/([\w:.-]+)$/);
  if (cs && req.method === 'GET') {
    return send(res, 200, { owner_token: cs[1], ...computeStreak(cs[1]) });
  }

  // ── 同频匹配
  const ms = p.match(/^\/api\/v1\/matches\/([\w:.-]+)$/);
  if (ms && req.method === 'GET') {
    const owner = ms[1];
    const myMarks = listMarksByOwner(owner);
    if (myMarks.length === 0) return send(res, 200, { matches: [] });
    // 用最近一张画作作为查询向量
    const me = myMarks[0];
    const myHist = colorHistogram(me);
    // 与所有公开 mark 比
    const candidates = listGallery({ page: 1, limit: 1000 })
      .filter(m => m.owner_token !== owner)
      .map(m => ({ mark: m, score: cosineSim(myHist, colorHistogram(m)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return send(res, 200, { matches: candidates, query_mark_id: me.id });
  }

  // ── 点赞
  if (p === '/api/v1/likes' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.mark_id) return send(res, 400, { error: 'mark_id required' });
    const owner = body.owner_token || getOwner(req);
    addLike({
      mark_id: body.mark_id, owner_token: owner,
      kind: body.kind || 'love', echo_color: body.echo_color || null,
      created_at: new Date().toISOString()
    });
    return send(res, 200, { ok: true, likes: countLikes(body.mark_id) });
  }
  if (p === '/api/v1/likes' && req.method === 'DELETE') {
    const owner = q.get('owner_token') || getOwner(req);
    removeLike(q.get('mark_id'), owner, q.get('kind') || 'love');
    return send(res, 200, { ok: true });
  }
  const lk = p.match(/^\/api\/v1\/marks\/([\w-]+)\/likes$/);
  if (lk && req.method === 'GET') {
    return send(res, 200, countLikes(lk[1]));
  }

  // ── 评论
  if (p === '/api/v1/comments' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.mark_id || !body.body) return send(res, 400, { error: 'mark_id + body required' });
    const owner = body.owner_token || getOwner(req);
    const c = {
      id: nid(), mark_id: body.mark_id, owner_token: owner,
      body: String(body.body).slice(0, 280),
      created_at: new Date().toISOString()
    };
    putComment(c);
    return send(res, 200, { ok: true, comment: c });
  }
  const cm = p.match(/^\/api\/v1\/marks\/([\w-]+)\/comments$/);
  if (cm && req.method === 'GET') {
    return send(res, 200, { comments: listCommentsByMark(cm[1]) });
  }

  // ── 漂移叙事（单人传声链的"漂移总结"）
  if (p === '/api/v1/drift' && req.method === 'POST') {
    const body = await readBody(req);
    if (!Array.isArray(body.hops) || body.hops.length === 0) {
      return send(res, 400, { error: 'hops required' });
    }
    const owner = body.owner_token || getOwner(req);
    const id = body.mark_id || nid();
    const personalities = dict('personalities');
    const lines = body.hops.map(h => {
      const p = personalities[h.personality];
      return `第${h.idx + 1}跳 ${p ? p.name : h.personality}：${p && p.drift_summary ? p.drift_summary : ''}`;
    });
    const summary = `从「${body.origin || '原曲'}」出发，${lines.join('；')}。`;
    putDriftChain({
      id, owner_token: owner, mark_id: id, summary,
      hops: body.hops, created_at: new Date().toISOString()
    });
    return send(res, 200, { ok: true, drift_id: id, summary });
  }

  // ── 静态资源
  if (p.startsWith(STATIC_PREFIX) && req.method === 'GET') {
    return serveStatic(res, p);
  }

  send(res, 404, { error: 'not found', path: p });
}

// ── 启动 ────────────────────────────────────────────────
openDb(DATA_PATH);
seedIfEmpty();
seedSocialIfEmpty();

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    console.error('[err]', e);
    send(res, 500, { error: e.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`▶ Tone-shift 后端在 http://${HOST}:${PORT}`);
  console.log(`  REST API  → http://${HOST}:${PORT}/api/v1/health`);
  console.log(`  静态入口  → http://${HOST}:${PORT}/index-modular.html`);
});
