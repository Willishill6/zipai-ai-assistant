/**
 * Vercel Serverless Function: /api/analyze
 *
 * V9.3 三步分析流程：
 * Step 1: LLM识别牌面（带自动重试+大小字自动修正）
 * Step 2: 引擎计算最优方案
 * Step 3: 引擎生成建议（无需LLM，节省6秒）
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeHand } from "./zipai-engine";
import { generateAdviceFromEngine } from "./advice-generator";

// ===== LLM 调用 =====
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL
  ? `${process.env.BUILT_IN_FORGE_API_URL.replace(/\/$/, "")}/v1/chat/completions`
  : process.env.OPENAI_BASE_URL
  ? `${process.env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`
  : "https://api.manus.im/api/llm-proxy/v1/chat/completions";
const FORGE_API_KEY =
  process.env.BUILT_IN_FORGE_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "sk-5WXsFtEZiTrf54UFE4nnAu";

// ===== V10.0 识别 Prompt =====
const TILE_RECOGNITION_PROMPT = `你是桂林飞飞字牌游戏的牌面识别专家。这不是麻将！

## ❗❗❗ 最重要：只能使用这初21个字 ❗❗❗
手牌只能是以下21种之一，不得使用任何其他汉字：
小字：一 二 三 四 五 六 七 八 九 十
大字：壹 贰 叁 肆 伍 陆 柒 捌 玖 拾
鬼牌：鬼

## 大字 vs 小字区分（最关键！）
| 数 | 小字 | 特征 | 大字 | 特征 | 颜色 |
|-----|------|------|------|------|------|
| 1 | 一 | 一横，极简 | 壹 | 有士冒豆，复杂 | 黑 |
| 2 | 二 | 两横，极简 | 贰 | 有弋和贝，复杂 | 红 |
| 3 | 三 | 三横，极简 | 叁 | 有厶和大，复杂 | 黑 |
| 4 | 四 | 口中两竖 | 肆 | 有聿和长横 | 黑 |
| 5 | 五 | 横竖横竖，无偏旁 | 伍 | 左有人旁仟 | 黑 |
| 6 | 六 | 点横撇点，无偏旁 | 陆 | 左有耳刀旁阝 | 黑 |
| 7 | 七 | 一横一弯，极简 | 柒 | 上木下复杂 | 红 |
| 8 | 八 | 撇捣，极简 | 捌 | 左有提手旁扌 | 黑 |
| 9 | 九 | 撇和弯钉，极简 | 玖 | 左王右久 | 黑 |
| 10 | 十 | 十字形，极简 | 拾 | 左有提手旁扌 | 红 |

## 手牌区域（截图底部两排小牌）
- 上排：底部上方一排，通幸10-11张
- 下排：截图最底一排，通幸10-11张
- 合计20张（闲家）或21张（庄家）
- 底部左侧的明牌组不是手牌！

## ❗ 必须遵守的规则
1. 手牌只能从上述20个字中选择，绝对不能用其他汉字
2. 每种牌最多4张，鬼牌最多2张
3. 红色牌只有：二、七、十、贰、柒、拾
4. 手牌总数必须是20或21张
5. 识别完后必须自我检查：有没有不在合法列表的字？有没有某种牌超过4张？`;

// ===== JSON Schema 约束 =====
const RECOGNITION_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "tile_recognition",
    strict: true,
    schema: {
      type: "object",
      properties: {
        handTiles: {
          type: "array",
          items: { type: "string" },
          description: "我的手牌列表（底部区域），每张牌用标准名称：一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾鬼",
        },
        myExposedGroups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tiles: { type: "array", items: { type: "string" } },
              type: { type: "string", description: "碰/坎/偎/提/跑/吃/顺子/绞牌" },
            },
            required: ["tiles", "type"],
            additionalProperties: false,
          },
          description: "我方已明示的牌组（底部左侧）",
        },
        opponentExposedGroups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tiles: { type: "array", items: { type: "string" } },
              type: { type: "string", description: "碰/坎/偎/提/跑/吃/顺子/绞牌" },
            },
            required: ["tiles", "type"],
            additionalProperties: false,
          },
          description: "对手已明示的牌组（顶部区域）",
        },
        discardedTiles: {
          type: "array",
          items: { type: "string" },
          description: "弃牌区已打出的牌（中间散落的牌）",
        },
        remainingTiles: {
          type: "integer",
          description: "剩余底牌数量（右上角数字）",
        },
        myCurrentHuxi: {
          type: "integer",
          description: "我方当前显示的胡息数（左侧数字，如果看不到填0）",
        },
        opponentCurrentHuxi: {
          type: "integer",
          description: "对手当前显示的胡息数（如果看不到填0）",
        },
        actionButtons: {
          type: "string",
          description: "当前可见的操作按钮（如：胡/碰/吃/X），如果没有则填'无'",
        },
        isDealer: {
          type: "boolean",
          description: "我是否是庄家（庄家标记在头像旁，庄家21张手牌，闲家20张）",
        },
      },
      required: [
        "handTiles",
        "myExposedGroups",
        "opponentExposedGroups",
        "discardedTiles",
        "remainingTiles",
        "myCurrentHuxi",
        "opponentCurrentHuxi",
        "actionButtons",
        "isDealer",
      ],
      additionalProperties: false,
    },
  },
};

// ===== LLM 调用函数 =====
const JSON_OBJECT_FORMAT = { type: "json_object" };

async function invokeLLM(messages: any[], responseFormat?: any): Promise<any> {
  if (!FORGE_API_KEY) throw new Error("API Key 未配置");
  const payload: any = {
    model: "gemini-2.5-flash",
    messages,
    max_tokens: 8192,
    response_format: responseFormat || JSON_OBJECT_FORMAT,
  };
  const response = await fetch(FORGE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }
  return response.json();
}

function stripCodeBlock(text: string): string {
  const B = String.fromCharCode(96);
  let s = text;
  s = s.split(B+B+B+'json').join('').split(B+B+B).join('').trim();
  return s;
}

function normalizeRecognition(raw: any): any {
  // 如果是对象且有handTiles字段，直接返回
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.handTiles)) {
    return raw;
  }
  // 如果是数组（模型返回了 [{text: '一', is_ghost: false}, ...] 格式）
  if (Array.isArray(raw)) {
    const handTiles = raw.map((item: any) => {
      if (typeof item === 'string') return item;
      return item.text || item.tile || item.card || item.name || '';
    }).filter(Boolean);
    return {
      handTiles,
      myExposedGroups: [],
      opponentExposedGroups: [],
      discardedTiles: [],
      remainingTiles: 0,
      myCurrentHuxi: 0,
      opponentCurrentHuxi: 0,
      actionButtons: '无',
      isDealer: handTiles.length === 21,
    };
  }
  return raw;
}

function extractJSON(text: string): any {
  if (!text) throw new Error("Empty response");
  const cleaned = stripCodeBlock(text);
  try { return normalizeRecognition(JSON.parse(cleaned)); } catch {}
  // 尝试提取JSON对象
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return normalizeRecognition(JSON.parse(cleaned.slice(start, end + 1))); } catch {}
  }
  // 尝试提取JSON数组
  const aStart = cleaned.indexOf("[");
  const aEnd = cleaned.lastIndexOf("]");
  if (aStart !== -1 && aEnd !== -1 && aEnd > aStart) {
    try { return normalizeRecognition(JSON.parse(cleaned.slice(aStart, aEnd + 1))); } catch {}
  }
  throw new Error("Cannot extract JSON from: " + text.slice(0, 200));
}

function getEmptyAnalysis(content?: string): any {
  return {
    handTiles: [],
    myExposedGroups: [],
    opponentExposedGroups: [],
    discardedTiles: [],
    combinationPlans: [],
    handGroups: [],
    ghostCardAnalysis: { hasGhost: false, currentUsage: "无鬼牌", allOptions: [], bestOption: "无" },
    huxiBreakdown: "",
    currentHuxi: 0,
    potentialHuxi: 0,
    opponentEstimatedHuxi: 0,
    remainingTiles: 0,
    defenseAnalysis: { riskLevel: "未知", isDefenseMode: false, defenseReason: "", tilesSafety: [], dianpaoWarning: "" },
    gamePhase: "未知",
    strategyMode: "未知",
    tileEfficiency: [],
    kanLockAnalysis: "",
    actionButtons: "无",
    recommendedAction: "分析失败",
    recommendedTile: "",
    discardPriority: [],
    forwardPlan: "",
    aiSuggestion: typeof content === "string" ? content : "无法解析AI响应",
    analysisReasoning: "",
  };
}

// ===== 大小字互转表 =====
const LARGE_TO_SMALL: Record<string, string> = {
  '壹': '一', '贰': '二', '叁': '三', '肆': '四', '伍': '五',
  '陆': '六', '柒': '七', '捌': '八', '玖': '九', '拾': '十'
};
const SMALL_TO_LARGE: Record<string, string> = {
  '一': '壹', '二': '贰', '三': '叁', '四': '肆', '五': '伍',
  '六': '陆', '七': '柒', '八': '捌', '九': '玖', '十': '拾'
};

// ===== 合法牌名白名单 =====
const VALID_TILES = new Set([
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', // 小字
  '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾', // 大字
  '鬼' // 鬼牌
]);

// 常见识别错误的字符映射表（强制纠正）
const TILE_CORRECTION: Record<string, string> = {
  // 柒的常见误识
  '染': '柒', '柔': '柒', '架': '柒', '槨': '柒', '柑': '柒', '枵': '柒',
  '柜': '柒', '柏': '柒', '柠': '柒', '查': '柒',
  // 玖的常见误识（荣、荣等字形相近）
  '荣': '玖', '荫': '玖', '荬': '玖', '荭': '玖',
  '荮': '玖', '药': '玖', '荰': '玖', '荱': '玖', '荲': '玖',
  '荳': '玖', '荴': '玖', '荵': '玖', '荶': '玖', '荷': '玖',
  '荸': '玖', '荹': '玖', '荺': '玖', '荻': '玖', '荼': '玖',
  // 叁的常见误识
  '参': '叁', '叄': '叁', '三': '三', // 三已合法
  // 其他常见误识
  '山': '三', '己': '九', '已': '二', '丁': '一', '丙': '三',
  '千': '壹', '万': '壹', // 千/万被误识为壹
  '化': '六',
};

function sanitizeTile(tile: string): string | null {
  if (!tile || typeof tile !== 'string') return null;
  const t = tile.trim();
  if (VALID_TILES.has(t)) return t;
  // 尝试纠正已知错误
  if (TILE_CORRECTION[t]) return TILE_CORRECTION[t];
  // 如果是多字符串，取第一个字符尝试
  if (t.length > 1) {
    const first = t[0]!;
    if (VALID_TILES.has(first)) return first;
    if (TILE_CORRECTION[first]) return TILE_CORRECTION[first];
  }
  console.log(`[FILTER] 非法牌名被过滤: "${t}"`);
  return null; // 非法牌名，丢弃
}

function filterTiles(tiles: string[]): string[] {
  return tiles.map(sanitizeTile).filter((t): t is string => t !== null);
}

async function runAnalysis(imageBase64: string): Promise<any> {
  const t0 = Date.now();

  // ===== Step 1: LLM 识别牌面 =====
  const expectedTileCount = 20; // 默认闲家，LLM会自动判断庄/闲
  const recognitionResponse = await invokeLLM(
    [
      { role: "system", content: TILE_RECOGNITION_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `请精确识别这张桂林飞飞字牌游戏截图。

❗❗❗ 最重要：手牌在截图底部，分上下两排。你必须识别每一张！

识别步骤：
1. 先看底部上排，从左到右逐张识别（通幸10-11张）
2. 再看底部下排，从左到右逐张识别（通幸10-11张）
3. 上排+下排总数必须恰好20或21张！
4. 每张牌先看颜色（黑/红），再看字形复杂度（有无偏旁部首）
5. 红色且笔画简单（2笔）的字只可能是小字七或小字十
6. 每种牌最多4张，超过说明混淆了大小字

返回格式（必须是JSON对象）：
{
  "handTiles": ["一","二",...],
  "myExposedGroups": [],
  "opponentExposedGroups": [],
  "discardedTiles": [],
  "remainingTiles": 0,
  "myCurrentHuxi": 0,
  "opponentCurrentHuxi": 0,
  "actionButtons": "无",
  "isDealer": false
}`,
          },
          {
            type: "image_url",
            image_url: { url: imageBase64, detail: "high" },
          },
        ],
      },
    ]
  );

  const recContent = recognitionResponse.choices[0]?.message?.content;
  let recognition: any;
  try {
    const rawText = typeof recContent === "string" ? recContent : JSON.stringify(recContent);
    recognition = extractJSON(rawText);
  } catch (e) {
    console.error("[analyze] JSON parse failed:", String(e).slice(0, 200));
    return getEmptyAnalysis("牌面识别失败");
  }

  let handTiles: string[] = filterTiles(recognition.handTiles || []);
  console.log(`[DEBUG] LLM识别手牌(${handTiles.length}张): ${handTiles.join(", ")}`);

  if (handTiles.length === 0) {
    return getEmptyAnalysis("未能识别到手牌");
  }

  // ===== 自动重试：识别出的合法手牌不足17张时重试 =====
  if (handTiles.length < 17) {
    console.log(`[WARN] 手牌只识别出${handTiles.length}张（应为20-21张），自动重试识别...`);
    try {
      const retryResponse = await invokeLLM(
        [
          { role: "system", content: TILE_RECOGNITION_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `上次识别只找到${handTiles.length}张手牌，这明显不对！手牌应该恰好20或21张。\n\n请重新仔细识别。手牌在截图最底部，分上下两排：\n- 上排：紧贴下排上方，通常10-11张小白牌\n- 下排：截图最底部，通常10-11张小白牌\n\n请从上排左边第一张开始，逐张识别到下排最右边一张。总数必须恰好20或21张！`,
              },
              {
                type: "image_url",
                image_url: { url: imageBase64, detail: "high" },
              },
            ],
          },
        ],
        RECOGNITION_JSON_SCHEMA
      );
      const retryContent = retryResponse.choices[0]?.message?.content;
      const retryRawText = typeof retryContent === "string" ? retryContent : JSON.stringify(retryContent);
      const retryRecognition = extractJSON(retryRawText);
      const retryTiles = filterTiles(retryRecognition.handTiles || []);
      console.log(`[DEBUG] 重试识别手牌(${retryTiles.length}张): ${retryTiles.join(", ")}`);
      if (retryTiles.length > handTiles.length) {
        handTiles = retryTiles;
        recognition = { ...recognition, ...retryRecognition, handTiles: retryTiles };
        console.log(`[INFO] 重试成功，手牌从${handTiles.length}张增加到${retryTiles.length}张`);
      }
    } catch (e) {
      console.log(`[WARN] 重试识别失败:`, e);
    }
  }

  // ===== 自动修正：每种牌最多4张，鬼牌最多2张，超过则尝试转换大小字 =====
  const tileCount: Record<string, number> = {};
  for (const t of handTiles) {
    tileCount[t] = (tileCount[t] || 0) + 1;
  }
  let needsFix = false;
  
  // 鬼牌最多2张，超过的直接删除
  if ((tileCount['鬼'] || 0) > 2) {
    needsFix = true;
    const excess = tileCount['鬼']! - 2;
    console.log(`[WARN] 鬼牌识别出${tileCount['鬼']}张（最多2张），删除${excess}张多余鬼牌`);
    let removed = 0;
    handTiles = handTiles.filter(t => {
      if (t === '鬼' && removed < excess) {
        removed++;
        return false;
      }
      return true;
    });
    tileCount['鬼'] = 2;
  }
  
  for (const [tile, count] of Object.entries(tileCount)) {
    if (count > 4 && tile !== '鬼') {
      needsFix = true;
      console.log(`[WARN] 牌"${tile}"识别出${count}张（最多4张），尝试自动修正`);
      const counterpart = LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile];
      if (counterpart) {
        const counterpartCount = tileCount[counterpart] || 0;
        const excess = count - 4;
        const canConvert = Math.min(excess, 4 - counterpartCount);
        if (canConvert > 0) {
          let converted = 0;
          handTiles = handTiles.map(t => {
            if (t === tile && converted < canConvert) {
              converted++;
              tileCount[tile]!--;
              tileCount[counterpart] = (tileCount[counterpart] || 0) + 1;
              return counterpart;
            }
            return t;
          });
          console.log(`[FIX] 将26张"${tile}"修正为"${counterpart}"`);
        }
      }
    }
  }
  if (needsFix) {
    recognition.handTiles = handTiles;
    console.log(`[DEBUG] 修正后手牌(${handTiles.length}张): ${handTiles.join(", ")}`);
  }

  // ===== Step 2: 引擎计算所有拆组方案 =====
  const exposedHuxi = recognition.myCurrentHuxi || 0;
  const knownTiles: string[] = [
    ...(recognition.discardedTiles || []),
    ...(recognition.myExposedGroups || []).flatMap((g: any) => g.tiles || []),
    ...(recognition.opponentExposedGroups || []).flatMap((g: any) => g.tiles || []),
  ];
  const engineResult = analyzeHand(handTiles, { exposedHuxi, minHuxi: 10, knownTiles });

  // ===== Step 3: 引擎直接生成建议（无需LLM，节省6秒）=====
  const advice = generateAdviceFromEngine(engineResult, recognition, exposedHuxi);
  console.log(`[PERF] 总耗时: ${Date.now() - t0}ms`);

  const typeLabel = (type: string) => {
    if (type === "kan") return "坎";
    if (type === "shunzi") return "顺子";
    if (type === "ghost_kan") return "坎(鬼)";
    if (type === "ghost_shunzi") return "顺(鬼)";
    if (type === "mixed_kan") return "组合牌";
    if (type === "ghost_mixed") return "组合牌(鬼)";
    return type;
  };

  // 确保最终返回的handTiles是经过白名单过滤的版本
  return {
    handTiles: handTiles,
    myExposedGroups: (recognition.myExposedGroups || []).map((g: any) => ({ ...g, huxi: g.huxi || 0 })),
    opponentExposedGroups: (recognition.opponentExposedGroups || []).map((g: any) => ({ ...g, huxi: g.huxi || 0 })),
    discardedTiles: recognition.discardedTiles || [],
    remainingTiles: recognition.remainingTiles || 0,
    actionButtons: recognition.actionButtons || "无",
    isDealer: recognition.isDealer ?? (handTiles.length === 21),
    combinationPlans: engineResult.plans.map((plan: any, idx: number) => ({
      planName: `方案${idx + 1}`,
      groups: plan.groups.map((g: any) => ({ tiles: g.tiles, type: typeLabel(g.type), huxi: g.huxi })),
      totalHuxi: plan.totalHuxi,
      remainingLoose: plan.remainingCount,
      tilesNeeded: plan.remainingCount,
      stepsToTing: plan.stepsToTing,
      looseRelation: plan.looseRelation,
      tingWidth: "",
      isOptimal: idx === 0,
      reason: idx === 0 ? "引擎评分最高" : `评分${plan.score}`,
    })),
    handGroups: engineResult.plans[0]?.groups.map((g: any) => ({ tiles: g.tiles, type: typeLabel(g.type), huxi: g.huxi })) || [],
    ghostCardAnalysis: {
      hasGhost: engineResult.ghostAnalysis.hasGhost,
      currentUsage: engineResult.ghostAnalysis.hasGhost ? `最优替代: 鬼→${engineResult.ghostAnalysis.bestReplacement}` : "无鬼牌",
      allOptions: engineResult.ghostAnalysis.allReplacements.map((r: any) => ({
        replaceTile: r.tile,
        formedGroup: "",
        groupType: "",
        huxiGain: r.bestPlanHuxi,
        isOptimal: r.tile === engineResult.ghostAnalysis.bestReplacement,
      })),
      bestOption: engineResult.ghostAnalysis.hasGhost ? `鬼→${engineResult.ghostAnalysis.bestReplacement}` : "无",
    },
    tileEfficiency: engineResult.plans[0]?.looseAnalysis.map((la: any) => ({
      tile: la.tile,
      jinzhangCount: la.jinzhangCount,
      isWaste: la.isWaste,
      wasteReason: la.isWaste ? "无组合可能" : (la.partialShunzi.length > 0 ? `搭子:差${la.partialShunzi[0].need}` : ""),
    })) || [],
    lockedKan: engineResult.lockedKan.map((kan: any) => ({ tiles: kan.tiles, huxi: kan.huxi, description: kan.description })),
    kanHuxi: engineResult.kanHuxi,
    kanLockAnalysis: engineResult.lockedKan.length > 0
      ? engineResult.lockedKan.map((g: any) => `🔒${g.tiles.join("")}坎(${g.huxi}胡)不可拆`).join("；")
      : "",
    tingAnalysis: (engineResult.tingAnalysis || []).slice(0, 10).map((ting: any) => ({
      discard: ting.discard,
      tingTiles: ting.tingTiles.map((t: any) => ({ tile: t.tile, maxHuxi: t.maxHuxi, planDesc: t.bestGroups ? t.bestGroups.map((g: any) => g.description).join(" + ") : "" })),
      tingWidth: ting.tingWidth,
      tingCount: ting.tingCount,
      maxHuxi: ting.maxHuxi,
    })),
    huxiBreakdown: advice.huxiBreakdown || "",
    currentHuxi: advice.currentHuxi || 0,
    potentialHuxi: advice.potentialHuxi || 0,
    opponentEstimatedHuxi: recognition.opponentCurrentHuxi || 0,
    gamePhase: advice.gamePhase || "未知",
    strategyMode: advice.strategyMode || "未知",
    recommendedAction: advice.recommendedAction || "",
    recommendedTile: advice.recommendedTile || "",
    discardPriority: advice.discardPriority || [],
    forwardPlan: advice.forwardPlan || "",
    defenseAnalysis: advice.defenseAnalysis || { riskLevel: "未知", isDefenseMode: false, defenseReason: "", tilesSafety: [], dianpaoWarning: "" },
    aiSuggestion: advice.aiSuggestion || "",
    analysisReasoning: advice.analysisReasoning || "",
    optimalPlanSummary: advice.optimalPlanSummary || "",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "Missing imageBase64 field" });
    }
    const result = await runAnalysis(imageBase64);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[analyze] Error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
