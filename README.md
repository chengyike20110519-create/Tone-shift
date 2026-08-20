# Tone-shift · 声痕

> **A way to keep the songs that mattered.**

一张小卡、一段旋律、几个词、几笔速写。留下听歌那一秒的真实感受，而不是 Spotify / 网易云的又一条历史播放。

---

## 这到底是什么

**Tone-shift** 是一个「个人音乐日记」。你听一首歌，**画下你听到的东西**（或者写下你想到的 3 个词，或者 4 个人接力传一句话）—— 系统把它压成一张 **声痕卡**（Sound Mark）：你的画 + 你的词 + AI 听友们的反应 + 一段 20 秒从你的笔画里提炼出来的程序化音乐。

它不是音乐播放器，也不是游戏，更不是另一个社交 app。它是 **「留住」工具**。

### 核心信念（设计原则）

1. **留住那些歌** — 不是让你刷下一首，是让你**回头看**你听过的歌当时让你想起什么。
2. **界面不对称 > 规则限制** — 用工具本身（画笔 / 色板 / 键盘 / 倒计时）逼出「信息损失」，而不是写规则说"不许画完整"。
3. **声痕卡 > 音乐** — 每张卡才是用户的"赢"，20 秒音乐只是装饰。
4. **诚实 > 体面** — 真歌用真歌，不假装 AI 生成。程序合成音乐明确标"占位"。
5. **零账号、零注册、链接即用** — 单人模式纯前端可玩；多人模式上 Cloudflare Worker 房间流，无登录。

### 它解决了什么

我们都有过的体验：听到一首老歌，突然想起一个人 / 一个场景 / 一个下午。然后它就消失了——从来没有第二次被想起、被记录。

Tone-shift 把那个**「想起的瞬间」**抓下来。哪怕只是几个歪歪扭扭的色块、一行"雨 / 长椅 / 灯塔"——"——你 6 个月后再翻，也认得出这是当时的心情。

---

## 详细文档

- [docs/PRODUCT.md](docs/PRODUCT.md) —— 产品起源 / 市场分析 / 商业模式 / 风险
- [docs/GAP.md](docs/GAP.md) —— 历史 gap 与当前 roadmap（P0/P1 已完成，P2/P3 未做）
- [docs/WORKER-v0.3.md](docs/WORKER-v0.3.md) —— 双人传声真分享链路 + Cloudflare Worker 房间流设计

## 玩法（速览）

- **自由听画** —— 听 30s → 画 18s → 出「声痕卡」
- **单人传声链** —— 你 + 2-3 个 AI 听友，4 跳接力出 4 张卡 + 20s 共创音乐
- **记忆考古** —— 画旋律轮廓 + 选色年代，从候选曲里找回记忆里那首
- **双人传声** —— 当前同设备 pass-and-play；真分享（房间流）见 WORKER-v0.3.md

## 仓库分区

```
Tone-shift/
├── README.md               ← 你正在看的
├── docs/                   ← 详细文档
│   ├── PRODUCT.md          ← 产品起源 / 市场 / 商业模式 / 风险
│   ├── GAP.md              ← 历史 gap + 当前 roadmap
│   └── WORKER-v0.3.md      ← 双人传声真分享 + Cloudflare Worker 房间流设计稿
├── start.sh                ← 一键启动（后端 + 静态托管）
├── LICENSE                 ← MIT
├── .editorconfig
├── .gitignore
├── server/                 ← Node 后端（REST API + JSON 文件 DB）
│   ├── package.json
│   └── src/
│       ├── index.js        ← HTTP 路由 + 静态托管
│       ├── db.js           ← 内存 state + 持久化（json 文件）
│       └── seed.js         ← 字典 seed（PALETTE / WORDS / PERSONALITIES / MOCK_SONGS ...）
└── web/                    ← 前端 SPA
    └── index-modular.html  ← 入口（需要 server 加载 ES modules）
    ├── styles/
    │   ├── tokens.css      ← :root 变量 + 全局基础
    │   ├── free-draw.css   ← 1.4 自由听画
    │   ├── hub.css         ← 模式选择 hub
    │   ├── two-player.css  ← 2p 双人传声（同设备 pass-and-play）
    │   ├── one-vs-one.css  ← 1.1 单人传声链
    │   ├── memory-archaeology.css ← 1.2 记忆考古
    │   └── social.css      ← 同频匹配 / 情绪广场 / 话题
    └── src/
        ├── main.js                 ← 入口：场景循环 + hub 路由
        ├── state.js                ← 中央单例：state / energy / particles / 视口
        ├── audio.js                ← Web Audio API：38s 程序合成歌曲 + 实时频谱
        ├── scene.js                ← 粒子系统 + 主场景渲染 + resize
        ├── draw.js                 ← 自由听画画笔（笔触 / 重绘 / 指针事件）
        ├── analyze.js              ← 色彩分析 + 情绪判定 + 图卡下载
        ├── music.js                ← 笔画 → 20s 共创音乐（2p / 1.1 共用）
        ├── api.js                  ← 唯一 REST 客户端（字典 + 声痕 + 打卡 + 社交）
        ├── dict_cache.js           ← 字典占位 + 后端拉取入口
        ├── lib/
        │   ├── dom.js              ← $ / show / clamp / hexA / midiToFreq / roundRect
        │   └── data.js             ← re-export（PALETTE / WORD_BANK / PERSONALITIES 等）
        └── modes/
            ├── hub.js              ← 模式选择 + 动态 import
            ├── free-draw.js        ← 1.4 完整流程
            ├── one-vs-one.js       ← 1.1 完整流程 + 5 AI 听友生成
            ├── memory-archaeology.js ← 1.2 记忆考古
            ├── two-player.js       ← 2p 双人传声（同设备 pass-and-play）
            ├── gallery.js          ← 声痕库（我画过的）
            └── social-hub.js       ← 同频匹配 + 话题 + 情绪广场
```

