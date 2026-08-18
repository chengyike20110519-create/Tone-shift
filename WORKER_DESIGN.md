# Cloudflare Worker 房间流设计

> 把"双人传声"从单设备 pass-and-play 升级成"链接分享接力"。本文是设计稿，等你测完 2p v0.1 直接对照实现。

---

## 1. 目标

**现在**：A 和 B 在同一台设备上接力。  
**之后**：A 创建房间 → 把链接发给 B → B 在自己手机上画 → A 在自己手机上看到结果。  
**核心约束**：零账号、零注册、链接即用、24h 自动失效。

---

## 2. 架构

```
┌──────────┐    link     ┌──────────┐
│  A 手机  │ ──────────▶ │  B 手机  │
└─────┬────┘             └─────┬────┘
      │ HTTP                  │ HTTP
      ▼                       ▼
┌─────────────────────────────────────┐
│   Cloudflare Worker (双入口)        │
│   ① 静态文件（index.html）         │
│   ② API（/api/rooms/*）            │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  KV 存储      │
        │  ROOMS 命名   │
        │  space        │
        └──────────────┘
```

**关键点**：
- **Worker 同时托管静态 + API**。index.html 部署到 Workers Assets / Pages，API 在同一个 Worker 里。
- **不用 Pages + 单独 Worker**。一个 Worker 搞定，减少域名和部署复杂度。
- **不用 Durable Objects**。2-4 人的房间状态简单、读多写少，KV 够用。

---

## 3. 房间数据模型

KV 里存的是 **JSON 序列化的 room 对象**，key = 房间 ID（8 位 nanoid）。

```ts
type Room = {
  id: string;                // 8 位 nanoid
  createdAt: number;          // ms 时间戳
  expiresAt: number;          // createdAt + 24h
  status: 'waiting-a' | 'waiting-b' | 'reveal' | 'done';
  
  // 2p 模式只有 a-words 和 b-strokes
  // 4p 模式还会有 c-words 和 d-strokes
  
  aWords?: string[];         // A 选的 3 词
  aDoneAt?: number;          // A 完成时间
  
  bStrokes?: StrokeData[];   // B 画的笔触
  bDoneAt?: number;
  
  // 4p 扩展
  cWords?: string[];
  dStrokes?: StrokeData[];
};

type StrokeData = {
  color: string;              // "#ff6b6b"
  points: Array<{x: number, y: number}>;  // 相对坐标 0-1 (归一化)
};
```

**关键决策**：笔触坐标用**归一化**（0-1 相对坐标），不是绝对像素。这样不同屏幕尺寸能正确还原。

---

## 4. API

| 方法 | 路径 | 用途 | 频率限制 |
|---|---|---|---|
| `POST` | `/api/rooms` | 创建新房间，返回 `{id, expiresAt}` | 1/分钟/IP |
| `GET` | `/api/rooms/:id` | 查询当前状态 | 10/分钟/IP |
| `PUT` | `/api/rooms/:id/step` | 推进到下一阶段（带角色校验） | 5/分钟/IP |
| `POST` | `/api/rooms/:id/abandon` | 房主主动结束 | — |

### 4.1 创建房间

```http
POST /api/rooms
Content-Type: application/json
Body: { "mode": "two-player" }

200 OK
{ "id": "aB3xY7qZ", "expiresAt": 1692288000000, "shareUrl": "https://shenghen.example/?room=aB3xY7qZ" }
```

### 4.2 推进阶段

```http
PUT /api/rooms/aB3xY7qZ/step
Content-Type: application/json
Body: { "role": "a", "step": "a-pick", "data": { "aWords": ["雨","夜","长椅"] } }

200 OK
{ "status": "waiting-b", "aDoneAt": 1692287000000 }
```

**角色校验**：每个 `step` 只能由对应角色推进。比如 `a-pick` 只能由 A 推，`b-draw` 只能由 B 推。  
**怎么知道谁是 A 谁是 B**：A 是创建者，A 的浏览器存 `roomId + role=a` 在 localStorage；B 从链接进来时，role = b。

### 4.3 轮询 vs WebSocket

v0.3 用 **轮询**（3 秒一次 GET），简单、零依赖。  
v0.4 再考虑 WebSocket / Server-Sent Events，**等 4p 上线 + 真实用户有"等待焦虑"反馈再说**。

---

## 5. 客户端流程

### 5.1 A 创建房间

```
[Hub] 点「双人传声」tile
  ↓
[A 创建页] 选 3 词 + 点「创建房间」
  ↓
POST /api/rooms → 拿到 {id, shareUrl}
  ↓
[A 分享页] 显示大二维码 + 「复制链接」+ 等待 B 加入
  ↓
localStorage.setItem('sh_role', 'a')
localStorage.setItem('sh_room', id)
  ↓
开始轮询 GET /api/rooms/:id，3s 一次
  ↓
status === 'waiting-b' 时显示"等待 B 选词"
status === 'reveal' 时跳转揭晓页
```

### 5.2 B 加入房间

