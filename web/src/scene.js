// web/src/scene.js
// 粒子系统 + 场景主循环渲染。
// 笔刷粒子 / 音乐粒子 / 环境粒子 统一管理。

import { $, clamp, hexA } from "./lib/dom.js";
import { PALETTE } from "./lib/data.js";
import {
  scene, sceneCtx, paintCanvas, paintCtx,
  state, energy, particles,
  setViewport, W as _storedW, H as _storedH
} from "./state.js";
import { readSpectrum } from "./audio.js";

export { scene, sceneCtx, paintCanvas, paintCtx };

// 视口变化（devicePixelRatio 缩放 + 预填环境粒子）
export function resize() {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  scene.width  = Math.round(W * DPR);
  scene.height = Math.round(H * DPR);
  sceneCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  paintCanvas.width  = Math.round(W * DPR);
  paintCanvas.height = Math.round(H * DPR);
  paintCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  setViewport(W, H, DPR);

  // 预填环境粒子（首帧就有动画）
  const prePalette = ["#5eead4", "#a78bfa", "#ffd977", "#5b8cff", "#ff8fb1", "#ff6b6b", "#ffb36b"];
  for (let i = 0; i < 80; i++) {
    const p = particles[i] || {};
    p.kind = "spark";
    p.x = Math.random() * W; p.y = Math.random() * H;
    p.px = p.x; p.py = p.y;
    p.vx = (Math.random() - 0.5) * 50;
    p.vy = (Math.random() - 0.5) * 40;
    p.life = Math.random() * 2.0;
    p.max = 3.2 + Math.random() * 2.2;
    p.size = 3.5 + Math.random() * 5;
    p.color = prePalette[i % prePalette.length];
    p.alpha = 0.95;
    if (!particles.length || particles[particles.length - 1] !== p) particles.push(p);
  }
}

// 笔刷喷发（paint phase 时，每次 pointermove 调用一次）
function spawnBrush(x, y) {
  const color = PALETTE[state.colorIndex].color;
  const p = state.pressure;
  const sp = state.speed;
  const count = clamp(Math.round((0.4 + p * 0.9) * (0.4 + sp / 1800) * 4), 1, 12);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = (30 + Math.random() * 120) * (0.4 + p) + sp * 0.12;
    particles.push({
      kind: "brush",
      x: x, y: y, px: x, py: y,
      vx: Math.cos(ang) * speed + (Math.random() - 0.5) * 40,
      vy: Math.sin(ang) * speed * 0.7 - energy.high * 30,
      life: 0,
      max: 0.7 + Math.random() * 0.9,
      size: 1.5 + p * 3.6,
      color: color,
      alpha: 0.85
    });
  }
}

// 每帧按当前能量生成新粒子
function spawnMusicParticles() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  // 永远有的环境粒子
  if (Math.random() < 1) {
    const palette = ["#5eead4", "#a78bfa", "#ffd977", "#5b8cff", "#ff8fb1"];
    particles.push({
      kind: "spark",
      x: Math.random() * W, y: Math.random() * H, px: 0, py: 0,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 30,
      life: 0,
      max: 3.2 + Math.random() * 2.2,
      size: 3.5 + Math.random() * 5,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 0.95
    });
  }

  const low = energy.low, mid = energy.mid, high = energy.high;
  if (low > 0.06 && Math.random() < low * 0.55) {
    particles.push({
      kind: "swell", x: Math.random() * W, y: H + 20, px: 0, py: 0,
      vx: (Math.random() - 0.5) * 18, vy: -(18 + low * 90),
      life: 0, max: 2.2 + low * 2,
      size: 6 + low * 48, color: "#4c6ef5", alpha: 0.35
    });
  }
  if (mid > 0.04 && Math.random() < mid * 0.5) {
    particles.push({
      kind: "streak", x: Math.random() * W, y: Math.random() * H, px: 0, py: 0,
      vx: (Math.random() - 0.5) * 120 + mid * 120, vy: (Math.random() - 0.5) * 70,
      life: 0, max: 1.1 + mid,
      size: 1.5 + mid * 4, color: "#5eead4", alpha: 0.5
    });
  }
  if (high > 0.04 && Math.random() < high * 1.2) {
    particles.push({
      kind: "spark", x: Math.random() * W, y: Math.random() * H * 0.7, px: 0, py: 0,
      vx: (Math.random() - 0.5) * 40, vy: -(20 + Math.random() * 60),
      life: 0, max: 0.8 + high,
      size: 1 + Math.random() * 2.5, color: "#ffd977", alpha: 0.85
    });
  }

  while (particles.length > 650) particles.shift();
}

