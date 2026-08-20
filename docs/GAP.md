# Tone-Shift Gap & Roadmap

> 历史快照 + 当前进度。原始分析见 git log。
> 最后更新：v0.1 demo 端到端跑通 + 后端化字典后。

---

## 当前状态（v0.1 已可玩）

| 模块 | 状态 | 实现位置 |
|---|---|---|
| 平台 hub（6 mode tile）| ✅ | `web/index-modular.html` + `web/src/modes/hub.js` |
| 1.4 自由听画（30s 听 + 18s 画 + 声痕卡 + 自动落库）| ✅ | `web/src/modes/free-draw.js` + `analyze.js` |
| 1.1 单人传声链（你 + 2-3 AI + 4 跳 + 共创音乐）| ✅ | `web/src/modes/one-vs-one.js` |
| 1.2 记忆考古（画轮廓 + 选色年代 + 候选召回）| ✅ | `web/src/modes/memory-archaeology.js` |
| 2p 双人传声（同设备 pass-and-play）| ✅ | `web/src/modes/two-player.js` |
| 声痕库（我的画）| ✅ | `web/src/modes/gallery.js` |
| 社交广场（同频匹配 + 话题 + 公开画廊）| ✅ | `web/src/modes/social-hub.js` |
| 后端 REST API（字典 + 声痕 + 打卡 + 点赞 + 评论 + 匹配）| ✅ | `server/src/index.js` |
| 字典后端化（前端零业务字典硬编码）| ✅ | `web/src/api.js` + `dict_cache.js` |

---

## v0.2 roadmap（next）

### P0 — 真实性补完
- [ ] 真音乐接入（QQ 音乐 / 网易云 / Spotify SDK）替换 Web Audio 合成
- [ ] 1v1 图卡下载（现在点了会弹"未实现"）
- [ ] 漂移叙事串到 1v1 reveal 卡（后端 `/api/v1/drift` 已就绪，前端没接）

### P1 — 内容扩展
- [ ] 1.3 每日画题（话题已经在 social-hub 显示，但没创作入口）
- [ ] 同色"情绪地图"（LBS 地图叠加）
- [ ] 心情周报 / 年度海报

### P2 — 商业化
- [ ] 会员订阅（¥19.9/月）
- [ ] 虚拟商品（画笔 / 颜料特效 / 边框）

### P3 — Worker 部署
- [ ] Cloudflare Worker 真分享（双人传声房间流，详见 [WORKER-v0.3.md](WORKER-v0.3.md)）
- [ ] Durable Objects（v0.4 内容生成流）

---

## 已完成的 P0/P1（历史）

最初 [Tone-Shift-项目介绍.md](PRODUCT.md) 文档列出的 P0/P1 优先级：

| 优先级 | 项 | 状态 |
|---|---|---|
| P0 | 品牌名统一为 Tone-Shift（音变）| ✅ |
| P0 | 自由听画流程 30s/18s | ✅（MD 一致）|
| P0 | 完成画作后标题 + 公私选择 | ✅（`resultTitle` + `privacy-opt`）|
| P0 | 打卡入口（自由听画左上角）| ✅（`streakBadge` + `resultStreak`）|
| P1 | 记忆考古模式 | ✅ |
| P1 | 传声链模式 | ✅ |
| P1 | 音画传声筒多人 | ✅（pass-and-play，房间流见 WORKER-v0.3）|
| P1 | 同频匹配 | ✅（mock 3 个推荐用户）|
| P1 | 情绪广场 | ✅（公开画作流）|
| P1 | 话题挑战 | ✅（topics 端点 + social-hub 渲染）|

---

## 字典层架构（已重构）

业务字典已**全部后端化**：

```
后端 seed.js → /api/v1/{palette,words,personalities,mem-options,mock-songs,time-config}
  ↓
前端 api.init() 拉取 → 写入 web/src/dict_cache.js
  ↓
lib/data.js re-export → modes/*.js 读取
```

前端只剩 UI 状态文案（loading / 按钮状态字），业务字典 = 0 硬编码。
