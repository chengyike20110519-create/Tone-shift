// web/src/analyze.js
// 自由听画 result phase：色彩分析 + 情绪判定 + 图卡下载。

import { $, clamp } from "./lib/dom.js";
import { paintCanvas, paintCtx, state } from "./state.js";
import * as api from "./api.js";
import { COPY } from "./lib/data.js";

// 文案默认走后端 copy.endings；前端空兜底是当前文案，正式发版后可全走后端
const ENDINGS = COPY.endings || {
  reconcile: { name: "和解",   desc: "你用力画下暖色。她在这首歌里留下一个拥抱，说：我原谅了。" },
  farewell:  { name: "告别",   desc: "你画得很轻，像怕惊动任何人。她走的时候，没有回头。" },
  stay:      { name: "留下",   desc: "你既没有用力，也没有放手。这首歌没有答案，但还在等你画完。" }
};

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: h, s: s, v: max };
}

export function analyze() {
  const w = paintCanvas.width;
  const h = paintCanvas.height;
  const data = paintCtx.getImageData(0, 0, w, h).data;

  let warm = 0, cool = 0, painted = 0, total = 0;
  const bucketMap = new Map();

  for (let y = 0; y < h; y += 5) {
    for (let x = 0; x < w; x += 5) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      total++;
      if (a < 26) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max < 10) continue;
      painted++;

      const hsv = rgbToHsv(r, g, b);
      if (hsv.s < 0.12) { warm += 0.4; cool += 0.6; }
      else if (hsv.h <= 50 || hsv.h >= 330) warm += 1;
      else if (hsv.h >= 150 && hsv.h <= 285) cool += 1;
      else { warm += 0.3; cool += 0.7; }

      const key = Math.round(r / 34) * 34 + "," + Math.round(g / 34) * 34 + "," + Math.round(b / 34) * 34;
      bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
    }
  }

  const coverage = painted / total;
  const warmRatio = warm + cool > 0 ? warm / (warm + cool) : 0.5;

  // 取 5 个差异最大的主色
  const sorted = [...bucketMap.entries()].sort((a, b) => b[1] - a[1]);
  const swatches = [];
  for (let i = 0; i < sorted.length; i++) {
    const parts = sorted[i][0].split(",");
    const rgb = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    let far = true;
    for (let j = 0; j < swatches.length; j++) {
      const c = swatches[j];
      if (Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2]) <= 70) { far = false; break; }
    }
    if (far) swatches.push(rgb);
    if (swatches.length >= 5) break;
  }
  if (swatches.length < 3) {
    swatches.push([255, 107, 107], [255, 179, 107], [94, 172, 255]);
  }

  // 笔压 / 速度 → 强度
  let presSum = 0, presN = 0, speedSum = 0, speedN = 0;
  for (let i = 0; i < state.strokes.length; i++) {
    const pts = state.strokes[i].points;
    for (let j = 0; j < pts.length; j++) {
      presSum += pts[j].p; presN++;
      speedSum += pts[j].v;
      if (pts[j].v > 0) speedN++;
    }
  }
  const avgPressure = presN ? presSum / presN : 0.5;
  const avgSpeed = speedN ? speedSum / speedN : 200;
  const intensity = clamp(avgPressure * 0.6 + Math.min(1, avgSpeed / 1500) * 0.4, 0, 1);
  const strokeCount = state.strokes.length;

  // 情绪判定
  let mood;
  if (warmRatio >= 0.58 && intensity >= 0.55) mood = "炽热";
  else if (warmRatio >= 0.52) mood = "温暖";
  else if (warmRatio <= 0.42 && intensity <= 0.48) mood = "沉静";
  else if (warmRatio <= 0.48) mood = "游离";
  else mood = "交错";

  let ending;
  if (warmRatio >= 0.55 && intensity >= 0.55) ending = "reconcile";
  else if (warmRatio < 0.45 && intensity < 0.5) ending = "farewell";
  else ending = "stay";

  return {
    warmRatio: intensity > 0 ? warmRatio : 0.4,
    intensity, coverage, swatches, mood, ending,
    avgPressure, avgSpeed, strokeCount
  };
}

