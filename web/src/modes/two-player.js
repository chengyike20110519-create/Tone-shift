// web/src/modes/two-player.js
// 双人传声 2p（当前未发布，单设备 pass-and-play）。
// 真实分享链路见 ../worker/ + WORKER_DESIGN.md（v0.3 上线）。
// 代码保留以供 v0.3 对照实现。入口在 hub.js 被 disabled 拦截。

import { $, show, hexA, roundRect } from "../lib/dom.js";
import { WORD_BANK, PALETTE } from "../lib/data.js";
import { state } from "../state.js";
import { initAudio, startSong } from "../audio.js";
import { playTwoPMusic } from "../music.js";

const twoP = {
  phase: null,
  aWords: [],
  bStrokes: [],
  bColorIndex: 4,
  bDrawing: false,
  bLastPoint: null,
  bCurrentStrokePoints: null,
  bStrokeCount: 0,
  bMaxStrokes: 15,
  bDuration: 30,
  aStartTime: 0,
  bStartTime: 0,
  aTimerId: null,
  bTimerId: null,
  bWarnedAt5: false,
  canvasH: 400  // 暴露给 music.js
};

let twoPCanvas, twoPCtx, twoPW, twoPH, twoPDPR;
let listenersBound = false;
let _eventsBound = false;

function bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;
  $("twoPPlayBtn").addEventListener("click", () => {
    if (twoP.phase === "a-listen") twoPSongEnd();
    else twoPPlaySong();
  });
  $("twoPSkipBtn").addEventListener("click", twoPSongEnd);
  $("twoPSubmitBtn").addEventListener("click", submitAWords);
  $("twoPRetryBtn").addEventListener("click", () => startTwoP());
  $("twoPDownloadBtn").addEventListener("click", () => {
    const btn = $("twoPDownloadBtn");
    const orig = btn.innerHTML;
    btn.innerHTML = "生成中…";
    setTimeout(() => { downloadTwoPCard(); btn.innerHTML = orig; }, 60);
  });
  $("twoPPlayMusicBtn").addEventListener("click", () => {
    playTwoPMusic(twoP);
    const btn = $("twoPPlayMusicBtn");
    btn.disabled = true;
    btn.innerHTML = "播放中…";
    setTimeout(() => {
      btn.disabled = false;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> 听 20s 共创音乐';
    }, 21000);
  });
  $("twoPHomeBtn").addEventListener("click", () => {
    twoPReset();
    show("hubScreen");
  });
}

function twoPReset() {
  if (twoP.aTimerId) { clearInterval(twoP.aTimerId); twoP.aTimerId = null; }
  if (twoP.bTimerId) { clearInterval(twoP.bTimerId); twoP.bTimerId = null; }
  twoP.phase = null;
  twoP.aWords = [];
  twoP.bStrokes = [];
  twoP.bColorIndex = 4;
  twoP.bDrawing = false;
  twoP.bLastPoint = null;
  twoP.bCurrentStrokePoints = null;
  twoP.bStrokeCount = 0;
  twoP.bWarnedAt5 = false;
}

function twoPPlaySong() {
  if (!state.songBuffer) initAudio();
  if (!state.audioCtx) return;
  if (state.audioCtx.state === "suspended") state.audioCtx.resume();
  startSong(0);
  twoP.aStartTime = Date.now();
  twoP.phase = "a-listen";
  $("twoPSkipBtn").style.display = "inline-flex";
  if (twoP.aTimerId) clearInterval(twoP.aTimerId);
  twoP.aTimerId = setInterval(() => {
    const left = 30 - Math.floor((Date.now() - twoP.aStartTime) / 1000);
    if (left <= 0) { $("twoPATime").textContent = "0"; twoPSongEnd(); }
    else { $("twoPATime").textContent = left; }
  }, 250);
}

function twoPSongEnd() {
  if (twoP.aTimerId) { clearInterval(twoP.aTimerId); twoP.aTimerId = null; }
  if (state.src) { try { state.src.stop(); } catch (_) {} }
  twoP.phase = "a-pick";
  $("twoPSkipBtn").style.display = "none";
  $("twoPATime").textContent = "0";
}

function renderTwoPBank() {
  const bank = $("twoPBank");
  bank.innerHTML = "";
  WORD_BANK.forEach((word) => {
    const btn = document.createElement("button");
    btn.className = "word-btn";
    btn.type = "button";
    btn.textContent = word;
    btn.addEventListener("click", () => {
      if (twoP.phase === "b-draw" || twoP.phase === "reveal") return;
      const idx = twoP.aWords.indexOf(word);
      if (idx >= 0) {
        twoP.aWords.splice(idx, 1);
        btn.classList.remove("selected");
      } else if (twoP.aWords.length < 3) {
        twoP.aWords.push(word);
        btn.classList.add("selected");
      }
      bank.querySelectorAll(".word-btn").forEach((b) => {
        if (!twoP.aWords.includes(b.textContent) && twoP.aWords.length >= 3) {
          b.setAttribute("disabled", "");
        } else {
          b.removeAttribute("disabled");
        }
      });
      $("twoPACount").textContent = twoP.aWords.length;
      $("twoPSubmitBtn").disabled = twoP.aWords.length !== 3;
    });
    bank.appendChild(btn);
  });
}

