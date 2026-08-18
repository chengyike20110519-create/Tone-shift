# Tone-shift · 声痕

> A way to keep the songs that mattered.

A personal music journal. Pick a song from QQ Music / NetEase Cloud Music / Spotify, draw what it feels like, pick three words, or describe a half-remembered tune — and the AI listeners keep you company. Every moment becomes a small card — a **声痕卡** (sound mark) — with the song, your sketch, a few words, and the listeners' takes.

---

## 当前状态

| 模块 | 状态 | 文件 |
|---|---|---|
| 平台 hub | ✅ 可用 | `index.html`（首屏） |
| 1.4 自由听画 | ✅ 可玩（程序合成音乐占位） | `index.html` |
| 双人传声 (bonus) | ✅ 可玩（程序合成音乐占位） | `index.html`（2 人接力 + 20s 音乐 + 下载图卡） |
| 1.1 单人传声链 | 🚧 v0.1 半装 | 脚本太大被截断，要分步 |
| 1.2 记忆考古 | 📋 规划 | — |
| 1.3 每日画题 | 📋 规划 | — |
| 真音乐接入（QQ/网易云/Spotify）| 📋 v0.2 规划 | URL 导入 → 站内搜索 |
| Cloudflare Worker 真分享 | 📋 v0.3 规划 | 设计稿在 `WORKER_DESIGN.md` |

> 注：原 4 人版多人传声筒（`multiplayer.html`）已归档为 `multiplayer.html`。

---

## 核心玩法：4 个单人模式 + 1 个 bonus

| 模式 | 你的动作 | 产出 |
|---|---|---|
| **1.4 自由听画** | 选真歌 → 听 → 画 | 声痕卡（画 + 情绪分析 + 主色） |
| **1.1 单人传声链** | 选位置 + 选 2-3 个 AI 听友 + 接力 4 跳 | 4 跳对比 + 20s 共创音乐 |
| **1.2 记忆考古** | 画旋律轮廓 / 选颜色年代 / 写歌词碎片 | 候选歌 + 记忆近似曲 + 记忆卡 |
| **1.3 每日画题** | 看线索 → 猜歌 → 画 | 每日画卡 + 第二天看他人解读 |
| *(bonus) 2p 双人传声* | A 选词 + B 画 | 漂移对比 + 20s 音乐 + 下载图卡 |

---

## AI 听友（5 种性格）

每个听友有自己的「听感偏好」，影响选词和画风：

| 听友 | 性格 | 选词偏好 | 画风 |
|---|---|---|---|
| 怀旧收集者 | 老歌和年代联想 | 信、旧照片、灯塔、钟 | 厚笔触、暖色 |
| 理性乐评人 | 关注节奏和结构 | 城市、桥、影子 | 几何线条、冷色 |
| 视觉系玩家 | 根据颜色和画面理解 | 光、雨、太阳、镜子 | 大胆多色 |
| 荒诞派 | 产生搞笑但有趣的漂移 | 舞、钥匙、酒、月亮 | 随机散点 |
| 共情型听众 | 关注歌词和情绪 | 孤独、温柔、离别、眼泪 | 柔和曲线、暖色 |

---

## 当前技术栈

- **前端**：Vanilla HTML + CSS + JS（无框架，零依赖）
- **画板**：HTML5 Canvas
- **音频**：Web Audio API（20s 共创音乐合成）
- **音乐源**：v0.2 起接入 QQ 音乐 / 网易云 / Spotify
- **状态**：v0.1 内存；v0.3+ 计划上 Cloudflare Worker

---

## 设计原则

1. **留住那些歌** — 核心目标不是游戏，是个人音乐记录
2. **界面不对称 > 规则限制** — 用工具本身（按钮 / 画笔 / 键盘）逼出信息损失
3. **声痕卡 > 音乐** — 每张卡是用户的"赢"，20s 音乐是装饰
4. **诚实 > 体面** — 真歌用真歌，不假装 AI 生成
5. **真分享 > 单设备** — v0.3 上 Cloudflare Worker 做真分享

---

## 路线图

```
v0.1  ✅ 平台 hub + 1.4 + 双人传声（程序合成音乐占位）
v0.2  真音乐接入（QQ/网易云/Spotify URL 导入 + 站内搜索）
v0.3  Cloudflare Worker + KV 上房间分享（替换 pass-and-play）
v0.4  3 人降级版
v1.0  真音乐 + 真分享 + 4 个模式全部上线
v1.x  1.2 记忆考古 / 1.3 每日画题 / 1.4 声音笔刷
```

---

## 文件结构

```
Tone-shift/
├── README.md          # 本文件
├── WORKER_DESIGN.md   # v0.3 真分享设计稿
├── index.html         # 平台 hub + 1.4 + 双人传声 + 1.1 v0.1（半装）
├── multiplayer.html   # 4p 旧原型（归档）
├── particle-storm.html, test-particles.html, particle-preview.html  # 历史调试
└── ...
```

---

## 怎么跑

```bash
open index.html
# 或起本地服务
python3 -m http.server 8000
```

---

## 仓库

GitHub: https://github.com/chengyike20110519-create/Tone-shift

## License

Private / personal project.
