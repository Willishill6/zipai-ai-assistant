import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  createAnalysisRecord,
  getAnalysisRecords,
  deleteAnalysisRecord,
  getGameStats,
  upsertGameStats,
  createPracticeSession,
  updatePracticeSession,
  getPracticeSession,
} from "./db";
import { z } from "zod";
import { nanoid } from "nanoid";
import { analyzeHand, type EngineResult, type ScoredPlan } from "./zipai-engine";
import { generateAdviceFromEngine } from "./advice-generator";

// =====================================================================
// V7.0 三步分析流程：LLM识别牌面 → 引擎计算最优解 → LLM生成建议
// =====================================================================

// ===== Step 1: 牌面识别 Prompt（LLM只做识别，不做计算） =====
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
3. 上排+下排总数必须是20或21张，如果你只识别出10多张，说明你漏了一排！
4. 每排通常有10-11张牌，如果某排只识别出5-6张，说明你漏了一半

## 识别步骤
1. 先数手牌总数（上排+下排），庄家21张，闲家20张
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
4. 确认手牌总数正确（20或21张）`;

// ===== Step 1: 识别结果 JSON Schema =====
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

// V9.3: ADVICE removed, using generateAdviceFromEngine() instead
// formatEngineResult removed, no longer needed

// ===== 三步分析核心函数 =====
async function runThreeStepAnalysis(imageBase64: string, expectedTileCount: number = 20): Promise<any> {
  const t0 = Date.now();
  
  // === Step 1: LLM识别牌面 ===
  const t1 = Date.now();
  const recognitionResponse = await invokeLLM({
    messages: [
      { role: "system", content: TILE_RECOGNITION_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: `请精确识别这张桂林飞飞字牌游戏截图。\n\n❗❗❗ 最重要：这是${expectedTileCount === 21 ? '庄家' : '闲家'}，手牌应该恰好${expectedTileCount}张！手牌在截图底部，分上下两排。你必须识别每一张！\n\n识别步骤：\n1. 先看底部上排，从左到右逐张识别（通常${Math.ceil(expectedTileCount/2)}张）\n2. 再看底部下排，从左到右逐张识别（通常${Math.floor(expectedTileCount/2)}张）\n3. 上排+下排总数必须恰好${expectedTileCount}张！多了或少了都说明识别有误！\n4. 每张牌先看颜色（黑/红），再看字形复杂度（有无偏旁部首）\n5. 红色且笔画简单（2笔）的字只可能是小字七或小字十\n6. 每种牌最多4张，超过说明混淆了大小字` },
          {
            type: "image_url",
            image_url: { url: imageBase64, detail: "high" },
          },
        ],
      },
    ],
    response_format: RECOGNITION_JSON_SCHEMA,
  });

  const t1b = Date.now();
  console.log(`[PERF] Step 1 LLM识别: ${t1b - t1}ms`);
  
  const recContent = recognitionResponse.choices[0]?.message?.content;
  let recognition: any;
  try {
    recognition = JSON.parse(typeof recContent === "string" ? recContent : JSON.stringify(recContent));
  } catch {
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
      const retryResponse = await invokeLLM({
        messages: [
          { role: "system", content: TILE_RECOGNITION_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `上次识别只找到${handTiles.length}张手牌，这明显不对！这是${expectedTileCount === 21 ? '庄家' : '闲家'}，手牌应该恰好${expectedTileCount}张。\n\n请重新仔细识别。手牌在截图最底部，分上下两排：\n- 上排：紧贴下排上方，通常${Math.ceil(expectedTileCount/2)}张小白牌\n- 下排：截图最底部，通常${Math.floor(expectedTileCount/2)}张小白牌\n\n请从上排左边第一张开始，逐张识别到下排最右边一张。总数必须恰好${expectedTileCount}张！` },
              {
                type: "image_url",
                image_url: { url: imageBase64, detail: "high" },
              },
            ],
          },
        ],
        response_format: RECOGNITION_JSON_SCHEMA,
      });
      const retryContent = retryResponse.choices[0]?.message?.content;
      const retryRecognition = JSON.parse(typeof retryContent === "string" ? retryContent : JSON.stringify(retryContent));
      const retryTiles = retryRecognition.handTiles || [];
      console.log(`[DEBUG] 重试识别手牌(${retryTiles.length}张): ${retryTiles.join(", ")}`);
      if (retryTiles.length > handTiles.length) {
        handTiles = retryTiles;
        recognition.handTiles = retryTiles;
        // 也更新其他字段
        if (retryRecognition.myExposedGroups) recognition.myExposedGroups = retryRecognition.myExposedGroups;
        if (retryRecognition.opponentExposedGroups) recognition.opponentExposedGroups = retryRecognition.opponentExposedGroups;
        if (retryRecognition.discardedTiles) recognition.discardedTiles = retryRecognition.discardedTiles;
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
  // 检查是否有超过4张的牌
  let needsFix = false;
  for (const [tile, count] of Object.entries(tileCount)) {
    if (count > 4 && tile !== '鬼') {
      needsFix = true;
      console.log(`[WARN] 牌"${tile}"识别出${count}张（最多4张），尝试自动修正`);
      // 尝试把多余的转换为对应的大/小字
      const counterpart = LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile];
      if (counterpart) {
        const counterpartCount = tileCount[counterpart] || 0;
        const excess = count - 4;
        const canConvert = Math.min(excess, 4 - counterpartCount);
        if (canConvert > 0) {
          let converted = 0;
          handTiles = handTiles.map(t => {
            if (t === tile && converted < canConvert && tileCount[tile]! > 4) {
              converted++;
              tileCount[tile] = tileCount[tile]! - 1;
              tileCount[counterpart] = (tileCount[counterpart] || 0) + 1;
              return counterpart;
            }
            return t;
          });
          console.log(`[FIX] 将${canConvert}张"${tile}"修正为"${counterpart}"`);
        }
      }
    }
  }
  if (needsFix) {
    console.log(`[DEBUG] 修正后手牌(${handTiles.length}张): ${handTiles.join(", ")}`);
    recognition.handTiles = handTiles;
  }

  // === Step 2: 引擎计算所有拆组方案 ===
  const t2 = Date.now();
  // 计算明牌胡息
  const exposedHuxi = recognition.myCurrentHuxi || 0;
  // 收集已知牌（弃牌+明牌）
  const knownTiles: string[] = [
    ...(recognition.discardedTiles || []),
    ...(recognition.myExposedGroups || []).flatMap((g: any) => g.tiles || []),
    ...(recognition.opponentExposedGroups || []).flatMap((g: any) => g.tiles || []),
  ];
  const engineResult = analyzeHand(handTiles, { exposedHuxi, minHuxi: 10, knownTiles });
  const t2b = Date.now();
  console.log(`[PERF] Step 2 引擎计算: ${t2b - t2}ms`);

  // === Step 3: 引擎直接生成建议（去掉LLM调用，节省6秒） ===
  const advice = generateAdviceFromEngine(engineResult, recognition, exposedHuxi);
  const t3b = Date.now();
  console.log(`[PERF] Step 3 引擎生成建议: ${t3b - t2b}ms`);
  console.log(`[PERF] 总耗时: ${t3b - t0}ms`);

  // === 合并结果 ===
  const result: any = {
    // 识别结果
    handTiles: recognition.handTiles || [],
    myExposedGroups: (recognition.myExposedGroups || []).map((g: any) => ({
      ...g,
      huxi: g.huxi || 0,
    })),
    opponentExposedGroups: (recognition.opponentExposedGroups || []).map((g: any) => ({
      ...g,
      huxi: g.huxi || 0,
    })),
    discardedTiles: recognition.discardedTiles || [],
    remainingTiles: recognition.remainingTiles || 0,
    actionButtons: recognition.actionButtons || "无",

    // 引擎计算结果
    combinationPlans: engineResult.plans.map((plan, idx) => ({
      planName: `方案${idx + 1}`,
      groups: plan.groups.map(g => ({
        tiles: g.tiles,
        type: g.type === "kan" ? "坎" : g.type === "shunzi" ? "顺子" : g.type === "ghost_kan" ? "坎(鬼)" : g.type === "ghost_shunzi" ? "顺(鬼)" : g.type === "mixed_kan" ? "组合牌" : g.type === "ghost_mixed" ? "组合牌(鬼)" : g.type,
        huxi: g.huxi,
      })),
      totalHuxi: plan.totalHuxi,
      remainingLoose: plan.remainingCount,
      tilesNeeded: plan.remainingCount,
      stepsToTing: plan.stepsToTing,
      looseRelation: plan.looseRelation,
      tingWidth: "",
      isOptimal: idx === 0,
      reason: idx === 0 ? "引擎评分最高" : `评分${plan.score}`,
    })),
    handGroups: engineResult.plans[0]?.groups.map(g => ({
      tiles: g.tiles,
      type: g.type === "kan" ? "坎" : g.type === "shunzi" ? "顺子" : g.type === "ghost_kan" ? "坎(鬼)" : g.type === "ghost_shunzi" ? "顺(鬼)" : g.type === "mixed_kan" ? "组合牌" : g.type === "ghost_mixed" ? "组合牌(鬼)" : g.type,
      huxi: g.huxi,
    })) || [],

    // 鬼牌分析
    ghostCardAnalysis: {
      hasGhost: engineResult.ghostAnalysis.hasGhost,
      currentUsage: engineResult.ghostAnalysis.hasGhost
        ? `最优替代: 鬼→${engineResult.ghostAnalysis.bestReplacement}`
        : "无鬼牌",
      allOptions: engineResult.ghostAnalysis.allReplacements.map(r => ({
        replaceTile: r.tile,
        formedGroup: "",
        groupType: "",
        huxiGain: r.bestPlanHuxi,
        isOptimal: r.tile === engineResult.ghostAnalysis.bestReplacement,
      })),
      bestOption: engineResult.ghostAnalysis.hasGhost
        ? `鬼→${engineResult.ghostAnalysis.bestReplacement}`
        : "无",
    },

    // 牌效率（从引擎最优方案的散牌分析）
    tileEfficiency: engineResult.plans[0]?.looseAnalysis.map(la => ({
      tile: la.tile,
      jinzhangCount: la.jinzhangCount,
      isWaste: la.isWaste,
      wasteReason: la.isWaste ? "无组合可能" : (la.partialShunzi.length > 0 ? `搭子:差${la.partialShunzi[0].need}` : ""),
    })) || [],

    // 坎牌锁定信息
    lockedKan: engineResult.lockedKan.map(kan => ({
      tiles: kan.tiles,
      huxi: kan.huxi,
      description: kan.description,
    })),
    kanHuxi: engineResult.kanHuxi,
    
    // 坎锁死分析
    kanLockAnalysis: engineResult.lockedKan.length > 0
      ? engineResult.lockedKan.map(g => `🔒${g.tiles.join("")}坎(${g.huxi}胡)不可拆`).join("；")
      : (engineResult.plans[0]?.groups
          .filter(g => g.type === "kan")
          .map(g => `${g.tiles[0]}${g.tiles[0]}${g.tiles[0]}坎锁死相邻顺子`)
          .join("；") || ""),

    // 听牌分析
    tingAnalysis: (engineResult.tingAnalysis || []).slice(0, 10).map(ting => ({
      discard: ting.discard,
      tingTiles: ting.tingTiles.map(t => ({
        tile: t.tile,
        maxHuxi: t.maxHuxi,
        planDesc: t.bestGroups ? t.bestGroups.map((g: any) => g.description).join(" + ") : "",
      })),
      tingWidth: ting.tingWidth,
      tingCount: ting.tingCount,
      maxHuxi: ting.maxHuxi,
    })),

    // LLM建议
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
    defenseAnalysis: advice.defenseAnalysis || {
      riskLevel: "未知",
      isDefenseMode: false,
      defenseReason: "",
      tilesSafety: [],
      dianpaoWarning: "",
    },
    aiSuggestion: advice.aiSuggestion || "",
    analysisReasoning: advice.analysisReasoning || "",
  };

  return result;
}

// ===== Default empty analysis =====
function getEmptyAnalysis(content?: string): any {
  return {
    handTiles: [],
    myExposedGroups: [],
    opponentExposedGroups: [],
    discardedTiles: [],
    combinationPlans: [],
    handGroups: [],
    ghostCardAnalysis: {
      hasGhost: false,
      currentUsage: "无鬼牌",
      allOptions: [],
      bestOption: "无",
    },
    huxiBreakdown: "",
    currentHuxi: 0,
    potentialHuxi: 0,
    opponentEstimatedHuxi: 0,
    remainingTiles: 0,
    defenseAnalysis: {
      riskLevel: "未知",
      isDefenseMode: false,
      defenseReason: "",
      tilesSafety: [],
      dianpaoWarning: "",
    },
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

// ===== Analysis Router =====
const userLastAnalysis = new Map<number, number>();
const MIN_ANALYSIS_INTERVAL = 2000;

const analysisRouter = router({
  quickAnalyze: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        expectedTileCount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = Date.now();
      const lastTime = userLastAnalysis.get(ctx.user.id) || 0;
      if (now - lastTime < MIN_ANALYSIS_INTERVAL) {
        throw new Error("分析过于频繁，请稍后再试");
      }
      userLastAnalysis.set(ctx.user.id, now);

      return runThreeStepAnalysis(input.imageBase64, input.expectedTileCount || 20);
    }),

  analyze: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        expectedTileCount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      const fileKey = `screenshots/${ctx.user.id}/${nanoid()}.png`;
      const { url: screenshotUrl } = await storagePut(fileKey, imageBuffer, "image/png");

      const parsed = await runThreeStepAnalysis(input.imageBase64, input.expectedTileCount || 20);

      await createAnalysisRecord({
        userId: ctx.user.id,
        screenshotUrl,
        handTiles: parsed.handTiles,
        exposedTiles: parsed.myExposedGroups,
        ghostCards: parsed.ghostCardAnalysis ? [JSON.stringify(parsed.ghostCardAnalysis)] : [],
        currentHuxi: parsed.currentHuxi || 0,
        remainingTiles: parsed.remainingTiles || 0,
        aiSuggestion: parsed.aiSuggestion,
        recommendedAction: parsed.recommendedAction,
        recommendedTile: parsed.recommendedTile,
        analysisReasoning: parsed.analysisReasoning,
        rawLlmResponse: JSON.stringify(parsed),
      });

      const stats = await getGameStats(ctx.user.id);
      const totalGames = (stats?.totalGames || 0) + 1;
      const totalHuxi = (stats?.totalHuxi || 0) + (parsed.currentHuxi || 0);
      await upsertGameStats(ctx.user.id, {
        totalGames,
        totalHuxi,
        avgHuxi: totalHuxi / totalGames,
      });

      return parsed;
    }),

  // 手动修正手牌后重新计算（跳过LLM识别，直接调用引擎）
  reanalyze: protectedProcedure
    .input(
      z.object({
        handTiles: z.array(z.string()),
        myExposedGroups: z.array(z.object({
          tiles: z.array(z.string()),
          type: z.string(),
        })).optional(),
        opponentExposedGroups: z.array(z.object({
          tiles: z.array(z.string()),
          type: z.string(),
        })).optional(),
        discardedTiles: z.array(z.string()).optional(),
        remainingTiles: z.number().optional(),
        myCurrentHuxi: z.number().optional(),
        opponentCurrentHuxi: z.number().optional(),
        isDealer: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const t0 = Date.now();
      const handTiles = input.handTiles;
      console.log(`[REANALYZE] 手动修正手牌(${handTiles.length}张): ${handTiles.join(", ")}`);

      const exposedHuxi = input.myCurrentHuxi || 0;
      const knownTiles: string[] = [
        ...(input.discardedTiles || []),
        ...(input.myExposedGroups || []).flatMap((g) => g.tiles || []),
        ...(input.opponentExposedGroups || []).flatMap((g) => g.tiles || []),
      ];
      const engineResult = analyzeHand(handTiles, { exposedHuxi, minHuxi: 10, knownTiles });

      const recognition = {
        handTiles,
        myExposedGroups: input.myExposedGroups || [],
        opponentExposedGroups: input.opponentExposedGroups || [],
        discardedTiles: input.discardedTiles || [],
        remainingTiles: input.remainingTiles || 0,
        myCurrentHuxi: input.myCurrentHuxi || 0,
        opponentCurrentHuxi: input.opponentCurrentHuxi || 0,
        actionButtons: "无",
        isDealer: input.isDealer ?? (handTiles.length === 21),
      };
      const advice = generateAdviceFromEngine(engineResult, recognition, exposedHuxi);
      const t1 = Date.now();
      console.log(`[REANALYZE] 引擎计算耗时: ${t1 - t0}ms`);

      // 构造与 runThreeStepAnalysis 相同的结果格式
      const result: any = {
        handTiles: recognition.handTiles,
        myExposedGroups: (recognition.myExposedGroups || []).map((g: any) => ({ ...g, huxi: g.huxi || 0 })),
        opponentExposedGroups: (recognition.opponentExposedGroups || []).map((g: any) => ({ ...g, huxi: g.huxi || 0 })),
        discardedTiles: recognition.discardedTiles || [],
        remainingTiles: recognition.remainingTiles || 0,
        actionButtons: recognition.actionButtons || "无",
        combinationPlans: engineResult.plans.map((plan, idx) => ({
          planName: `方案${idx + 1}`,
          groups: plan.groups.map(g => ({
            tiles: g.tiles,
            type: g.type === "kan" ? "坎" : g.type === "shunzi" ? "顺子" : g.type === "ghost_kan" ? "坎(鬼)" : g.type === "ghost_shunzi" ? "顺(鬼)" : g.type === "mixed_kan" ? "组合牌" : g.type === "ghost_mixed" ? "组合牌(鬼)" : g.type,
            huxi: g.huxi,
          })),
          totalHuxi: plan.totalHuxi,
          remainingLoose: plan.remainingCount,
          tilesNeeded: plan.remainingCount,
          stepsToTing: plan.stepsToTing,
          looseRelation: plan.looseRelation,
          tingWidth: "",
          isOptimal: idx === 0,
          reason: idx === 0 ? "引擎评分最高" : `评分${plan.score}`,
        })),
        handGroups: engineResult.plans[0]?.groups.map(g => ({
          tiles: g.tiles,
          type: g.type === "kan" ? "坎" : g.type === "shunzi" ? "顺子" : g.type === "ghost_kan" ? "坎(鬼)" : g.type === "ghost_shunzi" ? "顺(鬼)" : g.type === "mixed_kan" ? "组合牌" : g.type === "ghost_mixed" ? "组合牌(鬼)" : g.type,
          huxi: g.huxi,
        })) || [],
        ghostCardAnalysis: {
          hasGhost: engineResult.ghostAnalysis.hasGhost,
          currentUsage: engineResult.ghostAnalysis.hasGhost
            ? `最优替代: 鬼→${engineResult.ghostAnalysis.bestReplacement}`
            : "无鬼牌",
          allOptions: engineResult.ghostAnalysis.allReplacements.map(r => ({
            replaceTile: r.tile,
            formedGroup: "",
            groupType: "",
            huxiGain: r.bestPlanHuxi,
            isOptimal: r.tile === engineResult.ghostAnalysis.bestReplacement,
          })),
          bestOption: engineResult.ghostAnalysis.hasGhost
            ? `鬼→${engineResult.ghostAnalysis.bestReplacement}`
            : "无",
        },
        tileEfficiency: engineResult.plans[0]?.looseAnalysis.map(la => ({
          tile: la.tile,
          jinzhangCount: la.jinzhangCount,
          isWaste: la.isWaste,
          wasteReason: la.isWaste ? "无组合可能" : (la.partialShunzi.length > 0 ? `搭子:差${la.partialShunzi[0].need}` : ""),
        })) || [],
        lockedKan: engineResult.lockedKan.map(kan => ({
          tiles: kan.tiles,
          huxi: kan.huxi,
          description: kan.description,
        })),
        kanHuxi: engineResult.kanHuxi,
        kanLockAnalysis: engineResult.lockedKan.length > 0
          ? engineResult.lockedKan.map(g => `🔒${g.tiles.join("")}坎(${g.huxi}胡)不可拆`).join("；")
          : "",
        tingAnalysis: (engineResult.tingAnalysis || []).slice(0, 10).map(ting => ({
          discard: ting.discard,
          tingTiles: ting.tingTiles.map(t => ({
            tile: t.tile,
            maxHuxi: t.maxHuxi,
            planDesc: t.bestGroups ? t.bestGroups.map((g: any) => g.description).join(" + ") : "",
          })),
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
        defenseAnalysis: advice.defenseAnalysis || {
          riskLevel: "未知",
          isDefenseMode: false,
          defenseReason: "",
          tilesSafety: [],
          dianpaoWarning: "",
        },
        aiSuggestion: advice.aiSuggestion || "",
        analysisReasoning: advice.analysisReasoning || "",
      };

      return result;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return getAnalysisRecords(ctx.user.id);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAnalysisRecord(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ===== Stats Router =====
const statsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return getGameStats(ctx.user.id);
  }),
});

// ===== Practice Router =====
const SMALL_TILES = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const BIG_TILES = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"];

function createDeck(): string[] {
  const deck: string[] = [];
  for (const tile of [...SMALL_TILES, ...BIG_TILES]) {
    for (let i = 0; i < 4; i++) {
      deck.push(tile);
    }
  }
  deck.push("鬼");
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function sortTiles(tiles: string[]): string[] {
  const order = [...SMALL_TILES, ...BIG_TILES, "鬼"];
  return [...tiles].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

const practiceRouter = router({
  start: protectedProcedure.mutation(async ({ ctx }) => {
    const deck = createDeck();
    const playerHand = sortTiles(deck.splice(0, 20));
    const opponentHand = sortTiles(deck.splice(0, 20));

    const gameState = {
      handTiles: playerHand,
      opponentHand,
      exposedTiles: [] as string[][],
      opponentExposed: [] as string[][],
      currentHuxi: 0,
      opponentHuxi: 0,
      remainingTiles: deck.length,
      deck,
      lastDrawn: null as string | null,
      currentAction: null as string | null,
      gameOver: false,
      message: "对局开始！请选择一张牌打出。",
    };

    const sessionId = await createPracticeSession({
      userId: ctx.user.id,
      gameState: gameState,
      moveHistory: [],
      result: "ongoing",
    });

    const clientState = { ...gameState };
    delete (clientState as any).opponentHand;
    delete (clientState as any).deck;

    return { sessionId, gameState: clientState };
  }),

  move: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        action: z.string(),
        tile: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await getPracticeSession(input.sessionId);
      if (!session) throw new Error("Session not found");

      const state = session.gameState as any;

      if (state.gameOver) {
        const clientState = { ...state };
        delete clientState.opponentHand;
        delete clientState.deck;
        return { gameState: clientState };
      }

      if (input.action === "discard" && input.tile) {
        const idx = state.handTiles.indexOf(input.tile);
        if (idx === -1) throw new Error("Tile not in hand");
        state.handTiles.splice(idx, 1);

        if (state.deck.length > 0) {
          const aiDraw = state.deck.pop();
          const aiDiscardIdx = Math.floor(Math.random() * state.opponentHand.length);
          state.opponentHand.splice(aiDiscardIdx, 1);
          if (aiDraw) state.opponentHand.push(aiDraw);
          state.opponentHand = sortTiles(state.opponentHand);
        }

        if (state.deck.length > 0) {
          const drawn = state.deck.pop();
          if (drawn) {
            state.handTiles.push(drawn);
            state.handTiles = sortTiles(state.handTiles);
            state.lastDrawn = drawn;
          }
        }

        state.remainingTiles = state.deck.length;
        state.message = `你打出了 ${input.tile}，摸到了 ${state.lastDrawn || "无"}`;

        if (state.deck.length === 0) {
          state.gameOver = true;
          state.message = "底牌已摸完，对局结束！";
          state.result = "draw";
        }
      }

      const moveHistory = (session.moveHistory as any[]) || [];
      moveHistory.push({
        action: input.action,
        tile: input.tile,
        timestamp: Date.now(),
      });

      await updatePracticeSession(input.sessionId, {
        gameState: state,
        moveHistory,
        result: state.gameOver ? "draw" : "ongoing",
      });

      const clientState = { ...state };
      delete clientState.opponentHand;
      delete clientState.deck;

      return { gameState: clientState };
    }),
});

// ===== Main Router =====
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  analysis: analysisRouter,
  stats: statsRouter,
  practice: practiceRouter,
});

export type AppRouter = typeof appRouter;
