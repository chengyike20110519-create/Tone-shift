// memory-archaeology.js
// 记忆考古模式：画旋律轮廓 → 选颜色/年代 → 匹配候选歌曲

import { $, show } from "../lib/dom.js";
import { MEM_COLORS, MEM_ERAS, MOCK_SONGS } from "../lib/data.js";
import { enterHub } from "./hub.js";

// 字典常量（MEM_COLORS / MEM_ERAS / MOCK_SONGS）来自后端 /api/v1/*，
// 由 web/src/api.js#init() 异步填充到 web/src/dict_cache.js 占位符，再由本文件 import 拿到。

let canvas, ctx, isDrawing = false, points = [];
let selectedColor = null, selectedEra = null;
let _eventsBound = false;

function reset() {
  points = [];
  selectedColor = null;
  selectedEra = null;
  isDrawing = false;
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  // 不要 show("memStep1")——它会把外层 memArchScreen 也给藏了。
  // 只切 memStep1/2/3 自己的 hidden。
  document.getElementById("memStep1").classList.remove("hidden");
  document.getElementById("memStep2").classList.add("hidden");
  document.getElementById("memStep3").classList.add("hidden");
  $("memArchNext").disabled = true;
}

function initCanvas() {
  canvas = $("memArchCanvas");
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = "rgba(120,216,210,0.7)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function renderColorPick() {
  const wrap = $("memColorPick");
  if (!wrap) return;
  wrap.innerHTML = "";
  MEM_COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "swatch" + (i === selectedColor ? " active" : "");
    b.style.cssText = `width:36px;height:36px;border-radius:50%;border:2px solid ${i === selectedColor ? '#fff' : 'rgba(255,255,255,0.15)'};background:${c.color};cursor:pointer;transition:border-color .15s;`;
    b.title = c.name;
    b.addEventListener("click", () => {
      selectedColor = i;
      renderColorPick();
    });
    wrap.appendChild(b);
  });
}

function renderEraPick() {
  const wrap = $("memEraPick");
  if (!wrap) return;
  wrap.innerHTML = "";
  MEM_ERAS.forEach((e, i) => {
    const b = document.createElement("button");
    b.className = "btn small" + (i === selectedEra ? " primary" : " ghost");
    b.textContent = e;
    b.addEventListener("click", () => {
      selectedEra = i;
      renderEraPick();
    });
    wrap.appendChild(b);
  });
}

function drawMelodyPreview() {
  if (!canvas || !ctx || points.length < 2) return;
  ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function showResults() {
  const colorName = selectedColor != null ? MEM_COLORS[selectedColor].name : null;
  const eraName = selectedEra != null ? MEM_ERAS[selectedEra] : null;

  const candidates = (MOCK_SONGS || [])
    .map((song) => {
      let score = 0;
      if (colorName && Array.isArray(song.mood) && song.mood.includes(colorName)) score += 3;
      if (eraName && song.era === eraName) score += 2;
      if (points.length >= 2) score += contourSimilarity(points, song.contour);
      return { song, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const wrap = $("memResults");
  wrap.innerHTML = "";

  candidates.forEach((item) => {
    const c = item.song;
    const match = Math.min(98, Math.round(55 + item.score * 8));
    const el = document.createElement("div");
    el.className = "mem-result";
    el.innerHTML =
      '<div>' +
        '<p class="mem-result-title">' + (c.title || "") + '</p>' +
        '<p class="mem-result-sub">' + (c.artist || "") + ' · ' + (c.era || "") + '</p>' +
      '</div>' +
      '<div class="mem-result-right">' +
        '<span class="mem-result-score">' + match + '%</span>' +
        '<button class="btn small ghost mem-listen" type="button">试听</button>' +
      '</div>';
    el.querySelector(".mem-listen").addEventListener("click", () => playSongContour(c));
    wrap.appendChild(el);
  });

  const fallback = document.createElement("div");
  fallback.className = "mem-result mem-fallback";
  fallback.innerHTML =
    '<div><p class="mem-result-title">记忆近似曲</p><p class="mem-result-sub">基于你的轮廓生成的一段近似旋律</p></div>' +
    '<button class="btn small primary mem-approx" type="button">试听</button>';
  fallback.querySelector(".mem-approx").addEventListener("click", playApprox);
  wrap.appendChild(fallback);

  document.getElementById("memStep2").classList.add("hidden");
  document.getElementById("memStep3").classList.remove("hidden");
}

function contourSimilarity(pts, contour) {
  if (!Array.isArray(contour) || contour.length < 2 || pts.length < 2) return 0;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const minC = Math.min(...contour), maxC = Math.max(...contour);
  const spanC = maxC - minC || 1;

  const n = Math.min(contour.length, 16);
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const targetX = minX + t * spanX;
    let nearest = null, nearestD = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.x - targetX);
      if (d < nearestD) { nearestD = d; nearest = p; }
    }
    const userNorm = 1 - (nearest.y - minY) / spanY;
    const songNorm = (contour[Math.round(t * (contour.length - 1))] - minC) / spanC;
    diff += Math.abs(userNorm - songNorm);
  }
  const sim = Math.max(0, 1 - diff / n);
  return sim * 5;
}

function playSongContour(song) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !Array.isArray(song.contour)) return;
  const ctx = new AC();
  const now = ctx.currentTime;
  song.contour.forEach((midi, i) => {
    const t = now + i * 0.14;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.24);
  });
}

function playApprox() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const now = ctx.currentTime;
  const pts = points.length >= 2 ? points : [{ x: 0, y: 100 }, { x: 100, y: 40 }, { x: 200, y: 80 }];
  const ys = pts.map((p) => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  pts.slice(0, 12).forEach((p, i) => {
    const t = now + i * 0.18;
    const norm = 1 - (p.y - minY) / span;
    const freq = 220 + norm * 440;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.32);
  });
}

function bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  $("memArchClear").addEventListener("click", () => {
    points = [];
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    $("memArchNext").disabled = true;
  });

  $("memArchNext").addEventListener("click", () => {
    if (!canvas || !ctx || points.length < 2) return;
    document.getElementById("memStep1").classList.add("hidden");
    document.getElementById("memStep2").classList.remove("hidden");
    renderColorPick();
    renderEraPick();
  });

  $("memArchBack").addEventListener("click", () => {
    document.getElementById("memStep2").classList.add("hidden");
    document.getElementById("memStep1").classList.remove("hidden");
  });

  $("memArchSearch").addEventListener("click", () => {
    showResults();
  });

  $("memArchRetry").addEventListener("click", reset);
  $("memArchHome").addEventListener("click", () => {
    reset();
    enterHub();
  });

  // Canvas drawing
  const container = $("memArchCanvas");
  if (!container) return;
  container.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    isDrawing = true;
    const rect = container.getBoundingClientRect();
    points = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
    $("memArchHint").style.display = "none";
    $("memArchNext").disabled = false;
  });
  container.addEventListener("pointermove", (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    points.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    drawMelodyPreview();
  });
  const endDraw = () => { isDrawing = false; };
  container.addEventListener("pointerup", endDraw);
  container.addEventListener("pointercancel", endDraw);
}

export function enterMemoryArchaeology() {
  show("memArchScreen");
  initCanvas();
  reset();
  bindEvents();
}
