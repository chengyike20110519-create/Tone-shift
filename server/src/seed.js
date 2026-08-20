// server/src/seed.js
import { getState, flush } from './db.js';
// 把字典灌进 DB（首次启动时执行）。后续要改字 / 加性格，编辑这里然后删 data/toneshift.db 重建即可。

export const SEEDS = {
  palette: [
    { name: "炽", color: "#ff6b6b", timbre: "triangle" },
    { name: "暖", color: "#ffb36b", timbre: "sine" },
    { name: "光", color: "#ffd977", timbre: "sine" },
    { name: "静", color: "#5eead4", timbre: "sine" },
    { name: "深", color: "#5b8cff", timbre: "sawtooth" },
    { name: "雾", color: "#b39ddb", timbre: "triangle" }
  ],
  recommended_index: 4,
  listen_end: 30,
  paint_end: 18,
  personalities: {
    nostalgic: {
      id: "nostalgic", name: "怀旧收集者",
      blurb: "听到旋律就掉进年代的抽屉",
      palette: [1, 2, 3],
      preferred_words: ["信", "旧照片", "旧楼", "灯塔", "钟", "窗", "镜子", "雨", "雪", "影子"],
      voice_lines: ["这歌像 90 年代的港台流行", "听着像老式磁带", "让人想起 80 年代的校园"],
      draw_style: "thick",
      drift_summary: "怀旧者把旋律拽回 90 年代，颜色整体偏暖，笔触像老磁带。"
    },
    rational: {
      id: "rational", name: "理性乐评人",
      blurb: "拆解结构，不评价感受",
      palette: [4, 5],
      preferred_words: ["城市", "钟", "桥", "影子", "窗", "草原", "灯塔", "长椅"],
      voice_lines: ["结构是三段式", "副歌在 1:30 左右", "BPM 大约 90"],
      draw_style: "geometric",
      drift_summary: "理性人把歌拆成节拍/调性，颜色收窄到冷色，形状变直。"
    },
    visual: {
      id: "visual", name: "视觉系玩家",
      blurb: "用颜色听歌",
      palette: [0, 1, 2, 3, 4, 5],
      preferred_words: ["光", "雨", "雪", "太阳", "月亮", "镜子", "海", "火", "草原", "雨伞"],
      voice_lines: ["画面是一片金黄", "像燃烧的红色", "像水底的蓝"],
      draw_style: "bold",
      drift_summary: "视觉玩家让色彩变饱和、笔触变夸张，整体像海报。"
    },
    absurd: {
      id: "absurd", name: "荒诞派",
      blurb: "把歌听成一支动物纪录片",
      palette: [0, 1, 2, 3, 4, 5],
      preferred_words: ["舞", "钟", "钥匙", "酒", "烟", "长椅", "月亮", "影子", "钟", "钥匙"],
      voice_lines: ["我觉得像一只鸭子", "这歌闻起来是紫红色", "像月球上的仙人掌"],
      draw_style: "random",
      drift_summary: "荒诞派把歌拐进一个不相干的画面，结尾观众会笑出来。"
    },
    empathic: {
      id: "empathic", name: "共情型听众",
      blurb: "在歌里听见别人",
      palette: [0, 1, 2],
      preferred_words: ["孤独", "温柔", "热烈", "安静", "离别", "重逢", "眼泪", "信", "背影", "拥抱"],
      voice_lines: ["这歌有点想哭", "像一个人在深夜", "像是告别"],
      draw_style: "soft",
      drift_summary: "共情者把歌拉回到'人'的尺度，颜色偏暖，笔触柔。"
    }
  },
  word_bank: [
    "雨", "雪", "海", "山", "夜", "晨", "风", "火",
    "孤独", "温柔", "热烈", "安静", "离别", "重逢",
    "城市", "草原", "灯塔", "长椅", "信", "窗",
    "镜子", "旧照片", "雨伞", "背影", "眼泪",
    "舞", "钟", "钥匙", "烟", "酒", "月亮",
    "太阳", "影子", "桥", "旧楼", "教室", "站台"
  ],
  mem_colors: [
    { name: "红", color: "#ff6b6b" },
    { name: "橙", color: "#ffb36b" },
    { name: "黄", color: "#ffd977" },
    { name: "绿", color: "#5eead4" },
    { name: "蓝", color: "#5b8cff" },
    { name: "紫", color: "#a78bfa" },
    { name: "白", color: "#eef1f7" },
    { name: "黑", color: "#2a2a2a" }
  ],
  mem_eras: ["90年代", "00年代", "10年代", "近年", "不确定"],
  mock_songs: [
    { id: "sunny", title: "《晴天》", artist: "周杰伦", era: "00年代",
      mood: ["蓝", "紫", "白"],
      contour: [60, 64, 67, 69, 71, 72, 74, 76, 74, 72, 71, 69, 67, 64, 60],
      tags: ["校园", "雨", "回忆"] },
    { id: "windup", title: "《起风了》", artist: "买辣椒也用券", era: "10年代",
      mood: ["黄", "橙", "白"],
      contour: [62, 65, 67, 69, 72, 74, 72, 69, 67, 65, 62, 60, 62, 65, 67],
      tags: ["温柔", "怀念", "风"] },
    { id: "those_years", title: "《那些年》", artist: "胡夏", era: "10年代",
      mood: ["蓝", "紫", "绿"],
      contour: [60, 62, 64, 67, 69, 71, 72, 71, 69, 67, 64, 62, 60, 62, 64],
      tags: ["青春", "教室", "回忆"] },
    { id: "youth", title: "《同桌的你》", artist: "老狼", era: "90年代",
      mood: ["黄", "绿", "白"],
      contour: [60, 62, 64, 65, 67, 69, 71, 69, 67, 65, 64, 62, 60, 62, 64],
      tags: ["校园", "旧照片", "青春"] },
    { id: "ordinary_road", title: "《平凡之路》", artist: "朴树", era: "10年代",
      mood: ["白", "蓝", "黑"],
      contour: [60, 64, 67, 69, 72, 74, 76, 74, 72, 69, 67, 64, 60, 62, 64],
      tags: ["孤独", "城市", "影子"] },
    { id: "tomorrow", title: "《明天会更好》", artist: "群星", era: "90年代",
      mood: ["黄", "白", "绿"],
      contour: [60, 62, 64, 65, 67, 69, 71, 72, 74, 72, 71, 69, 67, 65, 64],
      tags: ["温暖", "晨", "重逢"] },
    { id: "august", title: "《八月照相馆》", artist: "李志", era: "10年代",
      mood: ["白", "蓝", "紫"],
      contour: [60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 65, 67, 69, 71],
      tags: ["安静", "旧照片", "夏"] },
    { id: "redis", title: "《后来》", artist: "刘若英", era: "00年代",
      mood: ["白", "蓝", "紫"],
      contour: [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60],
      tags: ["离别", "眼泪", "背影"] }
  ],

  // 文案/默认值的字典：前端任何"业务文案"（结局描述、默认标题）从这里读，不再硬编码
  copy: {
    defaults: {
      free_draw_title: "旧手机里的第一首歌",
      privacy_default: "public"
    },
    endings: {
      reconcile: {
        name: "和解",
        desc: "你用力画下暖色。她在这首歌里留下一个拥抱，说：我原谅了。"
      },
      farewell: {
        name: "告别",
        desc: "你画得很轻，像怕惊动任何人。她走的时候，没有回头。"
      },
      stay: {
        name: "留下",
        desc: "你既没有用力，也没有放手。这首歌没有答案，但还在等你画完。"
      }
    }
  }
};

