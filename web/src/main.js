// web/src/main.js
// 入口：先把 hub 绑上并显示，再异步拉字典（字典拉失败也允许 mode 进入，只是空状态）。

import { $, show } from "./lib/dom.js";
import { resize, loop } from "./scene.js";
import { state } from "./state.js";
import * as api from "./api.js";
import { bindHub, enterHub, refreshHubBadges } from "./modes/hub.js";
import { tickFreeDraw } from "./modes/free-draw.js";

// 让 banner 显示当前后端数据源地址
const banner = document.getElementById("newBanner");
if (banner) {
  banner.dataset.backend = "/api/v1/*";
}

window.addEventListener("resize", resize);
resize();

// 立刻把 hub 接上 + 显示 —— 不等字典拉完
try {
  bindHub();
} catch (e) {
  console.error("[boot] bindHub failed:", e);
}
enterHub();

// 异步拉字典；拉成功 → 刷新 badges；拉失败 → 不阻断用户
api.init()
  .then(async () => {
    try { await refreshHubBadges(); } catch (e) { console.warn("[boot] refreshHubBadges failed:", e); }
  })
  .catch(err => {
    console.warn("[boot] api.init failed:", err);
    // 在 hub 上挂一个软提示，不阻断操作
    const hub = document.getElementById("hubScreen");
    if (hub) {
      const errEl = document.createElement("p");
      errEl.style.cssText = "color:#ffb86b;text-align:center;padding:8px 16px;max-width:560px;font-size:13px;";
      errEl.textContent = "⚠ 后端字典不可用：" + (err && err.message || err) + "。部分模式可能空数据。";
      hub.appendChild(errEl);
    }
  });

// URL hash 快捷入口：?mode=free-draw / #free-draw ...
const _params = new URLSearchParams(location.search);
const _autoMode = (_params.get("mode") || location.hash.replace("#", ""));
if (_autoMode === "free-draw")               import("./modes/free-draw.js").then(m => m.enterFreeDraw());
else if (_autoMode === "one-vs-one")         import("./modes/one-vs-one.js").then(m => m.enterOneVsOne());
else if (_autoMode === "memory-archaeology") import("./modes/memory-archaeology.js").then(m => m.enterMemoryArchaeology());
else if (_autoMode === "gallery")            import("./modes/gallery.js").then(m => m.enterGallery());
else if (_autoMode === "two-player")         import("./modes/two-player.js").then(m => m.startTwoP());
else if (_autoMode === "social-hub")         import("./modes/social-hub.js").then(m => m.enterSocialHub());

// 主循环：每帧更新场景 + 自由听画的倒计时
let lastTime = performance.now();
function frame(now) {
 requestAnimationFrame(frame);
 lastTime = loop(now, lastTime);
  tickFreeDraw();
 state._dbgCount = (state._dbgCount || 0) + 1;
  if (state._dbgCount % 15 === 0) {
    const dbg = $("debug");
    if (dbg) {
      const dt = (now - lastTime) / 1000;
      dbg.textContent = "FPS ~" + Math.round(1 / Math.max(dt, 0.001));
    }
  }
}
requestAnimationFrame(frame);
