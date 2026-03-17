/**
 * Vercel Serverless Function: /api/analyze
 * 
 * 接收图片 base64，调用 LLM 识别牌面，再用引擎计算最优方案，返回分析结果。
 * 不需要登录，完全公开。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeHand } from "./zipai-engine";
import { generateAdviceFromEngine } from "./advice-generator";

// ===== LLM 调用 =====
// 优先使用环境变量，其次使用内置代理
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL
  ? `${process.env.BUILT_IN_FORGE_API_URL.replace(/\/$/, "")}/v1/chat/completions`
  : process.env.OPENAI_BASE_URL
  ? `${process.env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`
  : "https://api.manus.im/api/llm-proxy/v1/chat/completions";

const FORGE_API_KEY =
  process.env.BUILT_IN_FORGE_API_KEY ||
  process.env.OPENAI_API_KEY ||
  "sk-5WXsFtEZiTrf54UFE4nnAu";

// ===== 识别 Prompt（优化版：自动识别张数，不固定20/21）=====
const TILE_RECOGNITION_PROMPT = `你是桂林飞飞字牌游戏的牌面识别专家。你的唯一任务是精确识别截图中每张牌的文字。

## 核心规则：大字 vs 小字
这个游戏每个数字有两种写法。区分它们是你最重要的任务！

**判断方法：看笔画数量和字形复杂度**
- 小字 = 笔画极少（1-4笔），字形非常简单
- 大字 = 笔画很多（6笔以上），字形复杂，通常有偏旁部首

| 数字 | 小字 | 小字笔画特征 | 大字 | 大字笔画特征 | 颜色 |
|------|------|-------------|------|-------------|------|
| 1 | 一 | 1笔横线 | 壹 | 12笔，有"士冖豆" | 黑色 |
| 2 | 二 | 2笔两横 | 贰 | 9笔，有"弋"和"贝" | 红色 |
| 3 | 三 | 3笔三横 | 叁 | 8笔，有"厶"和"大" | 黑色 |
| 4 | 四 | 5笔，口中两竖 | 肆 | 13笔，有"聿"和长横 | 黑色 |
| 5 | 五 | 4笔，横竖横竖 | 伍 | 6笔，左边有"亻"人旁 | 黑色 |
| 6 | 六 | 4笔，点横撇点 | 陆 | 7笔，左边有"阝"耳旁 | 黑色 |
| 7 | 七 | 2笔，一横一竖弯 | 柒 | 10笔，上"木"下复杂 | 红色 |
| 8 | 八 | 2笔，一撇一捺 | 捌 | 10笔，左"扌"右"别" | 黑色 |
| 9 | 九 | 2笔，撇和弯钩 | 玖 | 7笔，左"王"右"久" | 黑色 |
| 10 | 十 | 2笔，一横一竖 | 拾 | 9笔，左"扌"右"合" | 红色 |
鬼牌/飞飞：特殊图案，紫色或彩色，不是汉字

## ❗最容易犯的错误❗
1. **七 vs 柒**：「七」极其简单只有2笔（一横一竖弯），「柒」非常复杂有10笔。如果看到红色的简单2笔字→一定是小字「七」！
2. **十 vs 拾**：「十」极其简单只有2笔（十字形），「拾」左边有提手旁很复杂。如果看到红色的简单十字形→一定是小字「十」！
3. **五 vs 伍**：「五」只有4笔很简单，「伍」左边有单人旁。如果字形简单无偏旁→是小字「五」！
4. **八 vs 捌**：「八」只有2笔（撇捺），「捌」左边有提手旁。
5. **六 vs 陆**：「六」只有4笔，「陆」左边有耳刀旁。

## 区域识别（极其重要！）
截图布局说明：
- **我的手牌（最重要！）**：位于截图底部，是两排白色小牌。上排通常有10-11张，下排通常有10-11张，合计20-21张。你必须识别每一张！
- 底部左侧已翻开的牌组：我的明牌（碰/坎/吃），这些不是手牌
- 顶部区域：对手明牌组
- 中间圆圈周围：弃牌区
- 右上角数字：剩余底牌
- 左侧数字+"胡"：我方胡息

## ❗❗❗ 手牌识别是第一优先级 ❗❗❗
手牌在截图底部，分上下两排。你必须：
1. 先识别上排所有牌（从左到右）
2. 再识别下排所有牌（从左到右）
3. 上排+下排总数通常是20或21张（闲家20张，庄家21张），如果你只识别出10多张，说明你漏了一排！
4. 每排通常有10-11张牌，如果某排只识别出5-6张，说明你漏了一半
5. **不要固定张数**：根据截图实际识别，庄家有21张，闲家有20张，以实际为准

## 识别步骤
1. 先数手牌总数（上排+下排），判断是庄家（21张）还是闲家（20张）
2. 从左到右、从上到下逐张识别
3. 每张牌的识别流程：
   a. 先看颜色：黑色/红色/紫色
   b. 再看字形复杂度：笔画少且无偏旁=小字，笔画多或有偏旁=大字
   c. 红色牌只有6种：小字二/七/十 和 大字贰/柒/拾
   d. 如果红色且字形极简单（2笔以内）→一定是小字
4. ❗每种牌最多4张！如果某种牌超过4张，说明你混淆了大小字
5. 红色牌只有：二/贰、七/柒、十/拾。如果红色且笔画简单→一定是小字

## ❗❗ 最终验证（必须执行）❗❗
识别完所有牌后，必须做以下检查：
1. 数一数每种牌出现了几张，任何一种牌超过4张就说明识别有误
2. 特别检查以下最容易混淆的对：五/伍、七/柒、十/拾、四/肆、六/陆
3. 如果发现某种牌5张以上，把多出来的改成对应的大字或小字
4. 确认手牌总数正确（20或21张）
## 输出格式（必须严格遵守）
必须返回纯 JSON 对象，不要加任何markdown代码块标记！
返回格式：
{
  "handTiles": ["一", "二", ...],
  "myExposedGroups": [{"tiles": [...], "type": "碰"}],
  "opponentExposedGroups": [],
  "discardedTiles": [],
  "remainingTiles": 40,
  "myCurrentHuxi": 0,
  "opponentCurrentHuxi": 0,
  "actionButtons": "无",
  "isDealer": false
}`;

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

// 从LLM响应中提取JSON（处理markdown代码块）
function extractJSON(content: string): any {
  if (!content) throw new Error("Empty content");
  // 如果已经是对象直接返回
  if (typeof content !== "string") return content;
  // 去掉markdown代码块
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  cleaned = cleaned.trim();
  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试提取第一个 { ... } 块
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Cannot parse JSON from: " + cleaned.slice(0, 100));
  }
}
async function invokeLLM(messages: any[], responseFormat?: any): Promise<any> {
  if (!FORGE_API_KEY) {
    throw new Error("API Key 未配置");
  }
  const payload: any = {
    model: "gemini-2.5-flash",
    messages,
    max_tokens: 32768,
  };
  // 注意：不使用json_schema强制格式，因为gemini-2.5-flash通过代理时不支持strict模式
  // 改为在prompt中要求返回JSON格式
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

  // === Step 1: LLM识别牌面（自动识别张数，不固定）===
  const recognitionResponse = await invokeLLM(
    [
      { role: "system", content: TILE_RECOGNITION_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `请精确识别这张桂林飞飞字牌游戏截图。\n\n❗❗❗ 最重要：手牌在截图底部，分上下两排。你必须识别每一张！\n\n识别步骤：\n1. 先看底部上排，从左到右逐张识别（通常10-11张）\n2. 再看底部下排，从左到右逐张识别（通常10-11张）\n3. 上排+下排总数通常20-21张，多了或少了都说明识别有误！\n4. 每张牌先看颜色（黑/红），再看字形复杂度（有无偏旁部首）\n5. 红色且笔画简单（2笔）的字只可能是小字七或小字十\n6. 每种牌最多4张，超过说明混淆了大小字`,
          },
          {
            type: "image_url",
            image_url: { url: imageBase64, detail: "high" },
          },
        ],
      },
    ],
  );
  const recContent = recognitionResponse.choices[0]?.message?.content;
  let recognition: any;
  try {
    recognition = extractJSON(typeof recContent === "string" ? recContent : JSON.stringify(recContent));
  } catch (e) {
    console.error("[analyze] JSON parse failed:", String(e).slice(0, 200), "\nContent:", String(recContent).slice(0, 200));
    return getEmptyAnalysis("牌面识别失败");
  }

  let handTiles: string[] = recognition.handTiles || [];
  console.log(`[DEBUG] LLM识别手牌(${handTiles.length}张): ${handTiles.join(", ")}`);

  if (handTiles.length === 0) {
    return getEmptyAnalysis("未能识别到手牌");
  }

  // === 手牌数量不足时自动重试一次 ===
  if (handTiles.length < 15) {
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
                text: `上次识别只找到${handTiles.length}张手牌，这明显不对！手牌应该有20-21张。\n\n请重新仔细识别。手牌在截图最底部，分上下两排：\n- 上排：紧贴下排上方，通常10-11张小白牌\n- 下排：截图最底部，通常10-11张小白牌\n\n请从上排左边第一张开始，逐张识别到下排最右边一张。总数必须20-21张！`,
              },
              {
                type: "image_url",
                image_url: { url: imageBase64, detail: "high" },
              },
            ],
          },
        ],
      );
      const retryContent = retryResponse.choices[0]?.message?.content;
      const retryRecognition = extractJSON(typeof retryContent === "string" ? retryContent : JSON.stringify(retryContent));
      const retryTiles = retryRecognition.handTiles || [];
      if (retryTiles.length > handTiles.length) {
        handTiles = retryTiles;
        if (retryRecognition.myExposedGroups !== undefined) recognition.myExposedGroups = retryRecognition.myExposedGroups;
        if (retryRecognition.opponentExposedGroups !== undefined) recognition.opponentExposedGroups = retryRecognition.opponentExposedGroups;
        if (retryRecognition.discardedTiles !== undefined) recognition.discardedTiles = retryRecognition.discardedTiles;
        if (retryRecognition.remainingTiles !== undefined) recognition.remainingTiles = retryRecognition.remainingTiles;
        if (retryRecognition.myCurrentHuxi !== undefined) recognition.myCurrentHuxi = retryRecognition.myCurrentHuxi;
        if (retryRecognition.opponentCurrentHuxi !== undefined) recognition.opponentCurrentHuxi = retryRecognition.opponentCurrentHuxi;
        if (retryRecognition.isDealer !== undefined) recognition.isDealer = retryRecognition.isDealer;
        console.log(`[INFO] 重试成功，手牌从${handTiles.length}张增加到${retryTiles.length}张`);
      }
    } catch (e) {
      console.log(`[WARN] 重试识别失败:`, e);
    }
  }

  // === 牌数校验：每种牌最多4张，超过则尝试自动修正大小字混淆 ===
  const LARGE_TO_SMALL: Record<string, string> = {
    '壹': '一', '贰': '二', '叁': '三', '肆': '四', '伍': '五',
    '陆': '六', '柒': '七', '捌': '八', '玖': '九', '拾': '十'
  };
  const SMALL_TO_LARGE: Record<string, string> = {
    '一': '壹', '二': '贰', '三': '叁', '四': '肆', '五': '伍',
    '六': '陆', '七': '柒', '八': '捌', '九': '玖', '十': '拾'
  };
  const tileCount: Record<string, number> = {};
  for (const t of handTiles) {
    tileCount[t] = (tileCount[t] || 0) + 1;
  }
  let needsFix = false;
  for (const [tile, count] of Object.entries(tileCount)) {
    if (count > 4 && tile !== '鬼') {
      needsFix = true;
      const counterpart = LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile];
      if (counterpart) {
        const counterpartCount = tileCount[counterpart] || 0;
        const excess = count - 4;
        const canConvert = Math.min(excess, 4 - counterpartCount);
        if (canConvert > 0) {
          let converted = 0;
          handTiles = handTiles.map(t => {
            if (t === tile && converted < canConvert && (tileCount[tile] ?? 0) > 4) {
              converted++;
              tileCount[tile] = (tileCount[tile] ?? 0) - 1;
              tileCount[counterpart] = (tileCount[counterpart] || 0) + 1;
              return counterpart;
            }
            return t;
          });
        }
      }
    }
  }
  if (needsFix) {
    recognition.handTiles = handTiles;
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
