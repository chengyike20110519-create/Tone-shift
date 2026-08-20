// web/src/audio.js
// Web Audio API 封装：38s 程序合成歌曲 + 实时频谱分析
//
// v0.1 用纯合成音乐占位真实音频源（v0.2 接 QQ/网易云/Spotify）。
// 38 秒一首：A 小调五声音阶，主歌 + 副歌结构。

import { midiToFreq } from "./lib/dom.js";
import { state, energy } from "./state.js";

// Web Audio 采样率（技术常量，非业务字典，不需要由后端下发）
const SR = 44100;

let ctx = null;
let analyser = null;
let masterGain = null;
let songBuffer = null;
let freqBytes = new Uint8Array(256);

export function getSongBuffer() { return songBuffer; }
export function getAudioCtx() { return ctx; }

// 38s 歌曲合成（A 小调五声，4 个和弦 + 主歌 + 副歌 + 鼓点）
function buildSong() {
  const dur = 38;
  const buf = ctx.createBuffer(2, Math.floor(SR * dur), SR);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const addTone = (t, durS, freq, amp) => {
    const n0 = Math.max(0, Math.floor(t * SR));
    const n1 = Math.min(L.length, Math.floor((t + durS) * SR));
    for (let i = n0; i < n1; i++) {
      const tt = (i - n0) / SR;
      const env = Math.min(1, tt / 0.025) * Math.pow(Math.max(0, 1 - tt / durS), 2.2);
      const ph = Math.PI * 2 * freq * tt;
      const s = Math.sin(ph) + 0.33 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph);
      const v = s * amp * env;
      L[i] += v;
      R[i] += v;
    }
  };

  const addNoise = (t, durS, amp) => {
    const n0 = Math.max(0, Math.floor(t * SR));
    const n1 = Math.min(L.length, Math.floor((t + durS) * SR));
    let last = 0;
    for (let i = n0; i < n1; i++) {
      const tt = (i - n0) / SR;
      const env = Math.min(1, tt / 0.004) * Math.pow(Math.max(0, 1 - tt / durS), 2);
      const n = (Math.random() * 2 - 1) * 0.7 + last * 0.3;
      last = n;
      const v = n * amp * env;
      L[i] += v;
      R[i] += v;
    }
  };

  const addChord = (t, durS, notes, amp) => {
    notes.forEach((n) => addTone(t, durS, midiToFreq(n), amp));
  };

  // 4 个和弦（根音 + 三度 + 五度）
  const CH = [
    [45, 60, 64],
    [41, 57, 60],
    [48, 60, 67],
    [43, 59, 62]
  ];

  // 前奏 4 个和弦 + 一段旋律
  for (let m = 0; m < 4; m++) addChord(m * 4, 4.6, CH[m], 0.045);
  const introMel = [
    [0.5, 76, 1.1], [2.5, 72, 1.1], [4.5, 69, 1.2], [6.5, 71, 1.0],
    [8.5, 67, 1.2], [10.5, 64, 1.2], [12.5, 62, 1.4], [14.5, 64, 1.3]
  ];
  introMel.forEach((n) => addTone(n[0], n[2], midiToFreq(n[1]), 0.085));

  // 主歌 / 副歌循环
  for (let m = 0; m < 5; m++) {
    const idx = m % 4;
    addChord(16 + m * 4, 4.6, CH[idx], 0.062);
    for (let b = 0; b < 4; b++) addTone(16 + m * 4 + b * 1, 1.15, midiToFreq(CH[idx][0] - 12), 0.13);
  }
  const chorusMel = [
    [16, 76, 0.9], [17, 76, 0.5], [18, 72, 0.7], [19, 74, 0.5],
    [20, 72, 1.2], [22, 69, 0.7], [23, 71, 0.5], [24, 67, 1.5],
    [26, 69, 0.6], [28, 74, 0.8], [30, 72, 0.6], [32, 76, 2.2]
  ];
  chorusMel.forEach((n) => addTone(n[0], n[2], midiToFreq(n[1]), 0.105));

  // 噪声层 + 低频支撑
  for (let t = 16; t < 35.5; t += 0.5) addNoise(t, 0.055, 0.028);
  for (let t = 16; t < 35; t += 1) addTone(t, 0.16, 58, 0.075);
  addChord(36, 2, CH[0], 0.05);

  return buf;
}

// 首次启动（用户交互后调用，遵守 autoplay policy）
export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.8;
  masterGain = ctx.createGain();
  masterGain.gain.value = state.muted ? 0 : 0.75;
  analyser.connect(masterGain);
  masterGain.connect(ctx.destination);
  songBuffer = buildSong();
  freqBytes = new Uint8Array(analyser.frequencyBinCount);

  // 暴露给 state（向后兼容）
  state.audioCtx = ctx;
  state.analyser = analyser;
  state.masterGain = masterGain;
  state.songBuffer = songBuffer;
}

// 从 offset 秒开始播放
export function startSong(offset = 0) {
  if (!ctx) return;
  if (state.src) { try { state.src.stop(); } catch (_) {} }
  state.src = ctx.createBufferSource();
  state.src.buffer = songBuffer;
  state.src.connect(analyser);
  state.src.start(0, offset);
  state.songStartedAt = ctx.currentTime - offset;
}

// 静音 / 取消静音
export function setMuted(muted) {
  state.muted = muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.75;
}

// 读频谱能量到 energy.{low,mid,high}
// t = 当前时间（秒），用于在安静时仍保持动画
export function readSpectrum(t) {
  if (!ctx) return;
  const isLive = state.phase !== "title" && state.phase !== "story";
  if (isLive && analyser) {
    analyser.getByteFrequencyData(freqBytes);
    const n = freqBytes.length;
    let low = 0, mid = 0, high = 0, total = 0;
    for (let i = 0; i < 7; i++) low += freqBytes[i];
    for (let i = 7; i < 48; i++) mid += freqBytes[i];
    for (let i = 48; i < n; i++) high += freqBytes[i];
    for (let i = 0; i < n; i++) total += freqBytes[i];
    const target = {
      low:  low  / (7 * 255),
      mid:  mid  / (41 * 255),
      high: high / ((n - 48) * 255)
    };
    if (total < 60) {
      const tt = t * 0.7;
      target.low  = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(tt * 0.55));
      target.mid  = 0.20 + 0.16 * (0.5 + 0.5 * Math.sin(tt * 0.8 + 1));
      target.high = 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(tt * 1.3 + 2));
    }
    energy.low  += (target.low  - energy.low)  * 0.3;
    energy.mid  += (target.mid  - energy.mid)  * 0.3;
    energy.high += (target.high - energy.high) * 0.3;
  } else {
    const tt = t * 0.7;
    energy.low  = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(tt * 0.55));
    energy.mid  = 0.20 + 0.16 * (0.5 + 0.5 * Math.sin(tt * 0.8 + 1));
    energy.high = 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(tt * 1.3 + 2));
  }
}
