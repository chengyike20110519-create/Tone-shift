// web/src/draw.js
// 自由听画模式的笔触绘制 + 重置 + 指针事件。
//
// 注意：本模块假设 paintCanvas / paintCtx / state 已经由 state.js 初始化。
// 1.1 和 2p 模式的画板各自有自己的 canvas（oneCanvas / twoPCanvas），不走这里。

import { $, clamp, hexA } from "./lib/dom.js";
import { PALETTE, RECOMMENDED_INDEX } from "./lib/data.js";
import { paintCanvas, paintCtx, state, W as _w, H as _h } from "./state.js";

// 一段连续笔触
function drawSegment(a, b, color) {
  const w = 6 + a.p * 26;
  paintCtx.lineCap = "round";
  paintCtx.lineJoin = "round";
  paintCtx.strokeStyle = hexA(color, 0.55);
  paintCtx.lineWidth = w;
  paintCtx.beginPath();
  paintCtx.moveTo(a.x, a.y);
  paintCtx.lineTo(b.x, b.y);
  paintCtx.stroke();
  paintCtx.strokeStyle = hexA(color, 0.18);
  paintCtx.lineWidth = w * 2.2;
  paintCtx.beginPath();
  paintCtx.moveTo(a.x, a.y);
  paintCtx.lineTo(b.x, b.y);
  paintCtx.stroke();
}

function drawDot(point, color) {
  const radius = 4 + point.p * 13;
  paintCtx.fillStyle = hexA(color, 0.22);
  paintCtx.beginPath();
  paintCtx.arc(point.x, point.y, radius * 2.15, 0, Math.PI * 2);
  paintCtx.fill();
  paintCtx.fillStyle = hexA(color, 0.82);
  paintCtx.beginPath();
  paintCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  paintCtx.fill();
}

function renderStroke(stroke) {
  if (stroke.points.length) drawDot(stroke.points[0], stroke.color);
  for (let i = 1; i < stroke.points.length; i++) {
    drawSegment(stroke.points[i - 1], stroke.points[i], stroke.color);
  }
}

export function repaintAll() {
  paintCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  state.strokes.forEach(renderStroke);
}

// 清空当前所有笔触、重置画笔
export function resetDrawing() {
  state.strokes = [];
  state.drawing = false;
  state.lastPoint = null;
  repaintAll();
  state.colorIndex = RECOMMENDED_INDEX;
  document.querySelectorAll(".swatch").forEach((el, i) => {
    el.classList.toggle("active", i === state.colorIndex);
  });
}

// 绑定指针事件（仅 free-draw paint phase 使用）
let _pointerBound = false;
export function bindPointer() {
  if (_pointerBound) return;
  _pointerBound = true;
  const scene = $("scene");
  scene.addEventListener("pointerdown", (e) => {
    if (state.phase !== "paint") return;
    e.preventDefault();
    try { scene.setPointerCapture(e.pointerId); } catch (_) {}
    const pt = { x: e.clientX, y: e.clientY };
    state.drawing = true;
    state.lastPoint = pt;
    state.lastTime = performance.now();
    state.speed = 0;
    state.pressure = e.pressure > 0.05 ? clamp(e.pressure, 0.25, 1.15) : 0.7;
    state.strokes.push({ color: PALETTE[state.colorIndex].color, points: [] });
    const stroke = state.strokes[state.strokes.length - 1];
    const firstPoint = { x: pt.x, y: pt.y, p: state.pressure, v: 0 };
    stroke.points.push(firstPoint);
    drawDot(firstPoint, stroke.color);
  });

  scene.addEventListener("pointermove", (e) => {
    if (!state.drawing || state.phase !== "paint") return;
    e.preventDefault();
    const pt = { x: e.clientX, y: e.clientY };
    const now = performance.now();
    const dtMs = Math.max(1, now - state.lastTime);
    const last = state.lastPoint;
    const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
    const sp = dist / dtMs * 1000;
    state.speed = Math.min(3200, sp);
    state.pressure = e.pressure > 0.05
      ? clamp(e.pressure, 0.25, 1.15)
      : clamp(1 - state.speed / 2600, 0.35, 1);
    const stroke = state.strokes[state.strokes.length - 1];
    const prev = stroke.points[stroke.points.length - 1];
    const ptData = { x: pt.x, y: pt.y, p: state.pressure, v: state.speed };
    drawSegment(prev, ptData, stroke.color);
    stroke.points.push(ptData);
    state.lastPoint = pt;
    state.lastTime = now;
  });

  const endPointer = () => {
    if (state.drawing) {
      state.drawing = false;
      state.speed = 0;
    }
  };
  scene.addEventListener("pointerup", endPointer);
  scene.addEventListener("pointercancel", endPointer);
  scene.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
}

// 填充色板按钮（仅 free-draw）
export function renderPalette() {
  const paletteEl = $("palette");
  paletteEl.innerHTML = "";
  PALETTE.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "swatch"
      + (i === state.colorIndex ? " active" : "")
      + (i === RECOMMENDED_INDEX ? " recommended" : "");
    b.style.background = c.color;
    b.title = i === RECOMMENDED_INDEX ? "系统推荐色" : c.name;
    b.setAttribute("aria-label", c.name);
    b.addEventListener("click", () => {
      state.colorIndex = i;
      document.querySelectorAll(".swatch").forEach((el, j) => {
        el.classList.toggle("active", j === i);
      });
    });
    paletteEl.appendChild(b);
  });
}
