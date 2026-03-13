import { analyzeHand } from "./server/zipai-engine.ts";

/**
 * 测试：打哪张听牌最多
 * 
 * 截图信息：
 * - 我方9胡（明牌区已有的胡息）
 * - 手牌14张，需要出1张
 * - 手牌: 五、陆、叁、伍、六、二、鬼、贰、伍、六、二、七、肆、拾
 */

const handTiles = ["五", "陆", "叁", "伍", "六", "二", "鬼", "贰", "伍", "六", "二", "七", "肆", "拾"];
const existingHuxi = 9; // 明牌区已有的胡息

console.log("=== 当前手牌 ===");
console.log(handTiles.join("、"));
console.log(`手牌数: ${handTiles.length}张 | 明牌胡息: ${existingHuxi}胡`);
console.log();

// 获取不重复的牌
const uniqueTiles = [...new Set(handTiles)];

const results = [];

for (const discard of uniqueTiles) {
  const remaining = [...handTiles];
  const idx = remaining.indexOf(discard);
  if (idx >= 0) remaining.splice(idx, 1);
  
  // 用引擎分析剩余牌
  const engineResult = analyzeHand(remaining);
  const bestPlan = engineResult.plans[0];
  
  if (bestPlan) {
    const totalHuxi = bestPlan.totalHuxi + existingHuxi;
    results.push({
      discard,
      remainingCount: remaining.length,
      bestPlanHuxi: bestPlan.totalHuxi,
      totalHuxi,
      huxiEnough: totalHuxi >= 10,
      stepsToTing: bestPlan.stepsToTing,
      score: bestPlan.score,
      groups: bestPlan.groups.map(g => g.description).join(" + "),
      loose: bestPlan.remainingTiles.join("、"),
      looseCount: bestPlan.remainingCount,
      looseRelation: bestPlan.looseRelation,
    });
  }
}

// 按评分排序
results.sort((a, b) => b.score - a.score);

console.log("=== 打牌分析（按推荐排序）===\n");
for (const r of results) {
  console.log(`打 【${r.discard}】`);
  console.log(`  手牌胡息: ${r.bestPlanHuxi} | 总胡息: ${r.totalHuxi} | ${r.huxiEnough ? "✅达标" : "❌不够"}`);
  console.log(`  几步听胡: ${r.stepsToTing}步 | 评分: ${r.score}`);
  console.log(`  组合: ${r.groups}`);
  console.log(`  散牌(${r.looseCount}张): ${r.loose}`);
  console.log(`  散牌关联: ${r.looseRelation}`);
  console.log();
}

console.log("=== 推荐 ===");
if (results.length > 0) {
  console.log(`最优: 打 【${results[0].discard}】 (评分${results[0].score}, ${results[0].stepsToTing}步听胡, 总${results[0].totalHuxi}胡)`);
}
