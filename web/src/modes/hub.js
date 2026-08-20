import * as api from "../api.js";
// web/src/modes/hub.js
// 平台 hub：模式选择路由。
// 实际玩法由各 modes/*.js 自行启动。

import { $, show } from "../lib/dom.js";
import { enterFreeDraw } from "./free-draw.js";
import { startTwoP } from "./two-player.js";
import { enterOneVsOne } from "./one-vs-one.js";
import { enterMemoryArchaeology } from "./memory-archaeology.js";
import { enterSocialHub } from "./social-hub.js";
import { enterGallery } from "./gallery.js";

// Hub 右上角的打卡 + 声痕库 count 都从后端 API 拿。
export async function refreshHubBadges() {
  try {
    const s = await api.streak();
    const streakEl = $("hubStreak");
    if (streakEl) streakEl.textContent = "连续打卡 " + (s.current_streak || 0) + " 天";
    const my = await api.myMarks();
    const galleryBadge = $("galleryHubBadge");
    if (galleryBadge) galleryBadge.textContent = my.length + " 张";
  } catch (e) {
    console.warn("[hub] refreshHubBadges failed:", e);
  }
}

export function enterHub() {
  show("hubScreen");
  refreshHubBadges();
}

export function bindHub() {
  document.querySelectorAll(".mode-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      if (tile.hasAttribute("disabled")) return;
      const mode = tile.getAttribute("data-mode");
      enterMode(mode);
    });
  });
}

export function enterMode(mode) {
  if (mode === "free-draw") {
    enterFreeDraw();
  } else if (mode === "two-player") {
    startTwoP();
  } else if (mode === "one-vs-one") {
    enterOneVsOne();
  } else if (mode === "memory-archaeology") {
    enterMemoryArchaeology();
  } else if (mode === "gallery") {
    enterGallery();
  } else if (mode === "social-hub") {
    enterSocialHub();
  } else {
    console.warn("未知 mode:", mode);
  }
}

// 回首页：清状态 + 重置各 mode
export async function goHome(resetters) {
  for (const r of resetters) {
    try { await r(); } catch (_) {}
  }
  enterHub();
}