**为什么这样分：**
- **`styles/`** 按 mode 拆，CSS 改一个模式不需要看其他文件。
- **`src/lib/`** 是无副作用的工具层，被任何 mode 共享。
- **`src/modes/`** 每个玩法一个文件，互不污染。`hub.js` 用动态 `import()` 按需加载，1.4 玩家不会下载 1.1 的代码。
- **`state.js`** 是 ES module 单例（`export const state = {...}`），所有 mode 修改同一个对象。**前端唯一的状态源**。
- 真正的「权威状态」等 v0.3 落到 Cloudflare Worker 上，前端只持有"当前会话"的瞬时状态。

---

## 怎么跑

**Node ≥ 20**（项目用 ES Modules + 纯 Node 内置模块，零 npm 依赖）。

```bash
bash start.sh
# 浏览器打开 http://127.0.0.1:8000/
# 想换端口/地址：HOST=0.0.0.0 PORT=9000 bash start.sh
# 起好自动打开浏览器：bash start.sh --open
```

`start.sh` 同时起后端（REST API + JSON 文件持久化）和静态托管。默认 `HOST=127.0.0.1 PORT=8000`，可通过环境变量改。

ES Module 必须通过 HTTP 加载，**不能直接 `file://` 双击**——浏览器会拒绝跨域 module import。

---

## 当前状态

| 模块 | 状态 | 实现位置 |
|---|---|---|
| 平台 hub | ✅ 可用 | `web/index-modular.html` + `web/src/modes/hub.js` |
| 1.4 自由听画 | ✅ 可玩（Web Audio 合成音乐占位） | `web/src/modes/free-draw.js` |
| 1.1 单人传声链 | ✅ 可玩 v0.1（5 个 AI 听友 + 4 跳） | `web/src/modes/one-vs-one.js` |
| 1.2 记忆考古 | ✅ 可玩 v0.1（画轮廓 → 选色年代 → 候选召回） | `web/src/modes/memory-archaeology.js` |
| 双人传声 (2p) | 🚧 同设备 pass-and-play，v0.3 切房间流 | `web/src/modes/two-player.js`（disabled） |
| 声痕库 | ✅ 可用 | `web/src/modes/gallery.js` |
| 同频匹配 / 情绪广场 / 话题 | ✅ 可用 | `web/src/modes/social-hub.js` |
| 后端 REST API | ✅ 字典 / 声痕 / 打卡 / 点赞 / 评论 / 匹配 / 漂移 | `server/src/index.js` |
| 1.3 每日画题 | 📋 规划 | — |
| 真音乐接入（QQ / 网易云 / Spotify） | 📋 v0.2 | — |
| Cloudflare Worker 真分享 | 📋 v0.3 | 设计稿 `docs/WORKER-v0.3.md` |

> 状态快照：v0.1.5 模块化重构（前端按 mode 拆 + 后端字典化 + 业务字典全走后端）。

---

## 技术栈

- **前端**：原生 HTML + CSS + JS（**ES Modules**，零依赖）
- **画板**：HTML5 Canvas（Pointer API）
- **音频**：Web Audio API（38s 合成 + 实时频谱 + 20s 笔画 → 音乐）
- **粒子系统**：自写，650 上限 + 老化逻辑
- **后端**：Node 20+ 内置 http + JSON 文件 DB（`server/src/index.js`）；REST API `/api/v1/*`，零 npm 依赖
- **部署**：当前 `bash start.sh` 本地单进程起 API + 静态托管；v0.3 切 Cloudflare Worker + KV + Triggers

---

## 设计原则（落到实现里）

| 原则 | 实现位置 |
|---|---|
| 留住那些歌 | 每张声痕卡可下载 PNG（`analyze.js → downloadCard`） |
| 界面不对称 > 规则限制 | 倒计时环（`free-draw.css → ring-fg`）逼用户决定何时停止 |
| 声痕卡 > 音乐 | AI 听友是性格库，不是 LLM 调用（`data.js → PERSONALITIES`） |
| 诚实 > 体面 | README 明确标"程序合成占位"，不假装是真歌 |
| 零账号 | v0.3 真分享用 nanoid 房间链接，不注册 |

---

## 路线图

```
v0.1     ✅ 平台 hub + 1.4 自由听画 + 1.1 单人传声链（程序合成音乐占位）
v0.1.5   ✅ 模块化重构（前端按 mode 拆 + 后端字典化 + 业务字典全走后端）+ v0.3 Worker 房间流（替换单设备 2p pass-and-play）
v0.2     真音乐接入（QQ / 网易云 / Spotify URL 导入 + 站内搜索）
v0.3     Cloudflare Worker + KV + Triggers 上房间分享（4-6 人）
v0.4     3 人降级版（房间流多人变体）
v1.0     真音乐 + 真分享 + 4 个单人模式全部上线
v1.x     1.2 记忆考古 / 1.3 每日画题 / 1.4 声音笔刷
```

---

## 数据 / 隐私说明

- **v0.1 完全不联网**。所有音频由 Web Audio API 在浏览器里合成，无第三方音频、无大模型 API、无任何用户数据上传。
- v0.2 起接 QQ / 网易云 / Spotify 时，仅用官方公开搜索 / 链接导入；具体接入范围会在 v0.2 上线时更新本节。
- v0.3 Worker 上房间 KV 24h TTL**；**过期后房间数据自动失效。
- **不收集账号、不收集设备 ID、不写 cookie**。

---

## License

MIT — 详见 [LICENSE](./LICENSE.md)。本仓库可自由使用 /  /  修改 / 再分发，保留原作者署名。
