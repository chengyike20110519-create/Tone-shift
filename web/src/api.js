// web/src/api.js
// 前端唯一的数据访问层：字典、声痕卡、打卡、点赞、评论、同频匹配、漂移叙事，
// 全部通过后端 REST API 读写。前端不再持有任何业务字典 / 数据的硬编码副本。

import {
  PALETTE, RECOMMENDED_INDEX, LISTEN_END, PAINT_END,
  PERSONALITIES, WORD_BANK, MEM_COLORS, MEM_ERAS, MOCK_SONGS,
  COPY,
  markReady
} from "./dict_cache.js";

const API_BASE = "/api/v1";
const OWNER_KEY = "toneShiftOwner";

let ownerToken = null;

function ensureToken() {
  if (ownerToken) return ownerToken;
  let t = null;
  try { t = localStorage.getItem(OWNER_KEY); } catch (_) {}
  if (!t) {
    t = "web:" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    try { localStorage.setItem(OWNER_KEY, t); } catch (_) {}
  }
  ownerToken = t;
  return t;
}

async function request(path, { method = "GET", body, query } = {}) {
  let url = API_BASE + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += "?" + qs;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Owner-Token": ensureToken()
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!res.ok) {
    const err = new Error((data && data.error) || ("HTTP " + res.status));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// 启动：从后端拉取全部字典并写入前端字典缓存。
export async function init() {
  const [palette, words, personalities, memOptions, mockSongs, timeConfig, copy] = await Promise.all([
    request("/palette"),
    request("/words"),
    request("/personalities"),
    request("/mem-options"),
    request("/mock-songs"),
    request("/time-config"),
    request("/copy")
  ]);

  PALETTE.length = 0;
  PALETTE.push(...(palette.palette || []));
  WORD_BANK.length = 0;
  WORD_BANK.push(...(words.words || []));
  for (const k of Object.keys(PERSONALITIES)) delete PERSONALITIES[k];
  // 后端字段是 snake_case，前端业务用 camelCase；这里做一次 normalize
  const camelKeys = {
    preferred_words: "preferredWords",
    voice_lines: "voiceLines",
    draw_style: "drawStyle",
    drift_summary: "driftSummary"
  };
  const normPersonality = (raw) => {
    const o = {};
    for (const [k, v] of Object.entries(raw)) o[camelKeys[k] || k] = v;
    return o;
  };
  const rawPersonas = personalities.personalities || {};
  for (const [k, v] of Object.entries(rawPersonas)) PERSONALITIES[k] = normPersonality(v);
  MEM_COLORS.length = 0;
  MEM_COLORS.push(...(memOptions.colors || []));
  MEM_ERAS.length = 0;
  MEM_ERAS.push(...(memOptions.eras || []));
  MOCK_SONGS.length = 0;
  MOCK_SONGS.push(...(mockSongs.songs || []));
  for (const k of Object.keys(COPY)) delete COPY[k];
  const incoming = copy.copy || {};
  for (const [k, v] of Object.entries(incoming)) COPY[k] = v;

  RECOMMENDED_INDEX = palette.recommended_index ?? 4;
  LISTEN_END = timeConfig.listen_end ?? 30;
  PAINT_END = timeConfig.paint_end ?? 18;

  markReady();
}

// ── 声痕卡 ────────────────────────────────────────────
export async function saveMark(partial) {
  const res = await request("/marks", {
    method: "POST",
    body: {
      id: partial.id,
      mode: partial.mode,
      title: partial.title ?? null,
      is_public: !!partial.is_public,
      palette: partial.palette || null,
      stats: partial.stats || null,
      summary: partial.summary || null,
      thumb: partial.thumb || null,
      created_at: partial.created_at
    }
  });
  return res.mark;
}

export async function fetchMark(id) {
  const res = await request("/marks/" + encodeURIComponent(id));
  return res.mark;
}

export async function editMark(id, patch) {
  const res = await request("/marks/" + encodeURIComponent(id), { method: "PATCH", body: patch });
  return res.mark;
}

export async function removeMark(id) {
  return request("/marks/" + encodeURIComponent(id), { method: "DELETE" });
}

export async function myMarks() {
  const res = await request("/marks", { query: { owner_token: ensureToken() } });
  return res.marks || [];
}

export async function gallery({ mode = null } = {}) {
  const res = await request("/gallery", { query: mode ? { mode } : {} });
  return res.marks || [];
}

export async function topics() {
  const res = await request("/topics");
  return res.topics || [];
}

// ── 打卡 / 连续记录 ─────────────────────────────────────
export async function checkin(mark_id = null) {
  return request("/checkin", { method: "POST", body: { mark_id } });
}

export async function streak() {
  return request("/checkin/" + encodeURIComponent(ensureToken()));
}

export async function myCheckinDays() {
  const s = await streak();
  return s.days || [];
}

// ── 点赞 / 回声 ────────────────────────────────────────
export async function like(mark_id) {
  const res = await request("/likes", { method: "POST", body: { mark_id, kind: "love" } });
  return res.likes;
}

export async function unlike(mark_id) {
  await request("/likes", { method: "DELETE", query: { mark_id, kind: "love" } });
  return likesOf(mark_id);
}

export async function echo(mark_id, color) {
  const res = await request("/likes", {
    method: "POST",
    body: { mark_id, kind: "echo", echo_color: color }
  });
  return res.likes;
}

export async function likesOf(mark_id) {
  const c = await request("/marks/" + encodeURIComponent(mark_id) + "/likes");
  return { love: c.love || 0, echo: c.echo || 0 };
}

// ── 评论 ───────────────────────────────────────────────
export async function comment(mark_id, body) {
  const res = await request("/comments", {
    method: "POST",
    body: { mark_id, body: String(body).slice(0, 280) }
  });
  return res.comment;
}

export async function commentsOf(mark_id) {
  const res = await request("/marks/" + encodeURIComponent(mark_id) + "/comments");
  return res.comments || [];
}

// ── 同频匹配 ──────────────────────────────────────────
export async function matches() {
  return request("/matches/" + encodeURIComponent(ensureToken()));
}

// ── 漂移叙事 ──────────────────────────────────────────
export async function makeDriftSummary({ origin, hops }) {
  const res = await request("/drift", { method: "POST", body: { origin, hops } });
  return res.summary;
}
