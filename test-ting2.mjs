import { analyzeHand } from "./server/zipai-engine.ts";

/**
 * 测试：打哪张听牌最多
 * 
 * 手牌14张: 五、陆、叁、伍、六、二、鬼、贰、伍、六、二、七、肆、拾
 * 明牌胡息: 9胡
 * 
 * 鬼牌可以变任何牌！所以对每种出牌方案，引擎会自动穷举鬼牌的最优替代
 */

const handTiles = ["五", "陆", "叁", "伍", "六", "二", "鬼", "贰", "伍", "六", "二", "七", "肆", "拾"];
const existingHuxi = 9;

console.log("=== 当前手牌 ===");
console.log(handTiles.join("、"));
console.log(`手牌数: ${handTiles.length}张 | 明牌胡息: ${existingHuxi}胡\n`);

// 获取不重复的牌（鬼牌不能打出，它是万能牌）
const uniqueTiles = [...new Set(handTiles)].filter(t => t !== "鬼");

const results = [];

for (const discard of uniqueTiles) {
  const remaining = [...handTiles];
  const idx = remaining.indexOf(discard);
  if (idx >= 0) remaining.splice(idx, 1);
  
  // analyzeHand会自动处理鬼牌：穷举鬼牌变成每种牌的情况
  const engineResult = analyzeHand(remaining);
  const bestPlan = engineResult.plans[0];
  
  if (bestPlan) {
    const totalHuxi = bestPlan.totalHuxi + existingHuxi;
    const ghostInfo = engineResult.ghostAnalysis.hasGhost 
      ? `鬼→${engineResult.ghostAnalysis.bestReplacement}` 
      : "无鬼";
    
    results.push({
      discard,
      bestPlanHuxi: bestPlan.totalHuxi,
      totalHuxi,
      huxiEnough: totalHuxi >= 10,
      stepsToTing: bestPlan.stepsToTing,
      score: bestPlan.score,
      groups: bestPlan.groups.map(g => g.description).join(" + "),
      loose: bestPlan.remainingTiles.join("、"),
      looseCount: bestPlan.remainingCount,
      looseRelation: bestPlan.looseRelation,
      ghostInfo,
      ghostTop3: engineResult.ghostAnalysis.allReplacements.slice(0, 5),
    });
  }
}

// 按评分排序
results.sort((a, b) => b.score - a.score);

console.log("=== 打牌分析（按推荐排序）===\n");
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const rank = i === 0 ? "★最优★" : `第${i+1}`;
  console.log(`${rank} 打 【${r.discard}】 | ${r.ghostInfo}`);
  console.log(`  手牌胡息: ${r.bestPlanHuxi} | 总胡息: ${r.totalHuxi} | ${r.huxiEnough ? "✅达标" : "❌不够"}`);
  console.log(`  几步听胡: ${r.stepsToTing}步 | 评分: ${r.score}`);
  console.log(`  组合: ${r.groups}`);
  console.log(`  散牌(${r.looseCount}张): ${r.loose}`);
  console.log(`  散牌关联: ${r.looseRelation}`);
  if (r.ghostTop3.length > 0) {
    console.log(`  鬼牌替代TOP5:`);
    for (const g of r.ghostTop3) {
      console.log(`    鬼→${g.tile}: 胡息${g.bestPlanHuxi}, ${g.stepsToTing}步听胡, 评分${g.bestPlanScore}`);
    }
  }
  console.log();
}

console.log("=== 最终推荐 ===");
if (results.length > 0) {
  const best = results[0];
  console.log(`打 【${best.discard}】 | ${best.ghostInfo}`);
  console.log(`总胡息${best.totalHuxi}, ${best.stepsToTing}步听胡`);
  console.log(`组法: ${best.groups}`);
}
