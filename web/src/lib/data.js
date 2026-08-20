// web/src/lib/data.js
// 数据常量现在来自后端（server /api/v1/*），由 api.init() 拉取后写入 dict_cache.js。
// 这里只做 re-export，业务代码不需要改 import 路径。
//
// 之前这里是一堆硬编码字典；现在改为对后端数据层的"代理导出"，
// 保证前端不持有一份独立的常量副本 —— 字典改了只需要改 JSON 文件即可。

export {
  PALETTE,
  RECOMMENDED_INDEX,
  LISTEN_END,
  PAINT_END,
  PERSONALITIES,
  WORD_BANK,
  MEM_COLORS,
  MEM_ERAS,
  MOCK_SONGS,
  COPY
} from "../dict_cache.js";
