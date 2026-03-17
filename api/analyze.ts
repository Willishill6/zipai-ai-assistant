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

// ===== 识别 Prompt（V2：精准区分手牌/明牌，修复叁/壹混淆，阶梯布局）=====
const TILE_RECOGNITION_PROMPT = `你是桂林飞飞字牌游戏的牌面识别专家。

## 一、牌面大字 vs 小字对照表（最重要！）

| 数字 | 小字 | 小字特征 | 大字 | 大字特征 | 颜色 |
|------|------|---------|------|---------|------|
| 1 | 一 | 仅1笔横线，极简 | 壹 | 上部有"士"，下部有"冖豆"，复杂 | 黑 |
| 2 | 二 | 仅2笔两横，极简 | 贰 | 左有"弋"，右有"贝"，复杂 | 红 |
| 3 | 三 | 仅3笔三横，极简 | 叁 | 上部3个撇点"厶"，下部"大"，复杂 | 黑 |
| 4 | 四 | 口字框内两竖，5笔 | 肆 | 左"聿"右长横，13笔，极复杂 | 黑 |
| 5 | 五 | 横竖横竖，4笔，无偏旁 | 伍 | 左边有单人旁"亻"，6笔 | 黑 |
| 6 | 六 | 点横撇点，4笔，无偏旁 | 陆 | 左边有耳刀旁"阝"，7笔 | 黑 |
| 7 | 七 | 一横一竖弯，2笔，极简 | 柒 | 上"木"下复杂，10笔 | 红 |
| 8 | 八 | 一撇一捺，2笔，极简 | 捌 | 左提手旁"扌"，右"别"，10笔 | 黑 |
| 9 | 九 | 撇和弯钩，2笔，极简 | 玖 | 左"王"右"久"，7笔 | 黑 |
| 10 | 十 | 一横一竖，2笔，极简 | 拾 | 左提手旁"扌"，右"合"，9笔 | 红 |
| 鬼 | 鬼/飞飞 | 紫色或彩色特殊图案 | — | — | 紫/彩 |

## 二、最容易混淆的字对（必读！）

**叁 vs 壹**（都是黑色大字，最容易混淆！）
- 叁：上面是3个小撇点（像"厶厶厶"），下面是"大"字，整体像"参"的简化
- 壹：上面是"士"（横横竖），中间"冖"，下面"豆"，整体像"壶"的变体
- 关键区别：叁的上部有3个撇点，壹的上部是横横竖

**七 vs 柒**（都是红色！）
- 七：极简，只有2笔（一横一竖弯），像数字"7"
- 柒：复杂，上面有"木"，下面有复杂结构，10笔以上

**十 vs 拾**（都是红色！）
- 十：极简，只有2笔（十字形），像加号"+"
- 拾：左边有提手旁，复杂

**五 vs 伍**（都是黑色）
- 五：4笔，无偏旁，字形简单
- 伍：左边有单人旁"亻"，字形偏左

**三 vs 叁**（都是黑色）
- 三：极简，就是3条横线
- 叁：复杂，上部有撇点，下部有"大"

## 三、截图区域布局（极其重要！）

桂林飞飞的截图有固定布局：

**我的手牌区域（底部，必须全部识别）：**
- 位置：截图最底部，白色小方块牌
- 布局：通常是阶梯状2-4排，每排从左到右排列
- 庄家：21张手牌（底部有"庄"标记）
- 闲家：20张手牌
- ❗ 右侧可能有1-2张单独突出的牌（比其他牌位置更高），这些也是手牌，不能漏！
- ❗ 有时最左侧有1列竖排的牌（1-4张），这些也是手牌！

**我的明牌区域（绝对不是手牌！）：**
- 位置：截图左侧，竖排的牌组（碰/坎/吃）
- 特征：通常3-4张一组，竖向排列，位置在左边缘
- ❗❗❗ 这些牌绝对不能计入handTiles！要放入myExposedGroups！

**对手明牌区域（绝对不是手牌！）：**
- 位置：截图顶部
- ❗❗❗ 这些牌绝对不能计入handTiles！

**弃牌区：** 中间散落的牌

## 四、识别步骤

1. **先定位手牌区域**：找到截图底部的白色牌区，这是手牌
2. **先定位明牌区域**：找到左侧竖排牌组，这是明牌（不是手牌）
3. **从左到右、从上到下**逐排识别手牌：
   - 最上排（如果有）：从左到右
   - 中间排：从左到右
   - 最下排：从左到右
   - 右侧突出的单列：从上到下
4. **每张牌识别流程**：
   a. 看颜色：红色 → 只可能是 二/贰/七/柒/十/拾
   b. 看笔画复杂度：简单（无偏旁）→ 小字；复杂（有偏旁）→ 大字
   c. 红色且极简（2笔）→ 一定是小字（七或十）
5. **验证**：每种牌最多4张，超过说明大小字混淆了

## 五、输出格式（必须严格遵守）
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

// 从LLM响应中提取JSON（处理markdown代码块和各种格式）
function extractJSON(content: string): any {
  if (!content) throw new Error("Empty content");
  // 如果已经是对象直接返回
  if (typeof content !== "string") return content;
  let cleaned = content.trim();
  // 去掉所有markdown代码块标记（支持多行）
  cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
  cleaned = cleaned.trim();
  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试提取最大的 { ... } 块（贪心匹配）
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // 尝试修复常见的JSON错误：末尾多余逗号
        const fixed = match[0].replace(/,\s*([}\]])/g, "$1");
        try {
          return JSON.parse(fixed);
        } catch {
          // ignore
        }
      }
    }
    throw new Error("Cannot parse JSON from: " + cleaned.slice(0, 200));
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
            text: `请精确识别这张桂林飞飞字牌游戏截图中的手牌。

步骤1：定位区域
- 手牌 = 截图最底部的白色方块牌（阶梯状排列，2-4排）
- 明牌 = 截图左侧竖排的牌组（碰/坎/吃），这些不是手牌！
- 对手牌 = 截图顶部，不是手牌！

步骤2：逐排识别手牌（从上到下，每排从左到右）
- 注意：右侧可能有1-2张单独突出的牌，也是手牌！
- 注意：左侧可能有1列竖排手牌（不是明牌组）！

步骤3：每张牌识别
- 红色+极简(2笔) = 小字七(七)或小字十(十)
- 红色+复杂 = 大字柒/贰/拾
- 黑色+无偏旁 = 小字
- 黑色+有偏旁(亻阝扌) = 大字

步骤4：验证
- 每种牌最多4张，超过说明混淆了大小字
- 叁(上部撇点+大) ≠ 壹(上部士+冖+豆)
- 庄家21张，闲家20张，以实际为准`,
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
  if (handTiles.length < 18) {
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