function submitAWords() {
  if (twoP.aWords.length !== 3) return;
  startTwoPB();
}

function startTwoPB() {
  twoP.phase = "b-draw";
  show("twoPB");
  const wordsEl = $("twoPBWords");
  wordsEl.innerHTML = "";
  twoP.aWords.forEach((w) => {
    const chip = document.createElement("span");
    chip.className = "word-chip"; chip.textContent = w;
    wordsEl.appendChild(chip);
  });
  setupTwoPCanvas();
  renderTwoPPalette();
  twoP.bStrokes = [];
  twoP.bStrokeCount = 0;
  twoP.bWarnedAt5 = false;
  $("twoPBTime").textContent = "30";
  $("twoPBStrokes").textContent = "0";
  $("twoPBStrokes").parentElement.classList.remove("warn", "full");
  twoP.bStartTime = Date.now();
  if (twoP.bTimerId) clearInterval(twoP.bTimerId);
  twoP.bTimerId = setInterval(() => {
    const left = 30 - Math.floor((Date.now() - twoP.bStartTime) / 1000);
    if (left <= 0) { $("twoPBTime").textContent = "0"; finishTwoPB(); }
    else {
      $("twoPBTime").textContent = left;
      if (left <= 5 && !twoP.bWarnedAt5) {
        $("twoPBTime").parentElement.classList.add("warn");
        twoP.bWarnedAt5 = true;
      }
    }
  }, 250);
}

function setupTwoPCanvas() {
  twoPCanvas = $("twoPCanvas");
  twoPCtx = twoPCanvas.getContext("2d");
  twoPDPR = Math.min(window.devicePixelRatio || 1, 2);
  const rect = twoPCanvas.getBoundingClientRect();
  twoPW = rect.width; twoPH = rect.height;
  twoP.canvasH = twoPH;
  twoPCanvas.width = Math.round(twoPW * twoPDPR);
  twoPCanvas.height = Math.round(twoPH * twoPDPR);
  twoPCtx.setTransform(twoPDPR, 0, 0, twoPDPR, 0, 0);
  twoPCtx.clearRect(0, 0, twoPW, twoPH);

  if (listenersBound) return;
  listenersBound = true;

  const getPos = (e) => {
    const r = twoPCanvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const onDown = (e) => {
    e.preventDefault();
    if (twoP.phase !== "b-draw") return;
    if (twoP.bStrokeCount >= twoP.bMaxStrokes) return;
    twoP.bDrawing = true;
    twoP.bLastPoint = getPos(e);
    twoP.bCurrentStrokePoints = [{ x: twoP.bLastPoint.x, y: twoP.bLastPoint.y }];
  };
  const onMove = (e) => {
    if (!twoP.bDrawing) return;
    e.preventDefault();
    const p = getPos(e);
    drawTwoPSegment(twoP.bLastPoint, p);
    twoP.bCurrentStrokePoints.push({ x: p.x, y: p.y });
    twoP.bLastPoint = p;
  };
  const onUp = () => {
    if (!twoP.bDrawing) return;
    twoP.bDrawing = false;
    const stroke = { color: PALETTE[twoP.bColorIndex].color, points: twoP.bCurrentStrokePoints };
    twoP.bStrokes.push(stroke);
    twoP.bCurrentStrokePoints = null;
    twoP.bLastPoint = null;
    twoP.bStrokeCount++;
    $("twoPBStrokes").textContent = twoP.bStrokeCount;
    if (twoP.bStrokeCount >= twoP.bMaxStrokes) {
      $("twoPBStrokes").parentElement.classList.add("full");
      setTimeout(finishTwoPB, 400);
    }
  };

  twoPCanvas.addEventListener("mousedown", onDown);
  twoPCanvas.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  twoPCanvas.addEventListener("touchstart", onDown, { passive: false });
  twoPCanvas.addEventListener("touchmove", onMove, { passive: false });
  twoPCanvas.addEventListener("touchend", onUp);
}

function drawTwoPSegment(a, b) {
  const color = PALETTE[twoP.bColorIndex].color;
  const w = 6;
  twoPCtx.lineCap = "round";
  twoPCtx.lineJoin = "round";
  twoPCtx.strokeStyle = hexA(color, 0.55);
  twoPCtx.lineWidth = w;
  twoPCtx.beginPath();
  twoPCtx.moveTo(a.x, a.y);
  twoPCtx.lineTo(b.x, b.y);
  twoPCtx.stroke();
}

function renderTwoPPalette() {
  const pal = $("twoPPalette");
  pal.innerHTML = "";
  PALETTE.forEach((p, i) => {
    const s = document.createElement("div");
    s.className = "swatch" + (i === twoP.bColorIndex ? " active" : "");
    s.style.background = p.color;
    s.addEventListener("click", () => {
      twoP.bColorIndex = i;
      pal.querySelectorAll(".swatch").forEach((el, j) => {
        el.classList.toggle("active", j === i);
      });
    });
    pal.appendChild(s);
  });
}

function finishTwoPB() {
  if (twoP.phase === "reveal") return;
  if (twoP.bTimerId) { clearInterval(twoP.bTimerId); twoP.bTimerId = null; }
  twoP.phase = "reveal";
  showTwoPReveal();
}

function showTwoPReveal() {
  show("twoPReveal");
  const wordsEl = $("twoPRevealWords");
  wordsEl.innerHTML = "";
  twoP.aWords.forEach((w) => {
    const chip = document.createElement("span");
    chip.className = "word-chip"; chip.textContent = w;
    wordsEl.appendChild(chip);
  });
  setTimeout(renderTwoPRevealArt, 50);
  const btn = $("twoPPlayMusicBtn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> 听 20s 共创音乐';
  }
}

function renderTwoPRevealArt() {
  const cv = $("twoPRevealCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const container = cv.parentElement;
  const w = container.clientWidth || 300;
  const h = container.clientHeight || 200;
  cv.width = Math.round(w * 2);
  cv.height = Math.round(h * 2);
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const srcW = twoPW || w, srcH = twoPH || h;
  const scale = Math.min(w / srcW, h / srcH);
  const offX = (w - srcW * scale) / 2;
  const offY = (h - srcH * scale) / 2;
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);
  twoP.bStrokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length < 2) return;
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1], b = stroke.points[i];
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = hexA(stroke.color, 0.55);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  });
  ctx.restore();
}