export async function renderResult() {
  const titleInput = $("resultTitle");
  if (titleInput) {
    titleInput.value = "";
    titleInput.placeholder = "此刻的歌…";
  }
  const privacySeg = $("resultPrivacy");
  if (privacySeg) {
    privacySeg.querySelectorAll(".privacy-opt").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-privacy") === "public");
    });
  }
  refreshResultStreak();
  const r = state.result;
  $("resultMood").textContent = r.mood;

  const sw = $("swatches");
  sw.innerHTML = "";
  r.swatches.forEach((c) => {
    const el = document.createElement("i");
    el.style.background = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
    sw.appendChild(el);
  });

  const list = $("endingList");
  list.innerHTML = "";
  Object.keys(ENDINGS).forEach((key) => {
    const e = ENDINGS[key];
    const div = document.createElement("div");
    div.className = "ending" + (key === r.ending ? " achieved" : "");
    div.innerHTML =
      "<span class='e-name'>" + e.name + "</span>" +
      "<span class='e-desc'>" + e.desc + "</span>" +
      "<span class='e-tag'>" + (key === r.ending ? "你走到了这里" : "另一种可能") + "</span>";
    list.appendChild(div);
  });

  $("statRow").textContent =
    "暖色 " + Math.round(r.warmRatio * 100) + "% · " +
    "强度 " + r.intensity.toFixed(2) + " · " +
    "覆盖 " + Math.round(r.coverage * 100) + "% · " +
    r.strokeCount + " 笔";

  drawResultArt();
}

async function refreshResultStreak() {
  const streakEl = $("resultStreak");
  if (!streakEl) return;
  streakEl.textContent = "连续打卡 … 天";
  try {
    const s = await api.streak();
    streakEl.textContent = "连续打卡 " + (s.current_streak || 0) + " 天";
  } catch (_) {
    streakEl.textContent = "连续打卡 0 天";
  }
}

export function drawResultArt() {
  const c = $("resultArt");
  const cw = c.clientWidth || 320;
  const ch = c.clientHeight || 400;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(cw * dpr);
  c.height = Math.round(ch * dpr);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, cw, ch);
  g.addColorStop(0, "#0a0d16");
  g.addColorStop(1, "#101628");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  const W = window.innerWidth, H = window.innerHeight;
  const scale = Math.min(cw / W, ch / H) * 0.9;
  const dw = W * scale, dh = H * scale;
  ctx.drawImage(paintCanvas, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1);
}


function buildResultCanvas() {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1440;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 1080, 1440);
  g.addColorStop(0, "#0a0d16"); g.addColorStop(1, "#101628");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1440);
  const W = window.innerWidth, H = window.innerHeight;
  const scale = Math.min(880 / W, 1180 / H);
  const dw = W * scale, dh = H * scale;
  ctx.drawImage(paintCanvas, (1080 - dw) / 2, (220 - dh) / 2 + 140, dw, dh);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(100, 120, 880, 1180);
  return c;
}

// 把这张声痕落到后端（finish 时立刻调一次，downloadCard 复用）
// 同一张 result 只保存一次（用 r.savedMarkId 标记）
export async function ensureSaved({ title, isPublic }) {
  const r = state.result;
  if (!r) return null;
  if (r.savedMarkId) return r.savedMarkId;
  try {
    const c = buildResultCanvas();
    const thumb = makeThumbnail(c);
    const stats = {
      warmRatio: r.warmRatio,
      intensity: r.intensity,
      coverage: r.coverage,
      strokeCount: r.strokeCount,
      avgPressure: r.avgPressure,
      avgSpeed: r.avgSpeed,
      swatches: r.swatches,
      colorHist: computeColorHist(r.swatches)
    };
    const mark = await api.saveMark({
      mode: "free-draw",
      title: title || (COPY.defaults && COPY.defaults.free_draw_title) || "旧手机里的第一首歌",
      is_public: !!isPublic,
      stats,
      summary: { mood: r.mood, ending: r.ending },
      thumb
    });
    r.savedMarkId = mark.id;
    try { await api.checkin(mark.id); } catch (e) { console.warn("[analyze] 打卡失败:", e); }
    return mark.id;
  } catch (e) {
    console.warn("[analyze] 自动保存声痕失败:", e);
    return null;
  }
}

