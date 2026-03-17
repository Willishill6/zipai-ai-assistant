/**
 * Vercel Serverless Function: /api/analyze
 * 
 * 两步识别法：
 * Step 1: LLM识别每张牌的数字(1-10)和是否为大字
 * Step 2: 引擎计算最优方案
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

// ===== 大小字对照表 =====
const SMALL_CHARS = ["一","二","三","四","五","六","七","八","九","十"];
const LARGE_CHARS = ["壹","贰","叁","肆","伍","陆","柒","捌","玖","拾"];
const NUM_TO_SMALL: Record<number, string> = {};
const NUM_TO_LARGE: Record<number, string> = {};
const CHAR_TO_NUM: Record<string, number> = {};
for (let i = 0; i < 10; i++) {
  NUM_TO_SMALL[i+1] = SMALL_CHARS[i];
  NUM_TO_LARGE[i+1] = LARGE_CHARS[i];
  CHAR_TO_NUM[SMALL_CHARS[i]] = i+1;
  CHAR_TO_NUM[LARGE_CHARS[i]] = i+1;
}
CHAR_TO_NUM["鬼"] = 0;

// ===== 识别 Prompt（V3：两步法，先识别数字，再识别大小字）=====
const STEP1_PROMPT = `你是桂林飞飞字牌游戏的牌面识别专家。

## 任务：识别手牌区域的所有牌

### 手牌区域定位（最重要！）
- 手牌 = 截图最底部的白色方块牌，通常分2-3排，阶梯状排列
- 明牌组 = 截图左侧已翻开的竖排牌组（碰/坎/吃），这些不是手牌！
- 对手牌 = 截图顶部，不是手牌！
- 弃牌 = 中间散落的牌，不是手牌！

### 识别规则
1. 每张牌显示一个汉字，代表数字1-10，或者是鬼牌（特殊图案）
2. 每个数字有两种写法：小字（笔画简单）和大字（笔画复杂有偏旁）
3. 你只需要识别数字（1-10）和是否为大字，不需要写出具体汉字

### 大字判断方法（关键！）
- 数字5：小字"五"（4笔，无偏旁，横竖横竖）vs 大字"伍"（有单人旁亻在左边）
- 数字6：小字"六"（4笔，点横撇点）vs 大字"陆"（有耳刀旁阝在左边）
- 数字7：小字"七"（2笔，极简）vs 大字"柒"（上木下复杂，10笔）
- 数字8：小字"八"（2笔，撇捺）vs 大字"捌"（有提手旁扌在左边）
- 数字9：小字"九"（2笔，撇弯钩）vs 大字"玖"（有王旁在左边）
- 数字10：小字"十"（2笔，十字形）vs 大字"拾"（有提手旁扌在左边）
- 数字1：小字"一"（1笔横线）vs 大字"壹"（上士下冖豆，复杂）
- 数字2：小字"二"（2笔两横）vs 大字"贰"（左弋右贝，复杂）
- 数字3：小字"三"（3笔三横）vs 大字"叁"（上部撇点，下部大，复杂）
- 数字4：小字"四"（口框内两竖）vs 大字"肆"（左聿右长横，极复杂）

### 颜色规律（辅助判断）
- 红色牌：只有2、7、10（小字二七十 或 大字贰柒拾）
- 黑色牌：其他所有数字（1、3、4、5、6、8、9）
- 如果看到红色且字形极简（2笔以内）→ 一定是小字（七或十）
- 如果看到红色且字形复杂 → 大字（贰、柒、拾）

### 验证规则
- 每种牌（同数字同大小字）最多4张
- 庄家手牌21张，闲家手牌20张
- 鬼牌最多2张

### 输出格式（纯JSON，不加代码块）
{
  "handTiles": [
    {"num": 5, "large": false},
    {"num": 5, "large": false},
    {"num": 5, "large": false},
    {"num": 5, "large": true},
    {"num": 0, "large": false}
  ],
  "myExposedGroups": [{"tiles": ["五","五","五"], "type": "碰"}],
  "opponentExposedGroups": [],
  "discardedTiles": [],
  "remainingTiles": 40,
  "myCurrentHuxi": 0,
  "opponentCurrentHuxi": 0,
  "actionButtons": "无",
  "isDealer": true
}

注意：
- num=0 表示鬼牌
- large=true 表示大字，large=false 表示小字
- myExposedGroups 里的牌用实际汉字表示`;

async function invokeLLM(messages: any[]): Promise<any> {
  if (!FORGE_API_KEY) throw new Error("API Key 未配置");
  const payload: any = {
    model: "gemini-2.5-flash",
    messages,
    max_tokens: 32768,
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

function extractJSON(text: string): any {
  if (!text) throw new Error("Empty response");
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  // Try direct parse
  try { return JSON.parse(cleaned); } catch {}
  // Find JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  // Find JSON array
  const astart = cleaned.indexOf("[");
  const aend = cleaned.lastIndexOf("]");
  if (astart !== -1 && aend !== -1 && aend > astart) {
    try { return JSON.parse(cleaned.slice(astart, aend + 1)); } catch {}
  }
  throw new Error("Cannot extract JSON from: " + text.slice(0, 200));
}

function convertTileObjects(tileObjs: Array<{num: number, large: boolean}>): string[] {
  return tileObjs.map(t => {
    if (t.num === 0) return "鬼";
    if (t.large) return NUM_TO_LARGE[t.num] || "鬼";
    return NUM_TO_SMALL[t.num] || "鬼";
  });
}

function autoFixTiles(tiles: string[]): string[] {
  // Count each tile
  const count: Record<string, number> = {};
  for (const t of tiles) count[t] = (count[t] || 0) + 1;
  
  // Fix tiles that appear more than 4 times by converting to counterpart
  const LARGE_TO_SMALL: Record<string, string> = {
    "壹":"一","贰":"二","叁":"三","肆":"四","伍":"五",
    "陆":"六","柒":"七","捌":"八","玖":"九","拾":"十"
  };
  const SMALL_TO_LARGE: Record<string, string> = {
    "一":"壹","二":"贰","三":"叁","四":"肆","五":"伍",
    "六":"陆","七":"柒","八":"捌","九":"玖","十":"拾"
  };
  
  let result = [...tiles];
  for (const [tile, cnt] of Object.entries(count)) {
    if (cnt > 4 && tile !== "鬼") {
      const counterpart = LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile];
      if (counterpart) {
        const counterCnt = count[counterpart] || 0;
        const excess = cnt - 4;
        const canConvert = Math.min(excess, 4 - counterCnt);
        if (canConvert > 0) {
          let converted = 0;
          result = result.map(t => {
            if (t === tile && converted < canConvert) {
              converted++;
              count[tile]--;
              count[counterpart] = (count[counterpart] || 0) + 1;
              return counterpart;
            }
            return t;
          });
        }
      }
    }
  }
  return result;
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

async function runAnalysis(imageBase64: string): Promise<any> {
  const t0 = Date.now();
  
  // === Step 1: LLM识别牌面（两步法：数字+大小字标记）===
  const recognitionResponse = await invokeLLM([
    { role: "system", content: STEP1_PROMPT },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `请识别这张桂林飞飞字牌游戏截图中的手牌。

手牌在截图最底部，分2-3排阶梯状排列。
- 每张牌输出：{"num": 数字, "large": 是否大字}
- num=0 表示鬼牌
- 请从上排左边开始，逐排逐张识别
- 注意右侧可能有单独突出的1-2张牌，也是手牌
- 注意左侧可能有竖排的1列手牌（不是明牌组！）

请直接输出JSON，不要加代码块。`,
        },
        {
          type: "image_url",
          image_url: { url: imageBase64, detail: "high" },
        },
      ],
    },
  ]);
  
  const recContent = recognitionResponse.choices[0]?.message?.content;
  let recognition: any;
  try {
    recognition = extractJSON(typeof recContent === "string" ? recContent : JSON.stringify(recContent));
  } catch (e) {
    console.error("[analyze] JSON parse failed:", String(e).slice(0, 200));
    return getEmptyAnalysis("牌面识别失败");
  }
  
  // Convert tile objects to string tiles
  let handTiles: string[];
  const rawTileObjs = recognition.handTiles || [];
  
  if (rawTileObjs.length > 0 && typeof rawTileObjs[0] === "object" && "num" in rawTileObjs[0]) {
    // New format: [{num, large}]
    handTiles = convertTileObjects(rawTileObjs);
  } else if (rawTileObjs.length > 0 && typeof rawTileObjs[0] === "string") {
    // Old format: string array (fallback)
    handTiles = rawTileObjs;
  } else {
    handTiles = [];
  }
  
  console.log(`[DEBUG] LLM识别手牌(${handTiles.length}张): ${handTiles.join(", ")}`);
  
  if (handTiles.length === 0) {
    return getEmptyAnalysis("未能识别到手牌");
  }
  
  // === 自动重试：手牌数量不足时 ===
  if (handTiles.length < 18) {
    console.log(`[WARN] 手牌只识别出${handTiles.length}张，自动重试...`);
    try {
      const retryResponse = await invokeLLM([
        { role: "system", content: STEP1_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `上次只找到${handTiles.length}张手牌，明显不对！手牌应该有20-21张。

请重新仔细看截图底部区域：
- 手牌分上下2-3排，阶梯状排列
- 上排通常10-11张，下排通常10-11张
- 右侧可能有1-2张单独突出的牌（也是手牌！）
- 左侧可能有1列竖排手牌（不是明牌组！）

请从上排左边第一张开始，逐排逐张识别，总数必须20-21张！
直接输出JSON，不要加代码块。`,
            },
            {
              type: "image_url",
              image_url: { url: imageBase64, detail: "high" },
            },
          ],
        },
      ]);
      const retryContent = retryResponse.choices[0]?.message?.content;
      const retryRec = extractJSON(typeof retryContent === "string" ? retryContent : JSON.stringify(retryContent));
      const retryTileObjs = retryRec.handTiles || [];
      let retryTiles: string[];
      if (retryTileObjs.length > 0 && typeof retryTileObjs[0] === "object" && "num" in retryTileObjs[0]) {
        retryTiles = convertTileObjects(retryTileObjs);
      } else {
        retryTiles = retryTileObjs;
      }
      if (retryTiles.length > handTiles.length) {
        handTiles = retryTiles;
        recognition = retryRec;
        console.log(`[INFO] 重试成功，手牌增加到${handTiles.length}张`);
      }
    } catch (e) {
      console.log(`[WARN] 重试失败:`, e);
    }
  }
  
  // === 自动修正大小字混淆（超过4张的牌）===
  handTiles = autoFixTiles(handTiles);
  recognition.handTiles = handTiles;
  
  // === Step 2: 引擎计算所有拆组方案 ===
  const exposedHuxi = recognition.myCurrentHuxi || 0;
  const knownTiles: string[] = [
    ...(recognition.discardedTiles || []),
    ...(recognition.myExposedGroups || []).flatMap((g: any) => g.tiles || []),
    ...(recognition.opponentExposedGroups || []).flatMap((g: any) => g.tiles || []),
  ];
  const engineResult = analyzeHand(handTiles, { exposedHuxi, minHuxi: 10, knownTiles });
  
  // === Step 3: 引擎直接生成建议 ===
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
  
  return {
    handTiles: recognition.handTiles || [],
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
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
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