// 漂移图卡下载
function downloadTwoPCard() {
  if (!twoP.aWords.length) return;

  const W = 800, H = 1000;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08091a"); bg.addColorStop(1, "#101a2e");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#78d8d2";
  ctx.font = '600 18px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("声 痕  ·  漂 移", W / 2, 80);
  ctx.strokeStyle = "rgba(120,216,210,0.3)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 100, 100); ctx.lineTo(W / 2 + 100, 100); ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "13px -apple-system,sans-serif"; ctx.textAlign = "left";
  ctx.fillText("A 听到的是 30s 氛围  →  凭直觉选了 3 个词", 60, 150);

  const chipW = 180, chipH = 70, chipGap = 24;
  const totalW = chipW * 3 + chipGap * 2;
  const startX = (W - totalW) / 2;
  twoP.aWords.forEach((word, i) => {
    const x = startX + i * (chipW + chipGap);
    const y = 180;
    ctx.fillStyle = "rgba(120,216,210,0.15)";
    roundRect(ctx, x, y, chipW, chipH, 10); ctx.fill();
    ctx.strokeStyle = "#78d8d2"; ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, chipW, chipH, 10); ctx.stroke();
    ctx.fillStyle = "#78d8d2";
    ctx.font = '700 28px -apple-system,"PingFang SC",sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(word, x + chipW / 2, y + chipH / 2);
  });

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "18px -apple-system,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("↓  B 看到词后画的  ↓", W / 2, 300);

  const frameX = 80, frameY = 340, frameW = W - 160, frameH = 460;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
  roundRect(ctx, frameX, frameY, frameW, frameH, 12);
  ctx.fill(); ctx.stroke();

  const srcW = twoPW || 600, srcH = twoPH || 400;
  const scale = Math.min((frameW - 30) / srcW, (frameH - 30) / srcH);
  const offX = frameX + (frameW - srcW * scale) / 2;
  const offY = frameY + (frameH - srcH * scale) / 2;
  ctx.save(); ctx.translate(offX, offY); ctx.scale(scale, scale);
  twoP.bStrokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length < 2) return;
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1], b = stroke.points[i];
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = hexA(stroke.color, 0.78); ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  });
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = '14px -apple-system,"PingFang SC",sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("词是压缩，画是展开 — 漂移在这里。", W / 2, 850);
  ctx.strokeStyle = "rgba(120,216,210,0.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 60, 880); ctx.lineTo(W / 2 + 60, 880); ctx.stroke();
  ctx.fillStyle = "rgba(120,216,210,0.55)";
  ctx.font = "600 13px -apple-system,sans-serif";
  ctx.fillText("声痕  ·  Sound Mark", W / 2, 915);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = '11px -apple-system,"PingFang SC",sans-serif';
  ctx.fillText("两人接力 · 一首歌从原曲漂移到画", W / 2, 945);

  cv.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "双人传声-" + twoP.aWords.join("-") + ".png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

export function startTwoP() {
  bindEvents();
  twoPReset();
  twoP.phase = "a-listen";
  show("twoPA");
  $("twoPATime").textContent = "30";
  $("twoPACount").textContent = "0";
  $("twoPSubmitBtn").disabled = true;
  $("twoPSkipBtn").style.display = "none";
  renderTwoPBank();
  setTimeout(twoPPlaySong, 100);
}
