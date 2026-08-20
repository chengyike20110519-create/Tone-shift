// web/src/dict_cache.js
// 前端的"字典缓存层" —— 由 web/src/api.js 在启动时填充，被 web/src/lib/data.js 重新 export。
//
// 设计：使用可变引用（数组/对象），由 api.init() 一次性拉取所有字典并写入。
// 这样原来 web/src/lib/data.js 里的 import { PALETTE, PERSONALITIES, ... } from "./data.js"
// 不需要改动：data.js 还是从本模块 re-export，行为一致。

export const PALETTE = [];
export let RECOMMENDED_INDEX = 4;
export let LISTEN_END = 30;
export let PAINT_END = 18;
export const PERSONALITIES = {};
export const WORD_BANK = [];
export const MEM_COLORS = [];
export const MEM_ERAS = [];
export const MOCK_SONGS = [];
export const COPY = {};

// 前端 init 是否完成的 flag；某些 mode 想等 init 完再开画
export let ready = false;
export function markReady() { ready = true; }
