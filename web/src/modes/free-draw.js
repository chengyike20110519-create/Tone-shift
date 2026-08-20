// web/src/modes/free-draw.js
// 1.4 自由听画：序章 → 听 → 画 → 揭晓 → 保存
//
// 流程：
//   enterFreeDraw()
//     → 显示 titleScreen（序章 · 旧手机里的第一首歌）
//     → 用户按 "开始听歌" → startSong → storyScreen
//     → 用户按 "继续" → listenScreen（30s 倒计时）
//     → 听够 16s 或点"我准备好了" → paintScreen（18s 倒计时）
//     → 画完或点"提前完成" → analyze + resultScreen
//     → "保存这张声痕" → downloadCard / "再画一次" → replay / "回到首页" → hub

import { $, show } from "../lib/dom.js";
import { LISTEN_END, PAINT_END, COPY } from "../lib/data.js";
import * as api from "../api.js";
import { state, resetToHub } from "../state.js";
import { initAudio, startSong, setMuted } from "../audio.js";
import { renderPalette, resetDrawing, repaintAll, bindPointer } from "../draw.js";
import { analyze, renderResult, downloadCard, bindPrivacy, ensureSaved } from "../analyze.js";
import { enterHub } from "./hub.js";
import { enterGallery } from "./gallery.js";

const SPEAKER_ON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const SPEAKER_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m16 9 6 6"/><path d="m22 9-6 6"/></svg>';

let _bound = false;

function bindEvents() {
  if (_bound) return;
  _bound = true;
  bindPrivacy();

  $("startBtn").addEventListener("click", () => {
    initAudio();
    startSong(0);
    show("storyScreen");
    state.phase = "story";
  });

  $("quickPaintBtn").addEventListener("click", () => {
    initAudio();
    startSong(LISTEN_END);
    state.phase = "listen";
    enterPaint();
  });

  $("storyNextBtn").addEventListener("click", () => {
    show("listenScreen");
    state.phase = "listen";
  });

  $("skipIntroBtn").addEventListener("click", () => {
    startSong(LISTEN_END);
    enterPaint();
  });

  $("finishEarlyBtn").addEventListener("click", finish);
  $("undoBtn").addEventListener("click", () => {
    if (state.strokes.length) state.strokes.pop();
    repaintAll();
  });
  $("clearBtn").addEventListener("click", () => {
    state.strokes = [];
    repaintAll();
  });

  $("muteBtn").innerHTML = SPEAKER_ON;
  $("muteBtn").addEventListener("click", () => {
    setMuted(!state.muted);
    $("muteBtn").innerHTML = state.muted ? SPEAKER_OFF : SPEAKER_ON;
  });

  $("saveBtn").addEventListener("click", downloadCard);
  const galleryBtn = $("galleryBtn");
  if (galleryBtn) galleryBtn.addEventListener("click", enterGallery);
  $("replayBtn").addEventListener("click", replay);
  $("homeBtn").addEventListener("click", () => {
    resetToHub();
    enterHub();
  });
}

export function enterFreeDraw() {
  bindEvents();
  bindPointer();
  show("titleScreen");
  state.phase = "title";
}

function enterPaint() {
  if (state.phase !== "listen") return;
  state.phase = "paint";
  show("paintScreen");
  renderPalette();
  resetDrawing();
  updateStreak();   // 异步，无须 await；DOM 元素更新在 tickFreeDraw 之后完成
  const hint = $("paintHint");
  hint.classList.remove("fade-out");
  hint.style.animation = "none";
  void hint.offsetWidth;
  hint.style.animation = "";
  setTimeout(() => hint.classList.add("fade-out"), 3600);
}

function finish() {
  if (state.phase !== "paint") return;
  state.phase = "result";
  state.result = analyze();
  renderResult();
  show("resultScreen");
  // 自动落库：即使用户立刻按 homeBtn 离开，画作也已保存在后端
  ensureSaved({ title: COPY.defaults && COPY.defaults.free_draw_title, isPublic: true }).then(() => {
    if (state.result) state.result.dirty = false;
  });
}

function replay() {
  resetDrawing();
  state.result = null;
  startSong(0);
  show("listenScreen");
  state.phase = "listen";
}

// 每帧调用，更新倒计时 + 进入下一 phase
export function tickFreeDraw() {
  if (!state.audioCtx) return;
  const el = state.audioCtx.currentTime - state.songStartedAt;
  if (state.phase === "listen") {
    const left = Math.max(0, LISTEN_END - el);
    $("listenCount").textContent = Math.ceil(left);
    $("ringFg").style.strokeDashoffset = 339.3 * (1 - Math.min(1, el / LISTEN_END));
    if (el >= LISTEN_END) enterPaint();
  } else if (state.phase === "paint") {
    const paintEl = el - LISTEN_END;
    const left = Math.max(0, PAINT_END - paintEl);
    $("paintCount").textContent = Math.ceil(left);
    if (paintEl >= PAINT_END) finish();
  }
}

// 打卡显示： paintScreen 左上角
// 打卡显示：paintScreen 左上角
export async function updateStreak() {
  const el = $("streakBadge");
  if (!el) return;
  try {
    const s = await api.streak();
    el.textContent = "连续打卡 " + (s.current_streak || 0) + " 天";
  } catch (e) {
    el.textContent = "连续打卡 0 天";
  }
}
