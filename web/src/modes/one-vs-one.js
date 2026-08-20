// web/src/modes/one-vs-one.js
// 1.1 单人传声链：4 跳接力（你选 1 跳 + 2-3 个 AI 听友填剩下的）。
//
// 阶段机：hopIndex 0..3，isUser=true 时你操作，=false 时 AI 操作。
// 偶数跳（0/2）= 选词，奇数跳（1/3）= 画图。
// 完成后揭晓 4 跳 + 听 20s 共创音乐。

import { $, show, hexA } from "../lib/dom.js";
import { WORD_BANK, PALETTE, PERSONALITIES } from "../lib/data.js";
import { state } from "../state.js";
import { initAudio, startSong } from "../audio.js";
import { playOneVsOneMusic } from "../music.js";
import { enterHub } from "./hub.js";

const oneVsOne = {
  userPosition: -1,                                  // 你选的位置（0..3）
  hopPersonalities: ["ai", "ai", "ai", "ai"],        // 4 跳是谁填
  words: [[], [], [], []],                            // 每跳选的 3 个词
  strokes: [[], [], [], []],                          // 每跳画的笔触
  voiceLines: [],
  hopIndex: 0,
  colorIndex: 4,
  drawing: false,
  lastPoint: null,
  currentStrokePoints: null,
  strokeCount: 0,
  maxStrokes: 15,
  startTime: 0,
  timerId: null,
  warned: false,
  canvasH: 400
};

let oneCanvasEl, oneCtxEl, oneW, oneH, oneDPR;
let listenersBound = false;
let _eventsBound = false;

function oneVsOneReset() {
  if (oneVsOne.timerId) { clearInterval(oneVsOne.timerId); oneVsOne.timerId = null; }
  oneVsOne.userPosition = -1;
  oneVsOne.hopPersonalities = ["ai", "ai", "ai", "ai"];
  oneVsOne.words = [[], [], [], []];
  oneVsOne.strokes = [[], [], [], []];
  oneVsOne.voiceLines = [];
  oneVsOne.hopIndex = 0;
  oneVsOne.colorIndex = 4;
  oneVsOne.drawing = false;
  oneVsOne.lastPoint = null;
  oneVsOne.currentStrokePoints = null;
  oneVsOne.strokeCount = 0;
  oneVsOne.warned = false;
}

// ===== AI 辅助 =====

function pickAIWords(personality, excludeWords) {
  const picks = [];
  let allWords = WORD_BANK.filter((w) => excludeWords.indexOf(w) < 0);
  let preferredLeft = personality.preferredWords.filter((w) => excludeWords.indexOf(w) < 0);
  while (picks.length < 3 && (allWords.length > 0 || preferredLeft.length > 0)) {
    const fromPreferred = preferredLeft.length > 0 && Math.random() < 0.6;
    let pool = fromPreferred ? preferredLeft : allWords;
    if (pool.length === 0) pool = preferredLeft.length > 0 ? preferredLeft : allWords;
    const word = pool[Math.floor(Math.random() * pool.length)];
    if (picks.indexOf(word) < 0) picks.push(word);
    allWords = allWords.filter((w) => w !== word);
    preferredLeft = preferredLeft.filter((w) => w !== word);
  }
  return picks;
}

function pickVoiceLine(personality) {
  return personality.voiceLines[Math.floor(Math.random() * personality.voiceLines.length)];
}

function aiDraw(personality) {
  const numStrokes = 4 + Math.floor(Math.random() * 9);
  const strokes = [];
  for (let i = 0; i < numStrokes; i++) {
    const colorIdx = personality.palette[Math.floor(Math.random() * personality.palette.length)];
    const color = PALETTE[colorIdx].color;
    strokes.push(generateAIStroke(color, personality.drawStyle));
  }
  return strokes;
}

