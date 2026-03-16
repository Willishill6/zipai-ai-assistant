/**
 * 引擎直接生成建议（替代Step 3 LLM调用，节省6秒）
 */
import type { EngineResult } from "./zipai-engine";

export function generateAdviceFromEngine(engine: EngineResult, recognition: any, exposedHuxi: number) {
  const handTiles: string[] = recognition.handTiles || [];
  const handTileSet = new Set(handTiles);
  const plan0 = engine.plans[0];
  if (!plan0) {
    return {
      currentHuxi: 0, potentialHuxi: 0, gamePhase: "未知", strategyMode: "未知",
      recommendedAction: "分析失败", recommendedTile: "", discardPriority: [],
      defenseAnalysis: { riskLevel: "未知", isDefenseMode: false, defenseReason: "", tilesSafety: [], dianpaoWarning: "" },
      forwardPlan: "", ghostAdvice: "无鬼牌", aiSuggestion: "无法分析", analysisReasoning: "",
      huxiBreakdown: "", optimalPlanSummary: "",
    };
  }

  // 胡息计算
  const handHuxi = plan0.totalHuxi;
  const totalHuxi = handHuxi + exposedHuxi + engine.kanHuxi;

  // 胡息明细
  const huxiParts: string[] = [];
  for (const g of plan0.groups) {
    if (g.huxi > 0) huxiParts.push(`${g.tiles.join("")}=${g.huxi}胡`);
  }
  if (engine.kanHuxi > 0) {
    for (const k of engine.lockedKan) {
      huxiParts.push(`🔒${k.tiles.join("")}=${k.huxi}胡`);
    }
  }
  if (exposedHuxi > 0) huxiParts.push(`明牌=${exposedHuxi}胡`);
  const huxiBreakdown = huxiParts.length > 0
    ? `${huxiParts.join(" + ")} = 总计${totalHuxi}胡`
    : `总计${totalHuxi}胡`;

  // 最优方案摘要
  const planDesc = plan0.groups.map(g => g.description).join(" + ");
  const optimalPlanSummary = `${planDesc}，散牌${plan0.remainingCount}张`;

  // 游戏阶段
  const remaining = recognition.remainingTiles || 0;
  const gamePhase = remaining > 30 ? "开局" : remaining > 15 ? "中局" : "终局";

  // 策略模式
  let strategyMode = "攒胡息模式";
  if (totalHuxi >= 10 && plan0.stepsToTing <= 1) strategyMode = "快速胡牌模式";
  else if (totalHuxi >= 10) strategyMode = "听牌模式";
  else if (remaining < 15 && totalHuxi < 8) strategyMode = "防守模式";

  // 锁定牌名集合
  const lockedTileNames = new Set(engine.lockedKan.flatMap(k => k.tiles));

  // 推荐打牌
  let recommendedTile = "";
  let recommendedAction = "打出";

  // 检查是否有操作按钮（胡/碰/吃）
  const actionBtns = recognition.actionButtons || "无";
  if (actionBtns.includes("胡")) {
    recommendedAction = "胡";
    recommendedTile = "";
  } else if (actionBtns.includes("碰")) {
    recommendedAction = "碰";
    recommendedTile = "";
  }

  // 从听牌分析中找最优打牌
  if (recommendedAction === "打出" && engine.tingAnalysis && engine.tingAnalysis.length > 0) {
    // 优先找手牌中存在的听牌推荐
    for (const ting of engine.tingAnalysis) {
      if (handTileSet.has(ting.discard)) {
        recommendedTile = ting.discard;
        break;
      }
    }
    // 如果没找到，用第一个
    if (!recommendedTile) recommendedTile = engine.tingAnalysis[0].discard;
  } else if (recommendedAction === "打出" && plan0.looseAnalysis.length > 0) {
    // 没有听牌，打废牌或进张数最少的散牌（必须在手牌中）
    const wasteTiles = plan0.looseAnalysis.filter(la => la.isWaste && !lockedTileNames.has(la.tile) && handTileSet.has(la.tile));
    if (wasteTiles.length > 0) {
      recommendedTile = wasteTiles[0].tile;
    } else {
      const sortedLoose = [...plan0.looseAnalysis]
        .filter(la => !lockedTileNames.has(la.tile) && handTileSet.has(la.tile))
        .sort((a, b) => a.jinzhangCount - b.jinzhangCount);
      if (sortedLoose.length > 0) recommendedTile = sortedLoose[0].tile;
    }
  }

  // 最终校验：推荐打的牌必须在手牌中
  if (recommendedTile && !handTileSet.has(recommendedTile) && handTiles.length > 0) {
    console.log(`[WARN] 推荐牌"${recommendedTile}"不在手牌中，自动修正`);
    // 从散牌中找一个在手牌中的
    const fallback = plan0.looseAnalysis.find(la => !lockedTileNames.has(la.tile) && handTileSet.has(la.tile));
    recommendedTile = fallback?.tile || handTiles.find(t => !lockedTileNames.has(t)) || "";
  }

  // 出牌优先级
  const discardPriority: string[] = [];
  if (plan0.looseAnalysis.length > 0) {
    const sorted = [...plan0.looseAnalysis]
      .filter(la => !lockedTileNames.has(la.tile))
      .sort((a, b) => {
        if (a.isWaste && !b.isWaste) return -1;
        if (!a.isWaste && b.isWaste) return 1;
        return a.jinzhangCount - b.jinzhangCount;
      });
    for (const la of sorted) {
      const reason = la.isWaste
        ? "废牌"
        : la.hasPair
        ? `对子可碰(进张${la.jinzhangCount})`
        : la.partialShunzi.length > 0
        ? `搭子(进张${la.jinzhangCount})`
        : `孤张(进张${la.jinzhangCount})`;
      discardPriority.push(`${la.tile}(${reason})`);
    }
  }

  // 安全评估
  const discardedTiles = recognition.discardedTiles || [];
  const opponentGroups = recognition.opponentExposedGroups || [];
  const opponentHuxi = recognition.opponentCurrentHuxi || 0;
  const riskLevel = opponentHuxi >= 8 ? "高风险" : opponentHuxi >= 5 ? "中风险" : "低风险";
  const isDefenseMode = opponentHuxi >= 8 && remaining < 20;

  // 每张散牌的安全评估
  const tilesSafety = plan0.looseAnalysis
    .filter(la => !lockedTileNames.has(la.tile))
    .map(la => {
      const isInDiscard = discardedTiles.includes(la.tile);
      const isOpponentExposed = opponentGroups.some((g: any) => g.tiles?.includes(la.tile));
      let safetyLevel = "较安全";
      let safetyEmoji = "🟡";
      let reason = "";

      if (isInDiscard) {
        safetyLevel = "安全";
        safetyEmoji = "🟢";
        reason = "弃牌区已有，对手不需要";
      } else if (la.isWaste) {
        safetyLevel = "安全";
        safetyEmoji = "🟢";
        reason = "废牌，且目前无任何关联";
      } else if (isOpponentExposed) {
        safetyLevel = "有风险";
        safetyEmoji = "🟠";
        reason = "对手明牌中有相关牌";
      } else if (opponentHuxi >= 8) {
        safetyLevel = "有风险";
        safetyEmoji = "🟠";
        reason = "对手胡息较高，需谨慎";
      } else {
        reason = opponentGroups.length === 0
          ? "开局阶段，对手无明牌，弃牌区安全牌多，无需防守"
          : "安全性一般";
      }
      return { tile: la.tile, safetyLevel, safetyEmoji, reason };
    });

  const defenseReason = opponentGroups.length === 0 && opponentHuxi === 0
    ? "开局阶段，对手无明牌，弃牌区安全牌多，无需防守"
    : opponentHuxi >= 8
    ? `对手胡息${opponentHuxi}，接近听牌，需谨慎出牌`
    : "目前无点炮风险";
  const dianpaoWarning = opponentHuxi >= 8
    ? `对手${opponentHuxi}胡，注意防炮！点炮=4倍惩罚`
    : "目前无点炮风险";

  // 前瞻规划
  let forwardPlan = "";
  if (engine.tingAnalysis && engine.tingAnalysis.length > 0) {
    const best = engine.tingAnalysis[0];
    forwardPlan = `打${best.discard}→听${best.tingTiles.map(t => t.tile).join("、")}(${best.tingWidth}种${best.tingCount}张)`;
    if (engine.tingAnalysis.length > 1) {
      const alt = engine.tingAnalysis[1];
      forwardPlan += `；或打${alt.discard}→听${alt.tingTiles.map(t => t.tile).join("、")}(${alt.tingWidth}种${alt.tingCount}张)`;
    }
  } else {
    const pairs = plan0.looseAnalysis.filter(la => la.hasPair);
    const partials = plan0.looseAnalysis.filter(la => la.partialShunzi.length > 0);
    if (pairs.length > 0) forwardPlan += `等碰${pairs.map(p => p.tile).join("、")}`;
    if (partials.length > 0) forwardPlan += `；等吃${partials.map(p => p.partialShunzi[0].need).join("、")}`;
    if (!forwardPlan) forwardPlan = "继续攒胡息，打废牌优先";
  }

  // 鬼牌建议
  const ghostAdvice = engine.ghostAnalysis.hasGhost
    ? `鬼牌最优替代: 鬼→${engine.ghostAnalysis.bestReplacement}`
    : "无鬼牌";

  // AI建议摘要
  let aiSuggestion = "";
  if (recommendedAction === "胡") {
    aiSuggestion = "可以胡牌！立即点击胡。";
  } else if (recommendedAction === "碰") {
    aiSuggestion = "建议碰牌，增加胡息。";
  } else {
    const parts: string[] = [];
    if (recommendedTile) parts.push(`推荐打${recommendedTile}`);
    if (totalHuxi >= 10 && plan0.stepsToTing <= 1) parts.push("已达听牌条件");
    else if (totalHuxi >= 10) parts.push("胡息已达标，加快听牌");
    else parts.push(`还差${10 - totalHuxi}胡息达标`);
    if (engine.lockedKan.length > 0) parts.push(`${engine.lockedKan.map(k => k.tiles.join("")).join("、")}已锁定`);
    aiSuggestion = parts.join("，") + "。";
  }

  return {
    huxiBreakdown,
    currentHuxi: totalHuxi,
    potentialHuxi: totalHuxi + (plan0.looseAnalysis.filter(la => la.hasPair).length * 3),
    gamePhase,
    strategyMode,
    recommendedAction,
    recommendedTile,
    discardPriority,
    defenseAnalysis: {
      riskLevel,
      isDefenseMode,
      defenseReason,
      tilesSafety,
      dianpaoWarning,
    },
    forwardPlan,
    ghostAdvice,
    aiSuggestion,
    analysisReasoning: `引擎穷举${engine.plans.length}种拆组方案，最优方案评分${plan0.score}，${plan0.stepsToTing}步听胡。${optimalPlanSummary}`,
    optimalPlanSummary,
  };
}
