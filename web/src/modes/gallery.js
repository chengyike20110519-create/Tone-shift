// web/src/modes/gallery.js
// 声痕库：展示当前用户保存的声痕卡，可删除。数据全部来自后端 /api/v1/marks。

import { $, show } from "../lib/dom.js";
import * as api from "../api.js";
import { enterHub } from "./hub.js";

let _bound = false;

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return m + "-" + day + " " + h + ":" + min;
}

function swatchColor(swatches, idx) {
  const c = swatches && swatches[idx];
  return c ? "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")" : "rgba(255,255,255,0.06)";
}

async function renderCards() {
  const grid = $("galleryGrid");
  const empty = $("galleryEmpty");
  const count = $("galleryCount");
  if (!grid) return;

  let marks = [];
  try {
    marks = await api.myMarks();
  } catch (e) {
    console.warn("[gallery] 拉取声痕失败:", e);
  }

  grid.innerHTML = "";
  if (count) count.textContent = marks.length + " 张卡";
  if (empty) empty.hidden = marks.length !== 0;
  if (!marks.length) return;

  marks.forEach((m) => {
    const swatches = (m.stats && m.stats.swatches) || [];
    const mood = m.summary && m.summary.mood ? m.summary.mood : "";

    const card = document.createElement("article");
    card.className = "gallery-card";

    if (m.thumb) {
      const img = document.createElement("img");
      img.src = m.thumb;
      img.alt = m.title || "声痕";
      card.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "gallery-thumb placeholder";
      ph.style.background = swatchColor(swatches, 0);
      card.appendChild(ph);
    }

    const meta = document.createElement("div");
    meta.className = "gallery-meta";
    const swatchHtml = swatches.slice(0, 5).map((c) => {
      return '<i style="background:rgb(' + c.join(",") + ')"></i>';
    }).join("");
    meta.innerHTML =
      '<h3 class="gallery-card-title">' + (m.title || "未命名") + '</h3>' +
      '<p class="gallery-card-mood">' + mood + (m.is_public ? "" : " · 私密") + '</p>' +
      '<p class="gallery-card-date">' + fmtDate(m.created_at) + '</p>' +
      '<div class="gallery-card-swatches">' + swatchHtml + '</div>';
    card.appendChild(meta);

    const del = document.createElement("button");
    del.className = "gallery-delete";
    del.textContent = "✕";
    del.title = "删除这张";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      try { await api.removeMark(m.id); } catch (err) {
        console.warn("[gallery] 删除失败:", err);
      }
      renderCards();
    });
    card.appendChild(del);
    grid.appendChild(card);
  });
}

function bindEvents() {
  if (_bound) return;
  _bound = true;
  const home = $("galleryHomeBtn");
  if (home) home.addEventListener("click", () => enterHub());
}

export function enterGallery() {
  bindEvents();
  show("galleryScreen");
  renderCards();
}