function generateAIStroke(color, style) {
  const W = 600, H = 400;
  const points = [];
  if (style === "thick") {
    const sx = 100 + Math.random() * (W - 200);
    const sy = 100 + Math.random() * (H - 200);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) points.push({ x: sx + i * 60, y: sy + (Math.random() - 0.5) * 20 });
  } else if (style === "geometric") {
    const sx = 100 + Math.random() * (W - 200);
    const sy = 100 + Math.random() * (H - 200);
    const dx = (Math.random() - 0.5) * 200, dy = (Math.random() - 0.5) * 200;
    points.push({ x: sx, y: sy }, { x: sx + dx, y: sy + dy });
  } else if (style === "bold") {
    const sx = 100 + Math.random() * (W - 200);
    const sy = 100 + Math.random() * (H - 200);
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) points.push({ x: sx + (Math.random() - 0.5) * 200, y: sy + (Math.random() - 0.5) * 150 });
  } else if (style === "random") {
    const n = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) points.push({ x: Math.random() * W, y: Math.random() * H });
  } else if (style === "soft") {
    const cx = 100 + Math.random() * (W - 200);
    const cy = 100 + Math.random() * (H - 200);
    const r = 50 + Math.random() * 100;
    const a0 = Math.random() * Math.PI * 2;
    const n = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  } else {
    for (let i = 0; i < 5; i++) points.push({ x: Math.random() * W, y: Math.random() * H });
  }
  return { color: color, points: points };
}

// ===== UI 渲染 =====

function renderOneWordBank() {
  const bank = $("oneWordBank");
  bank.innerHTML = "";
  const hopIdx = oneVsOne.hopIndex;
  WORD_BANK.forEach((word) => {
    const btn = document.createElement("button");
    btn.className = "word-btn"; btn.type = "button"; btn.textContent = word;
    btn.addEventListener("click", () => {
      const cur = oneVsOne.words[hopIdx];
      const idx = cur.indexOf(word);
      if (idx >= 0) { cur.splice(idx, 1); btn.classList.remove("selected"); }
      else if (cur.length < 3) { cur.push(word); btn.classList.add("selected"); }
      bank.querySelectorAll(".word-btn").forEach((b) => {
        if (cur.indexOf(b.textContent) < 0 && cur.length >= 3) b.setAttribute("disabled", "");
        else b.removeAttribute("disabled");
      });
      $("oneWordCount").textContent = cur.length;
      $("oneWordSubmitBtn").disabled = cur.length !== 3;
    });
    bank.appendChild(btn);
  });
}

function submitOneWords() {
  if (oneVsOne.words[oneVsOne.hopIndex].length !== 3) return;
  showHop(oneVsOne.hopIndex + 1);
}

