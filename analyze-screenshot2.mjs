// 分析用户第二张截图
// 基本信息: 剩余底牌35张, 我方0胡, 对手0胡(-21分), 闲家
// 对手有"庄"标记, 我方底部显示21(可能是积分)
// 无明牌组, 无弃牌区可见, 无操作按钮

// 手牌识别（3行排列）:
// 第1行(5张): 十(红) 叁 六 捌 五
// 第2行(6张): 七(红) 贰(红) 陆 八 四 九 鬼
// 第3行(9张): 二(红) 壹 陆 八 三 玖 一 叁 柒(红)
//
// 总计: 5+7+9 = 21张
// 81-35=46张已发出, 但没有明牌组和弃牌
// 如果双方各拿到牌: 21+20=41, 加上弃牌5张=46? 
// 或者我是庄家21张? 但对手有"庄"标记...
// 可能是我摸了一张需要打出(当前21张)
//
// 手牌21张:

import { analyzeHand } from './server/zipai-engine.ts';

const handTiles = [
  // 第1行
  "十",    // 红色
  "叁",
  "六",
  "捌",
  "五",
  // 第2行
  "七",    // 红色
  "贰",   // 红色
  "陆",
  "八",
  "四",
  "九",
  "鬼",
  // 第3行
  "二",    // 红色
  "壹",
  "陆",
  "八",
  "三",
  "玖",
  "一",
  "叁",
  "柒",   // 红色
];

console.log("=== 手牌识别 ===");
console.log(`手牌(${handTiles.length}张): ${handTiles.join("、")}`);

// 统计
const counts = {};
for (const t of handTiles) {
  counts[t] = (counts[t] || 0) + 1;
}
console.log("牌面统计:");
for (const [tile, count] of Object.entries(counts)) {
  if (count > 1) console.log(`  ${tile} × ${count}`);
}
console.log();

// 调用引擎分析（21张=庄家或摸牌后需打出）
const result = analyzeHand(handTiles, { exposedHuxi: 0, minHuxi: 10 });

console.log("=== 引擎分析结果 ===");
console.log(`总牌数: ${result.totalTiles}张`);
console.log();

// 输出前5个方案
for (let i = 0; i < Math.min(5, result.plans.length); i++) {
  const plan = result.plans[i];
  console.log(`--- 方案${i + 1} (评分:${plan.score}) ---`);
  console.log(`牌组:`);
  for (const g of plan.groups) {
    console.log(`  ${g.description}`);
  }
  console.log(`总胡息: ${plan.totalHuxi}`);
  console.log(`散牌(${plan.remainingCount}张): ${plan.remainingTiles.join("、")}`);
  console.log(`几步听胡: ${plan.stepsToTing}步`);
  if (plan.looseRelation) {
    console.log(`散牌关联: ${plan.looseRelation}`);
  }
  console.log();
}

// 鬼牌分析
console.log("=== 鬼牌分析 ===");
console.log(`有鬼牌: ${result.ghostAnalysis.hasGhost}`);
if (result.ghostAnalysis.hasGhost) {
  console.log(`最优替代: 鬼→${result.ghostAnalysis.bestReplacement}`);
  console.log(`所有替代方案:`);
  for (const r of result.ghostAnalysis.allReplacements.slice(0, 15)) {
    console.log(`  鬼→${r.tile}: 最优方案胡息=${r.bestPlanHuxi}, ${r.stepsToTing}步听胡, 评分=${r.bestPlanScore}`);
  }
}

// 听牌分析
if (result.tingAnalysis && result.tingAnalysis.length > 0) {
  console.log();
  console.log("=== 听牌分析 ===");
  for (const ting of result.tingAnalysis.slice(0, 15)) {
    console.log(`打${ting.discard} → 听${ting.tingTiles.map(t => `${t.tile}(${t.maxHuxi}胡)`).join("、")} (${ting.tingWidth}种${ting.tingCount}张, 最高${ting.maxHuxi}胡)`);
  }
} else {
  console.log();
  console.log("=== 听牌分析 ===");
  console.log("当前无法一步听牌");
}

// 散牌进张分析
const bestPlan = result.plans[0];
if (bestPlan && bestPlan.looseAnalysis.length > 0) {
  console.log();
  console.log("=== 散牌进张分析（最优方案） ===");
  for (const la of bestPlan.looseAnalysis) {
    const parts = [la.tile];
    if (la.hasPair) parts.push("有对子可碰");
    if (la.partialShunzi.length > 0) {
      parts.push(`搭子:${la.partialShunzi.map(ps => `差${ps.need}组${ps.form}`).join("/")}`);
    }
    parts.push(`进张数:${la.jinzhangCount}`);
    if (la.isWaste) parts.push("⚠废牌");
    console.log(`  ${parts.join(" | ")}`);
  }
}