export function updateParticles(t, dt) {
  const W = window.innerWidth;
  const H = window.innerHeight;

  if (state.phase === "paint" && state.drawing && state.lastPoint) {
    spawnBrush(state.lastPoint.x, state.lastPoint.y);
  }
  spawnMusicParticles();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.px = p.x;
    p.py = p.y;
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    const wind = Math.sin(t * 1.2 + p.y * 0.012) * 26 * energy.mid;
    p.vx += wind * dt;
    p.vy += (p.kind === "swell" ? -8 : 6) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y < -40 || p.x < -40 || p.x > W + 40 || p.y > H + 40) {
      particles.splice(i, 1);
    }
  }
}

export function drawScene() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  const g = sceneCtx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#08091a");
  g.addColorStop(1, "#121b34");
  sceneCtx.fillStyle = g;
  sceneCtx.fillRect(0, 0, W, H);

  // 低频能量地面光
  const lowH = 30 + energy.low * 260;
  const lg = sceneCtx.createLinearGradient(0, H, 0, H - lowH);
  lg.addColorStop(0, "rgba(56,83,214,0.5)");
  lg.addColorStop(1, "rgba(56,83,214,0)");
  sceneCtx.fillStyle = lg;
  sceneCtx.fillRect(0, H - lowH, W, lowH);

  sceneCtx.drawImage(paintCanvas, 0, 0, W, H);

  sceneCtx.globalCompositeOperation = "lighter";
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const lifeT = p.life / p.max;
    sceneCtx.globalAlpha = (1 - lifeT) * p.alpha;
    sceneCtx.strokeStyle = p.color;
    sceneCtx.lineWidth = Math.max(0.5, p.size * 2 * (1 - lifeT * 0.5));
    sceneCtx.beginPath();
    sceneCtx.moveTo(p.px, p.py);
    sceneCtx.lineTo(p.x, p.y);
    sceneCtx.stroke();
    if (p.kind === "spark" || p.kind === "brush") {
      sceneCtx.fillStyle = p.color;
      sceneCtx.beginPath();
      sceneCtx.arc(p.x, p.y, Math.max(1.0, p.size * 1.4 * (1 - lifeT * 0.7) + 0.6), 0, Math.PI * 2);
      sceneCtx.fill();
    }
  }
  sceneCtx.globalAlpha = 1;
  sceneCtx.globalCompositeOperation = "source-over";

  // 笔刷中心发光点
  if (state.phase === "paint" && state.drawing && state.lastPoint) {
    const c = PALETTE[state.colorIndex].color;
    sceneCtx.fillStyle = hexA(c, 0.35);
    sceneCtx.beginPath();
    sceneCtx.arc(state.lastPoint.x, state.lastPoint.y, 14, 0, Math.PI * 2);
    sceneCtx.fill();
  }

  // 暗角
  const vg = sceneCtx.createRadialGradient(W / 2, H / 2, Math.max(100, H * 0.35), W / 2, H / 2, H * 0.86);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.38)");
  sceneCtx.fillStyle = vg;
  sceneCtx.fillRect(0, 0, W, H);
}

// 主循环（外部每帧调用一次）
export function loop(now, lastTime) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  const t = now / 1000;
  readSpectrum(t);
  updateParticles(t, dt);
  drawScene();
  return now;
}