function setupOneCanvas() {
  oneCanvasEl = $("oneCanvas");
  oneCtxEl = oneCanvasEl.getContext("2d");
  oneDPR = Math.min(window.devicePixelRatio || 1, 2);
  const rect = oneCanvasEl.getBoundingClientRect();
  oneW = rect.width; oneH = rect.height;
  oneVsOne.canvasH = oneH;
  oneCanvasEl.width = Math.round(oneW * oneDPR);
  oneCanvasEl.height = Math.round(oneH * oneDPR);
  oneCtxEl.setTransform(oneDPR, 0, 0, oneDPR, 0, 0);
  oneCtxEl.clearRect(0, 0, oneW, oneH);
  oneVsOne.currentStrokePoints = null;
  if (listenersBound) return;
  listenersBound = true;

  const getPos = (e) => {
    const r = oneCanvasEl.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const onDown = (e) => {
    e.preventDefault();
    if (oneVsOne.hopIndex !== 1 && oneVsOne.hopIndex !== 3) return;
    if (oneVsOne.userPosition !== oneVsOne.hopIndex) return;
    if (oneVsOne.strokeCount >= oneVsOne.maxStrokes) return;
    oneVsOne.drawing = true;
    oneVsOne.lastPoint = getPos(e);
    oneVsOne.currentStrokePoints = [{ x: oneVsOne.lastPoint.x, y: oneVsOne.lastPoint.y }];
  };
  const onMove = (e) => {
    if (!oneVsOne.drawing) return;
    e.preventDefault();
    const p = getPos(e);
    drawOneSegment(oneVsOne.lastPoint, p);
    oneVsOne.currentStrokePoints.push({ x: p.x, y: p.y });
    oneVsOne.lastPoint = p;
  };
  const onUp = () => {
    if (!oneVsOne.drawing) return;
    oneVsOne.drawing = false;
    const stroke = { color: PALETTE[oneVsOne.colorIndex].color, points: oneVsOne.currentStrokePoints };
    oneVsOne.strokes[oneVsOne.hopIndex].push(stroke);
    oneVsOne.currentStrokePoints = null; oneVsOne.lastPoint = null;
    oneVsOne.strokeCount++;
    $("oneDrawStrokes").textContent = oneVsOne.strokeCount;
    if (oneVsOne.strokeCount >= oneVsOne.maxStrokes) {
      $("oneDrawStrokes").parentElement.classList.add("full");
      setTimeout(finishOneDraw, 400);
    }
  };
  oneCanvasEl.addEventListener("mousedown", onDown);
  oneCanvasEl.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  oneCanvasEl.addEventListener("touchstart", onDown, { passive: false });
  oneCanvasEl.addEventListener("touchmove", onMove, { passive: false });
  oneCanvasEl.addEventListener("touchend", onUp);
}

function drawOneSegment(a, b) {
  const color = PALETTE[oneVsOne.colorIndex].color;
  oneCtxEl.lineCap = "round"; oneCtxEl.lineJoin = "round";
  oneCtxEl.strokeStyle = hexA(color, 0.55); oneCtxEl.lineWidth = 6;
  oneCtxEl.beginPath();
  oneCtxEl.moveTo(a.x, a.y); oneCtxEl.lineTo(b.x, b.y);
  oneCtxEl.stroke();
}

function renderOnePalette() {
  const pal = $("onePalette");
  pal.innerHTML = "";
  PALETTE.forEach((p, i) => {
    const s = document.createElement("div");
    s.className = "swatch" + (i === oneVsOne.colorIndex ? " active" : "");
    s.style.background = p.color;
    s.addEventListener("click", () => {
      oneVsOne.colorIndex = i;
      pal.querySelectorAll(".swatch").forEach((el, j) => el.classList.toggle("active", j === i));
    });
    pal.appendChild(s);
  });
}

function finishOneDraw() {
  if (oneVsOne.timerId) { clearInterval(oneVsOne.timerId); oneVsOne.timerId = null; }
  showHop(oneVsOne.hopIndex + 1);
}

// ===== 阶段机 =====

function showHop(hopIndex) {
  if (hopIndex > 3) { showOneVsOneReveal(); return; }
  oneVsOne.hopIndex = hopIndex;
  const isUser = oneVsOne.hopPersonalities[hopIndex] === "user";
  const isWordHop = hopIndex === 0 || hopIndex === 2;

  if (isUser) {
    if (isWordHop) {
      show("oneWordHopScreen");
      $("oneWordHopKicker").textContent = "位置 " + (hopIndex + 1) + " · 你的回合 · 听歌选词";
      oneVsOne.words[hopIndex] = [];
      $("oneWordCount").textContent = "0";
      $("oneWordSubmitBtn").disabled = true;
      renderOneWordBank();
      if (hopIndex === 0) {
        if (!state.songBuffer) initAudio();
        if (state.audioCtx) {
          if (state.audioCtx.state === "suspended") state.audioCtx.resume();
          startSong(0);
        }
      }
    } else {
      show("oneDrawHopScreen");
      $("oneDrawHopKicker").textContent = "位置 " + (hopIndex + 1) + " · 你的回合 · 看词画图";
      const prevWords = oneVsOne.words[hopIndex - 1] || [];
      const wordsEl = $("oneDrawHopWords");
      wordsEl.innerHTML = "";
      prevWords.forEach((w) => {
        const chip = document.createElement("span");
        chip.className = "word-chip"; chip.textContent = w;
        wordsEl.appendChild(chip);
      });
      setupOneCanvas();
      renderOnePalette();
      oneVsOne.strokes[hopIndex] = [];
      oneVsOne.strokeCount = 0;
      $("oneDrawStrokes").textContent = "0";
      $("oneDrawTime").textContent = "30";
      $("oneDrawStrokes").parentElement.classList.remove("warn", "full");
      oneVsOne.startTime = Date.now();
      if (oneVsOne.timerId) clearInterval(oneVsOne.timerId);
      oneVsOne.timerId = setInterval(() => {
        const left = 30 - Math.floor((Date.now() - oneVsOne.startTime) / 1000);
        if (left <= 0) { $("oneDrawTime").textContent = "0"; finishOneDraw(); }
        else {
          $("oneDrawTime").textContent = left;
          if (left <= 5 && !oneVsOne.warned) {
            $("oneDrawTime").parentElement.classList.add("warn");
            oneVsOne.warned = true;
          }
        }
      }, 250);
    }
  } else {
    const personality = PERSONALITIES[oneVsOne.hopPersonalities[hopIndex]];
    show("oneAIScreen");
    $("oneAiName").textContent = personality.name;
    $("oneAiTask").textContent = isWordHop ? "正在选词..." : "正在画图...";
    $("oneAiKicker").textContent = "位置 " + (hopIndex + 1) + " · AI 听友";
    setTimeout(() => {
      if (isWordHop) {
        const prevWords = [];
        for (let k = 0; k < hopIndex; k++) {
          if (oneVsOne.words[k]) prevWords.push(...oneVsOne.words[k]);
        }
        oneVsOne.words[hopIndex] = pickAIWords(personality, prevWords);
        oneVsOne.voiceLines[hopIndex] = pickVoiceLine(personality);
      } else {
        oneVsOne.strokes[hopIndex] = aiDraw(personality);
        oneVsOne.voiceLines[hopIndex] = pickVoiceLine(personality);
      }
      showHop(hopIndex + 1);
    }, 1500);
  }
}

function startOneVsOne() {
  const posEl = document.querySelector(".one-pos-tile.selected");
  const persEls = document.querySelectorAll(".one-pers-tile.selected");
  if (!posEl || persEls.length < 2) return;
  oneVsOneReset();
  oneVsOne.userPosition = parseInt(posEl.getAttribute("data-pos"));
  const selectedIds = [];
  for (let i = 0; i < persEls.length; i++) selectedIds.push(persEls[i].getAttribute("data-personality"));
  let aiIdx = 0;
  for (let j = 0; j < 4; j++) {
    if (j === oneVsOne.userPosition) oneVsOne.hopPersonalities[j] = "user";
    else { oneVsOne.hopPersonalities[j] = selectedIds[aiIdx % selectedIds.length]; aiIdx++; }
  }
  // start screen 已经隐藏（下一行 showHop 会切到 word hop 或 ai），无需 .add("hidden")
  showHop(0);
}

function showOneVsOneReveal() {
  show("oneRevealScreen");
  const chain = $("oneRevealChain");
  chain.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const card = document.createElement("div");
    card.className = "one-reveal-card";
    const label = document.createElement("div");
    label.className = "one-reveal-label";
    const isUser = oneVsOne.hopPersonalities[i] === "user";
    if (isUser) {
      label.innerHTML = "位置 " + (i + 1) + " · <span class='one-reveal-name' style='color:var(--teal)'>你</span>";
    } else {
      const pn = PERSONALITIES[oneVsOne.hopPersonalities[i]].name;
      label.innerHTML = "位置 " + (i + 1) + " · <span class='one-reveal-name'>" + pn + "</span>";
    }
    card.appendChild(label);

    if (i === 0 || i === 2) {
      const we = document.createElement("div");
      we.className = "one-reveal-words";
      (oneVsOne.words[i] || []).forEach((w) => {
        const c = document.createElement("span");
        c.className = "word-chip"; c.textContent = w;
        we.appendChild(c);
      });
      card.appendChild(we);
    } else {
      const ae = document.createElement("div");
      ae.className = "one-reveal-art";
      const cv = document.createElement("canvas");
      cv.width = 300; cv.height = 200;
      ae.appendChild(cv);
      card.appendChild(ae);
      (function (canvas, strokes) {
        setTimeout(() => {
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, 300, 200);
          const sW = oneW || 600, sH = oneH || 400;
          const sc = Math.min(280 / sW, 180 / sH);
          const oX = (300 - sW * sc) / 2;
          const oY = (200 - sH * sc) / 2;
          ctx.save(); ctx.translate(oX, oY); ctx.scale(sc, sc);
          strokes.forEach((s) => {
            if (!s.points || s.points.length < 2) return;
            for (let j = 1; j < s.points.length; j++) {
              const a = s.points[j - 1], b = s.points[j];
              ctx.lineCap = "round"; ctx.lineJoin = "round";
              ctx.strokeStyle = hexA(s.color, 0.55); ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          });
          ctx.restore();
        }, 50);
      })(cv, oneVsOne.strokes[i] || []);
    }

    if (!isUser && oneVsOne.voiceLines[i]) {
      const v = document.createElement("div");
      v.className = "one-reveal-voice";
      v.textContent = "「" + oneVsOne.voiceLines[i] + "」";
      card.appendChild(v);
    }
    chain.appendChild(card);
  }
}