```
[链接] ?room=aB3x7qZ
  ↓
[index.html] 解析 URL → 拿到 roomId
  ↓
GET /api/rooms/:id → 验证房间存在 + 状态 = 'waiting-b' 或 'waiting-a'
  ↓
[B 选词页] 选 3 词 + 点「传给 A」
  ↓
PUT /api/rooms/:id/step {role: 'b', step: 'b-draw', data: {bStrokes: [...]}}
  ↓
[B 画图页] 画 30s + 提交
  ↓
PUT /api/rooms/:id/step {role: 'b', step: 'b-done', data: {...}}
  ↓
轮询发现 status === 'reveal'，跳转揭晓页
```

### 5.3 关键 UI 变化

- 现在的 `enterTwoP()` 拆成 `enterTwoPCreate()`（A 创建房间）和 `enterTwoPJoin(roomId)`（B 加入）
- 揭晓页增加"等 A 来查看"状态（status === 'reveal' 但本地是 B 角色）
- A 揭晓页增加 B 的"完成时间"显示

---

## 6. 安全

### 6.1 房间 ID
- 8 位 nanoid = 64^8 ≈ 2.8 × 10^14 组合
- 不可枚举（实际只能被分享，不能被猜到）
- TTL 24h，cron 清理

### 6.2 角色防伪
- A 的创建请求不验证身份（任何人可以创建）
- B 的加入通过链接（链接里带 roomId，但 role 由本地 localStorage 决定）
- **风险**：B 拿到链接后可以伪造自己是 A 推 A 的步骤  
  **v0.3 缓解**：用 8 字符"创建 token"（返回时给 A），A 的步骤必须带 token。Token 不进 URL，B 看不到。  
  **v0.4 升级**：HMAC 签名整个请求。

### 6.3 速率限制
- Worker 层面用 KV 计数：每 IP 每分钟创建房间次数
- 简单的 sliding window 或 token bucket

### 6.4 内容审核
- v0.3 不做。词库是固定的、画作是简笔画，滥用空间有限。
- v0.5+ 加举报机制 + 黑名单词库。

---

## 7. 成本估算（Cloudflare Free Tier）

| 资源 | 免费额度 | 2p 项目预估用量 | 余量 |
|---|---|---|---|
| Worker 请求 | 100,000/天 | ~500/天（1000 房间/天 × 30 请求/房间） | 充足 |
| Worker CPU | 10ms/请求 | < 5ms（纯 KV 读写） | 充足 |
| KV 读 | 10M/天 | ~30K/天 | 充足 |
| KV 写 | 1M/天 | ~3K/天 | 充足 |
| KV 存储 | 1GB | ~50MB（10000 历史房间） | 充足 |

**结论**：v0.3 跑在免费档完全够用。日活 1000 以内不用担心。

---

## 8. 不在范围内（v0.3 不做）

- ❌ 账号系统 / 用户登录
- ❌ 历史记录 / 个人收藏
- ❌ 实时多人（>2 人）
- ❌ 内容审核
- ❌ 数据分析
- ❌ 推送通知

---

## 9. 实施步骤（v0.3 路线）

```
Day 1:  Worker + KV 基础
        ├─ wrangler init
        ├─ 创建 KV namespace ROOMS
        ├─ 实现 POST /api/rooms（创建）
        └─ 实现 GET /api/rooms/:id（查询）

Day 2:  推进逻辑
        ├─ 实现 PUT /api/rooms/:id/step
        ├─ 实现状态机校验（角色 + 步骤顺序）
        └─ 实现 DELETE /api/rooms/:id（主动结束）

Day 3:  前端集成
        ├─ 拆分 enterTwoP → enterTwoPCreate / enterTwoPJoin
        ├─ 加"分享二维码"组件（用 qrcode.js CDN 或自己画）
        ├─ 加轮询逻辑（3s 一次 GET）
        └─ 揭晓页加"等 A 查看"状态

Day 4:  部署 + 联调
        ├─ 部署 Worker 到 Cloudflare
        ├─ 绑定自定义域名（如果买了）
        ├─ 手机两端联调
        └─ 修 bug

Day 5:  清理
        ├─ 加 cron 清理过期房间（每 6h 跑一次）
        ├─ 加速率限制
        └─ 加错误处理
```

---

## 10. 待定问题

- [ ] 域名：要不要买 `shenghen.app` 或类似？用 `workers.dev` 子域名也行。
- [ ] 4p 上不上：v0.3 只做 2p 真分享，4p 暂留 pass-and-play。
- [ ] 二维码：用 `qrcode.js`（~10KB）还是手写 SVG？建议直接 CDN。
- [ ] 轮询 vs SSE：v0.3 轮询够了，v0.4 再看。
- [ ] 房间命名：8 位 nanoid 大小写混合，可读性可接受。要不要再加"易读单词"前缀？
- [ ] 创建 token：v0.3 用 6 字符，存 localStorage。够用就够用。

---

## 11. 实施前确认清单

实现前需要你拍板的：

1. **域名** — 用 `workers.dev` 子域名，还是你想买自定义？
2. **4p 范围** — v0.3 只做 2p 真分享？4p 留 v0.4？
3. **速率限制** — 简单 IP 限流够用？还是想用 Cloudflare Turnstile？
4. **部署时机** — 测完 2p v0.1 立刻开始？还是先把词库 / 时限调好再做？
