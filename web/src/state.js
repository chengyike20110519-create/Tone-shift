// web/src/state.js
// 中央状态：被所有 mode 共享。
// ESM 单例：import 此模块即可拿到同一个对象引用。

import { $ } from "./lib/dom.js";
import { RECOMMENDED_INDEX } from "./lib/data.js";

// 画布与上下文（延迟到 DOMContentLoaded 后初始化）
export const scene = $("scene");
export const sceneCtx = scene ? scene.getContext("2d") : null;
export const paintCanvas = $("paintCanvas");
export const paintCtx = paintCanvas ? paintCanvas.getContext("2d") : null;

// 视口尺寸（按 devicePixelRatio 缩放后用于逻辑坐标）
export let W = 0;
export let H = 0;
export let DPR = 1;
export function setViewport(w, h, dpr) {
  W = w; H = h; DPR = dpr;
}

// 主状态对象：阶段 / 画图 / 音频 / 结果
export const state = {
  phase: "title",                     // title | story | listen | paint | result | hub
  colorIndex: RECOMMENDED_INDEX,
  strokes: [],                        // 当前 mode 的笔触列表
  drawing: false,
  lastPoint: null,
  lastTime: 0,
  speed: 0,
  pressure: 0.7,

  // 音频
  audioCtx: null,
  analyser: null,
  masterGain: null,
  src: null,                          // BufferSourceNode
  songBuffer: null,
  songStartedAt: 0,
  muted: false,

  // 结果（仅 free-draw 用）
  result: null
};

// 频谱能量（按低/中/高分桶的 0~1 数值）
export const energy = { low: 0.1, mid: 0.08, high: 0.05 };

// 当前分析器缓冲

// 粒子系统（环境粒子 + 笔刷粒子 + 音符粒子）
// 这是单一数组，被 scene / draw / mode 共享，所以必须是同一个引用
export const particles = [];

// 重置到 hub：清空当前 mode 的所有瞬时状态（含画布像素 + result 画板）
export function resetToHub() {
  state.phase = "title";
  state.strokes = [];
  state.drawing = false;
  state.lastPoint = null;
  state.lastTime = 0;
  state.speed = 0;
  state.result = null;
  particles.length = 0;
  if (state.src) { try { state.src.stop(); } catch (_) {} state.src = null; }
  // 清 paintCanvas 像素，避免下次进入 free-draw 时残留旧画
  if (paintCanvas && paintCtx) {
    try { paintCtx.setTransform(1, 0, 0, 1, 0, 0); paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height); }
    catch (_) {}
  }
  // 清 resultArt（resultScreen 上的画板）
  const ra = document.getElementById("resultArt");
  if (ra && ra.getContext) {
    try { const ctx = ra.getContext("2d"); ctx.clearRect(0, 0, ra.width, ra.height); } catch (_) {}
  }
}