function checkOneStartBtn() {
  const posSelected = document.querySelectorAll(".one-pos-tile.selected").length === 1;
  const persCount = document.querySelectorAll(".one-pers-tile.selected").length;
  $("oneStartBtn").disabled = !(posSelected && persCount >= 2);
}

function bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  document.querySelectorAll(".one-pos-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      document.querySelectorAll(".one-pos-tile").forEach((t) => t.classList.remove("selected"));
      tile.classList.add("selected");
      checkOneStartBtn();
    });
  });

  document.querySelectorAll(".one-pers-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const wasSelected = tile.classList.contains("selected");
      if (wasSelected) tile.classList.remove("selected");
      else {
        const count = document.querySelectorAll(".one-pers-tile.selected").length;
        if (count < 3) tile.classList.add("selected");
      }
      checkOneStartBtn();
    });
  });

  $("oneStartBtn").addEventListener("click", startOneVsOne);
  $("oneWordSubmitBtn").addEventListener("click", submitOneWords);
  $("onePlayMusicBtn").addEventListener("click", () => {
    playOneVsOneMusic(oneVsOne);
    const btn = $("onePlayMusicBtn");
    btn.disabled = true; btn.innerHTML = "播放中…";
    setTimeout(() => { btn.disabled = false; btn.innerHTML = "▶ 听 20s 共创音乐"; }, 21000);
  });
  $("oneDownloadBtn").addEventListener("click", () => {
    alert("v0.1 暂未实现 1.1 图卡，先听 20s 共创音乐。");
  });
  $("oneRetryBtn").addEventListener("click", () => {
    oneVsOneReset();
    document.querySelectorAll(".one-pos-tile.selected").forEach((t) => t.classList.remove("selected"));
    document.querySelectorAll(".one-pers-tile.selected").forEach((t) => t.classList.remove("selected"));
    show("oneVsOneStartScreen");
    checkOneStartBtn();
  });
  $("oneHomeBtn").addEventListener("click", () => {
    oneVsOneReset();
    enterHub();
  });
}

export function enterOneVsOne() {
  bindEvents();
  oneVsOneReset();
  document.querySelectorAll(".one-pos-tile.selected").forEach((t) => t.classList.remove("selected"));
  document.querySelectorAll(".one-pers-tile.selected").forEach((t) => t.classList.remove("selected"));
  show("oneVsOneStartScreen");
  checkOneStartBtn();
}
