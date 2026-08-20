// web/src/lib/dom.js
// DOM 工具 + 通用 helper

export const $ = (id) => document.getElementById(id);

// 全屏切换（所有 .screen 加 .hidden，再点亮指定一个）
export function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  const target = $(id);
  if (target) target.classList.remove("hidden");
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// #rrggbb → rgba(r,g,b,a)
export function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

// MIDI 音符号 → 频率
export function midiToFreq(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// 圆角矩形 path（用于图卡绘制）
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
