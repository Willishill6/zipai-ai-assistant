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
const STEP1_PROMPT_V4 = `你是世界顶级的桂林飞飞字牌游戏图像识别引擎。你的任务是精确无误地识别截图中的每一张手牌。

## 核心任务：识别手牌

### 1. **手牌区域定位 (至关重要)**
- **只识别手牌**: 手牌位于截图 **最底部**，由白色方块牌组成。
- **阶梯式布局**: 手牌通常分2-3排，呈阶梯状重叠排列。请仔细检查每一排，不要漏掉被部分遮挡的牌。
- **右侧突出牌**: 经常有1-2张牌在最右侧突出，很容易被忽略，请务必检查。
- **排除干扰项**: 绝对不要将在屏幕其他位置的牌识别为手牌，例如：
    - **明牌**: 屏幕左侧或中间竖向排列的牌组。
    - **弃牌**: 屏幕中间散落的牌。
    - **对手牌**: 屏幕顶部的牌。

### 2. **识别规则 (必须严格遵守)**
- **输出格式**: 必须返回一个纯粹的JSON对象，不包含任何Markdown标记 (如 ```json...```)。
- **内容要求**: JSON对象必须包含 `handTiles` (一个对象数组) 和 `isDealer` (布尔值)。
- **牌对象结构**: `handTiles` 数组中的每个对象必须包含 `num` (数字 1-10, 鬼牌为0) 和 `large` (布尔值, true为大字)。

### 3. **验证与校准 (识别后自我检查)**
- **总数验证**: 庄家手牌为 **21** 张，闲家为 **20** 张。识别出的总数必须是这两个数字之一。如果不是，请重新检查图像，找出遗漏或多余的牌。
- **单牌数量验证**: 每一种特定的牌 (例如，小字'五') 最多只能有 **4** 张。如果识别出5张或更多，说明有误，请仔细核对最可疑的牌。
- **鬼牌数量验证**: 鬼牌 (num: 0) 最多只能有 **2** 张。如果超过2张，必然是识别错误，最常见的是将'叁'或'三'误认为鬼牌。

### 4. **汉字区分指南 (高频易错点)**
- **叁 vs 鬼**: '叁' (num: 3, large: true) 顶部是三个独立的笔画，而'鬼'牌是一个特殊的、非汉字的图案。这是最常见的错误，请加倍小心。
- **五 vs 伍**: '五' (num: 5, large: false) 是简单的四笔画。'伍' (num: 5, large: true) 左侧有明显的'亻'偏旁。
- **其他大字**: 大字 '壹', '贰', '肆', '陆', '柒', '捌', '玖', '拾' 都有独特的、比小字复杂得多的结构，通常带有偏旁部首。

### 5. **输出格式示例**

{
  "handTiles": [
    {"num": 4, "large": true},
    {"num": 5, "large": false},
    {"num": 2, "large": true},
    {"num": 0, "large": false}
  ],
  "isDealer": true
}
`;

const STEP1_PROMPT = STEP1_PROMPT_V4;

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