export async function downloadCard() {
  const r = state.result;
  if (!r) return;
  const titleEl = $("resultTitle");
  const title = titleEl && titleEl.value.trim() ? titleEl.value.trim() : ((COPY.defaults && COPY.defaults.free_draw_title) || "旧手机里的第一首歌");
  const privacy = getPrivacy();

  // 同一张 result 已经 ensureSaved 过了，这里不会重复保存到后端
  const c = buildResultCanvas();

  ctx.fillStyle = "#eef1f7";
  ctx.font = "700 56px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Tone-Shift · " + title, 540, 1360);

  ctx.font = "400 30px 'PingFang SC','Microsoft YaHei',sans-serif";
  ctx.fillStyle = "#8b93a7";
  ctx.fillText("情绪标签 · " + r.mood + " · " + (privacy === "public" ? "公开发布" : "仅自己可见"), 540, 1410);

  const x0 = 540 - (r.swatches.length * 56 - (r.swatches.length > 1 ? 12 : 0)) / 2;
  r.swatches.forEach((cr, i) => {
    ctx.fillStyle = "rgb(" + cr[0] + "," + cr[1] + "," + cr[2] + ")";
    ctx.beginPath();
    ctx.arc(x0 + i * 56, 222, 22, 0, Math.PI * 2);
    ctx.fill();
  });

  const a = document.createElement("a");
  a.download = "Tone-Shift-" + title + ".png";
  a.href = c.toDataURL("image/png");
  a.click();

  // 已经 ensureSaved 过了，这里只刷新 streak 显示
  await refreshResultStreak();
}

let _privacyBound = false;
export function bindPrivacy() {
  if (_privacyBound) return;
  _privacyBound = true;
  const seg = $("resultPrivacy");
  if (!seg) return;
  seg.querySelectorAll(".privacy-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      seg.querySelectorAll(".privacy-opt").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
    });
  });
}

function getPrivacy() {
  const active = document.querySelector("#resultPrivacy .privacy-opt.active");
  return active ? active.getAttribute("data-privacy") : "public";
}

function computeColorHist(swatches) {
  const buckets = { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, purple: 0 };
  const palette = [
    { key: "red", rgb: [255, 107, 107] },
    { key: "orange", rgb: [255, 179, 107] },
    { key: "yellow", rgb: [255, 217, 119] },
    { key: "green", rgb: [94, 234, 212] },
    { key: "blue", rgb: [91, 140, 255] },
    { key: "purple", rgb: [167, 139, 250] }
  ];
  (swatches || []).forEach((rgb) => {
    let best = null, bestD = Infinity;
    for (const p of palette) {
      const d = Math.hypot(rgb[0] - p.rgb[0], rgb[1] - p.rgb[1], rgb[2] - p.rgb[2]);
      if (d < bestD) { bestD = d; best = p.key; }
    }
    if (best) buckets[best] += 1;
  });
  const total = Math.max(1, (swatches || []).length);
  for (const k of Object.keys(buckets)) buckets[k] /= total;
  return buckets;
}

function makeThumbnail(srcCanvas) {
  const tw = 160, th = 200;
  const c = document.createElement("canvas");
  c.width = tw; c.height = th;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0a0d16";
  ctx.fillRect(0, 0, tw, th);
  try {
    ctx.drawImage(srcCanvas, 6, 6, tw - 12, th - 12);
  } catch (_) {}
  return c.toDataURL("image/jpeg", 0.72);
}
