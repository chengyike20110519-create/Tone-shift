// web/src/modes/social-hub.js
// 社交广场：同频匹配 · 本周话题 · 情绪广场。数据全部来自后端 /api/v1/*。

import { $, show } from "../lib/dom.js";
import * as api from "../api.js";
import { enterHub } from "./hub.js";

let _eventsBound = false;

function bindEvents() {
  if (_eventsBound) return;
  _eventsBound = true;
  const home = $("socialHomeBtn");
  if (home) home.addEventListener("click", () => enterHub());
}

export function enterSocialHub() {
  show("socialHubScreen");
  bindEvents();
  renderTopic();
  renderMatches();
  renderPublicGallery();
}

async function renderTopic() {
  const title = $("topicTitle");
  const prompt = $("topicPrompt");
  if (title) title.textContent = "加载中…";
  try {
    const topics = await api.topics();
    const t = topics[0];
    if (title) title.textContent = t ? t.title : "暂无话题";
    if (prompt) prompt.textContent = t ? t.prompt : "";
  } catch (e) {
    if (title) title.textContent = "话题加载失败";
    console.warn("[social] 话题加载失败:", e);
  }
}

async function renderMatches() {
  const list = $("matchList");
  if (!list) return;
  list.innerHTML = '<p class="social-empty">加载中…</p>';
  try {
    const { matches } = await api.matches();
    list.innerHTML = "";
    if (!matches || !matches.length) {
      list.innerHTML = '<p class="social-empty">先画一张声痕，就能看到和你同频的人。</p>';
      return;
    }
    matches.forEach((m) => {
      const swatches = (m.mark.stats && m.mark.stats.swatches) || [];
      const first = swatches[0];
      const item = document.createElement("div");
      item.className = "match-item";
      item.innerHTML =
        (m.mark.thumb
          ? '<img class="match-thumb" src="' + m.mark.thumb + '" alt="">'
          : '<div class="match-thumb" style="background:' + (first ? "rgb(" + first.join(",") + ")" : "rgba(255,255,255,0.06)") + '"></div>') +
        '<div class="match-meta"><p class="match-title">' + (m.mark.title || "未命名") + '</p>' +
        '<p class="match-sub">同频 ' + Math.round(m.score * 100) + '%</p></div>';
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = '<p class="social-empty">同频匹配暂时不可用</p>';
    console.warn("[social] 匹配加载失败:", e);
  }
}

async function renderPublicGallery() {
  const list = $("publicGallery");
  if (!list) return;
  list.innerHTML = '<p class="social-empty">加载中…</p>';
  try {
    const marks = await api.gallery();
    list.innerHTML = "";
    if (!marks.length) {
      list.innerHTML = '<p class="social-empty">广场还没有公开声痕。</p>';
      return;
    }
    marks.slice(0, 6).forEach((m) => {
      const swatches = (m.stats && m.stats.swatches) || [];
      const swatchHtml = swatches.slice(0, 4).map((c) => {
        return '<i style="background:rgb(' + c.join(",") + ')"></i>';
      }).join("");
      const item = document.createElement("div");
      item.className = "public-item";
      item.innerHTML =
        (m.thumb
          ? '<img class="public-thumb" src="' + m.thumb + '" alt="">'
          : '<div class="public-thumb" style="background:' + (swatches[0] ? "rgb(" + swatches[0].join(",") + ")" : "rgba(255,255,255,0.06)") + '"></div>') +
        '<div class="public-meta"><p class="public-title">' + (m.title || "未命名") + '</p>' +
        '<div class="public-swatches">' + swatchHtml + '</div></div>';
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = '<p class="social-empty">情绪广场暂时不可用</p>';
    console.warn("[social] 广场加载失败:", e);
  }
}
