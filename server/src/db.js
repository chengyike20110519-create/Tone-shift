// server/src/db.js
// 后端 DB —— 单 JSON 文件 + 进程内内存缓存。
// 设计取舍：demo 场景下，单进程读写足够；写是原子的（先写临时文件再 rename）。
// 如果将来要支撑多进程 / 分布式，把这层换成 SQLite / Postgres 即可，调用方不变。

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_STATE = {
  // 字典（启动时由 seed.js 灌入；运行时通过 PUT /api/v1/admin/dicts/:key 修改）
  dicts: {
    palette: [],
    recommended_index: 4,
    listen_end: 30,
    paint_end: 18,
    personalities: {},
    word_bank: [],
    mem_colors: [],
    mem_eras: [],
    mock_songs: []
  },
  // 声痕卡（sound mark）
  marks: {},                      // id -> { id, mode, title, is_public, owner_token, palette, stats, summary, thumb, created_at }
  // 每日打卡
  checkins: {},                   // owner_token -> [ "YYYY-MM-DD", ... ]
  // 点赞
  likes: [],                      // [{ mark_id, owner_token, kind: "love"|"echo", echo_color, created_at }]
  // 评论
  comments: {},                   // id -> { id, mark_id, owner_token, body, created_at }
  // 漂移链
  drift_chains: {},               // id -> { id, owner_token, mark_id, summary, hops, created_at }
  // 话题挑战
  topic_challenges: []            // [{ id, week, title, prompt, hue_bias, created_at }]
};

let _state = null;
let _dbPath = null;

export function openDb(dbPath) {
  _dbPath = dbPath;
  mkdirSync(dirname(dbPath), { recursive: true });
  if (existsSync(dbPath)) {
    try {
      _state = JSON.parse(readFileSync(dbPath, 'utf8'));
      // 兼容旧文件：缺字段则补
      for (const k of Object.keys(DEFAULT_STATE)) {
        if (!(k in _state)) _state[k] = DEFAULT_STATE[k];
      }
    } catch (e) {
      console.warn('[db] 文件解析失败，重置', e.message);
      _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } else {
    _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    flush();
  }
  return _state;
}

export function getState() {
  if (!_state) throw new Error('DB not opened');
  return _state;
}

export function flush() {
  if (!_dbPath) return;
  const tmp = _dbPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(_state, null, 2));
  renameSync(tmp, _dbPath);
}

// ── 通用 CRUD ──────────────────────────────────────────────
export function dict(key) { return getState().dicts[key]; }
export function setDict(key, value) {
  getState().dicts[key] = value;
  flush();
}

export function putMark(m) {
  getState().marks[m.id] = m;
  flush();
}
export function getMark(id) { return getState().marks[id] || null; }
export function delMark(id) { delete getState().marks[id]; flush(); }

export function listMarksByOwner(owner) {
  return Object.values(getState().marks)
    .filter(m => m.owner_token === owner)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function listGallery({ page = 1, limit = 20, mode = null } = {}) {
  let arr = Object.values(getState().marks).filter(m => m.is_public);
  if (mode) arr = arr.filter(m => m.mode === mode);
  arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const start = (page - 1) * limit;
  return arr.slice(start, start + limit);
}

export function addCheckin(owner, day, mark_id) {
  const s = getState();
  if (!s.checkins[owner]) s.checkins[owner] = [];
  if (!s.checkins[owner].includes(day)) s.checkins[owner].push(day);
  // 记录当天对应的 mark
  s.checkins[owner + ':last_mark'] = mark_id || null;
  flush();
}
export function getCheckinDays(owner) {
  return getState().checkins[owner] || [];
}
export function getLastCheckinMark(owner) {
  return getState().checkins[owner + ':last_mark'] || null;
}

export function addLike(like) {
  const s = getState();
  // 同一 (mark_id, owner_token, kind) 去重
  const idx = s.likes.findIndex(l => l.mark_id === like.mark_id && l.owner_token === like.owner_token && l.kind === like.kind);
  if (idx >= 0) s.likes[idx] = like; else s.likes.push(like);
  flush();
}
export function removeLike(mark_id, owner_token, kind) {
  const s = getState();
  s.likes = s.likes.filter(l => !(l.mark_id === mark_id && l.owner_token === owner_token && l.kind === kind));
  flush();
}
export function countLikes(mark_id) {
  const s = getState();
  const own = s.likes.filter(l => l.mark_id === mark_id && l.kind === 'love').length;
  const echo = s.likes.filter(l => l.mark_id === mark_id && l.kind === 'echo').length;
  return { love: own, echo: echo };
}

export function putComment(c) { getState().comments[c.id] = c; flush(); }
export function listCommentsByMark(mark_id) {
  return Object.values(getState().comments)
    .filter(c => c.mark_id === mark_id)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export function putDriftChain(d) { getState().drift_chains[d.id] = d; flush(); }
export function getDriftChain(id) { return getState().drift_chains[id] || null; }

export function listTopics() {
  return getState().topic_challenges || [];
}

// 工具
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function dayBefore(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
export function computeStreak(owner) {
  const days = getCheckinDays(owner).slice().sort();
  if (days.length === 0) return { current_streak: 0, best_streak: 0, days: [] };
  // 连续：从今天往前推，遇到空缺就停
  let cur = 0;
  let cursor = todayStr();
  while (days.includes(cursor)) { cur++; cursor = dayBefore(cursor, 1); }
  // 最长
  const sorted = days.slice().sort();
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (dayBefore(sorted[i], 1) === sorted[i - 1]) { run++; best = Math.max(best, run); }
    else run = 1;
  }
  best = Math.max(best, run);
  return { current_streak: cur, best_streak: best, days };
}