// 把字典灌进 DB（仅当对应 key 还没填时）

export function seedIfEmpty() {
  const state = getState();
  let changed = false;
  for (const [k, v] of Object.entries(SEEDS)) {
    const cur = state.dicts[k];
    const empty = cur === undefined || cur === null ||
      (Array.isArray(cur) && cur.length === 0) ||
      (typeof cur === 'object' && !Array.isArray(cur) && Object.keys(cur).length === 0);
    if (empty) { state.dicts[k] = v; changed = true; }
  }
  if (changed) flush();
}

// 社交广场的初始内容：一个本周话题 + 几张公开示例声痕。
// 仅当对应区域为空时灌入，避免覆盖用户真实数据。
export function seedSocialIfEmpty() {
  const state = getState();
  let changed = false;

  if (!state.topic_challenges || state.topic_challenges.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    state.topic_challenges = [{
      id: "week-" + today,
      week: today,
      title: "用红色画一首让你想哭的歌",
      prompt: "别画具象，只画那一刻的颜色。本周主题色：红。",
      hue_bias: "red",
      created_at: new Date().toISOString()
    }];
    changed = true;
  }

  if (!state.marks || Object.keys(state.marks).length === 0) {
    const now = Date.now();
    const demo = [
      {
        id: "demo_rain", mode: "free-draw", title: "雨夜长椅", is_public: true,
        owner_token: "demo:seed", palette: null,
        stats: {
          colorHist: { red: 1, orange: 0.2, yellow: 0.1, green: 0, blue: 0.5, purple: 0.6 },
          swatches: [[255, 107, 107], [167, 139, 250], [91, 140, 255]]
        },
        summary: { mood: "沉静", ending: "farewell" },
        thumb: null, created_at: new Date(now - 86400000).toISOString()
      },
      {
        id: "demo_wind", mode: "free-draw", title: "起风了", is_public: true,
        owner_token: "demo:seed", palette: null,
        stats: {
          colorHist: { red: 0.3, orange: 0.8, yellow: 1, green: 0.1, blue: 0.1, purple: 0.1 },
          swatches: [[255, 217, 119], [255, 179, 107], [255, 107, 107]]
        },
        summary: { mood: "温暖", ending: "reconcile" },
        thumb: null, created_at: new Date(now - 172800000).toISOString()
      },
      {
        id: "demo_morning", mode: "free-draw", title: "晨雾", is_public: true,
        owner_token: "demo:seed", palette: null,
        stats: {
          colorHist: { red: 0.1, orange: 0.1, yellow: 0.2, green: 1, blue: 0.6, purple: 0.1 },
          swatches: [[94, 234, 212], [91, 140, 255], [238, 241, 247]]
        },
        summary: { mood: "游离", ending: "stay" },
        thumb: null, created_at: new Date(now - 259200000).toISOString()
      }
    ];
    for (const m of demo) state.marks[m.id] = m;
    changed = true;
  }

  if (changed) flush();
}
