// web/src/music.js
// 程序化音乐合成：根据笔触位置 / 颜色生成 20s 共创音乐。
// 用于 1.1 单人传声 + 双人传声 的"听 20s 共创音乐"按钮。

import { initAudio } from "./audio.js";
import { state } from "./state.js";
import { PALETTE } from "./lib/data.js";

// 颜色 → 音色（由后端 PALETTE 的 timbre 字段驱动，未匹配回落到 sine）
function timbreOf(color) {
  const p = PALETTE.find(c => c.color === color);
  return (p && p.timbre) || "sine";
}

// A 小调五声音阶（不会刺耳）
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

// 共用：把笔触列表转成 20s 音乐
function strokesToMusic(strokes, srcH, dur = 20) {
  if (!strokes.length) return;
  if (!state.audioCtx) initAudio();
  if (!state.audioCtx) return;
  if (state.audioCtx.state === "suspended") state.audioCtx.resume();

  const ctx = state.audioCtx;

  // 心跳打底（低频）
  const kick = ctx.createOscillator();
  const kg = ctx.createGain();
  kick.type = "sine";
  kick.frequency.value = 110;
  const kt = ctx.currentTime;
  kg.gain.setValueAtTime(0, kt);
  kg.gain.linearRampToValueAtTime(0.18, kt + 0.04);
  kg.gain.exponentialRampToValueAtTime(0.001, kt + 0.35);
  kick.connect(kg); kg.connect(ctx.destination);
  kick.start(kt); kick.stop(kt + 0.4);

  // 每笔一笔，按时间铺开
  strokes.forEach((stroke, i) => {
    if (!stroke.points || stroke.points.length < 2) return;
    const avgY = stroke.points.reduce((s, p) => s + p.y, 0) / stroke.points.length;
    const yRatio = 1 - (avgY / srcH);
    const ni = Math.max(0, Math.min(SCALE.length - 1, Math.floor(yRatio * SCALE.length)));
    const freq = SCALE[ni];
    const wf = timbreOf(stroke.color);
    const amp = Math.min(0.3, 0.1 + stroke.points.length * 0.004);
    const time = (i / strokes.length) * dur;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wf;
    osc.frequency.value = freq;
    const t = ctx.currentTime + time;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.6);
  });
}

// 双人传声：B 画的所有笔触
export function playTwoPMusic(twoPState) {
  strokesToMusic(twoPState.bStrokes, twoPState.canvasH || 400);
}

// 单人传声：只播第 2 跳（用户画）+ 第 4 跳（用户画）的笔触
export function playOneVsOneMusic(oneVsOneState) {
  const all = [];
  if (oneVsOneState.strokes[1]) all.push(...oneVsOneState.strokes[1]);
  if (oneVsOneState.strokes[3]) all.push(...oneVsOneState.strokes[3]);
  strokesToMusic(all, oneVsOneState.canvasH || 400);
}
