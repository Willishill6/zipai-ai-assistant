/**
 * Vercel Serverless Function: /api/reanalyze
 * 
 * 手动修正手牌后重新计算（跳过LLM识别，直接调用引擎）
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeHand } from "./zipai-engine";
import { generateAdviceFromEngine } from "./advice-generator";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const input = req.body;
    const handTiles: string[] = input.handTiles || [];
    const exposedHuxi = input.myCurrentHuxi || 0;
    const knownTiles: string[] = [
      ...(input.discardedTiles || []),
      ...(input.myExposedGroups || []).flatMap((g: any) => g.tiles || []),
      ...(input.opponentExposedGroups || []).flatMap((g: any) => g.tiles || []),
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

    const typeLabel = (type: string) => {
      if (type === "kan") return "坎";
      if (type === "shunzi") return "顺子";
      if (type === "ghost_kan") return "坎(鬼)";
      if (type === "ghost_shunzi") return "顺(鬼)";
      if (type === "mixed_kan") return "组合牌";
      if (type === "ghost_mixed") return "组合牌(鬼)";
      return type;
    };

    const result = {
      handTiles: recognition.handTiles,
      myExposedGroups: (recognition.myExposedGroups || []).map((g: any) => ({ ...g, huxi: g.huxi || 0 })),
      opponentExposedGroups: (recognition.opponentExposedGroups || []).map((g: any) => ({ ...g, huxi: g.huxi || 0 })),
      discardedTiles: recognition.discardedTiles || [],
      remainingTiles: recognition.remainingTiles || 0,
      actionButtons: recognition.actionButtons || "无",
      isDealer: recognition.isDealer,
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
          replaceTile: r.tile, formedGroup: "", groupType: "", huxiGain: r.bestPlanHuxi,
          isOptimal: r.tile === engineResult.ghostAnalysis.bestReplacement,
        })),
        bestOption: engineResult.ghostAnalysis.hasGhost ? `鬼→${engineResult.ghostAnalysis.bestReplacement}` : "无",
      },
      tileEfficiency: engineResult.plans[0]?.looseAnalysis.map((la: any) => ({
        tile: la.tile, jinzhangCount: la.jinzhangCount, isWaste: la.isWaste,
        wasteReason: la.isWaste ? "无组合可能" : (la.partialShunzi.length > 0 ? `搭子:差${la.partialShunzi[0].need}` : ""),
      })) || [],
      lockedKan: engineResult.lockedKan.map((kan: any) => ({ tiles: kan.tiles, huxi: kan.huxi, description: kan.description })),
      kanHuxi: engineResult.kanHuxi,
      kanLockAnalysis: engineResult.lockedKan.length > 0 ? engineResult.lockedKan.map((g: any) => `🔒${g.tiles.join("")}坎(${g.huxi}胡)不可拆`).join("；") : "",
      tingAnalysis: (engineResult.tingAnalysis || []).slice(0, 10).map((ting: any) => ({
        discard: ting.discard,
        tingTiles: ting.tingTiles.map((t: any) => ({ tile: t.tile, maxHuxi: t.maxHuxi, planDesc: t.bestGroups ? t.bestGroups.map((g: any) => g.description).join(" + ") : "" })),
        tingWidth: ting.tingWidth, tingCount: ting.tingCount, maxHuxi: ting.maxHuxi,
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

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[reanalyze] Error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
