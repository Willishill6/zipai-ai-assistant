// 详细分析打九后的听牌
import { analyzeHand, analyzeTing, canHu, backtrackSearch } from "./server/zipai-engine.ts";

// 手牌21张
const hand = [
  "拾", "九", "伍", "捌",
  "柒", "玖", "五", "八", "十", "六", "四", "三",
  "贰", "玖", "五", "八", "拾", "陆", "肆", "叁", "鬼"
];

// 打九后20张
const afterDiscard = hand.filter((_, i) => i !== hand.indexOf("九"));
console.log(`打九后${afterDiscard.length}张:`, afterDiscard.join(" "));

// 分析打九后的基础拆法
const result = analyzeHand(afterDiscard, { exposedHuxi: 0, minHuxi: 10 });
console.log(`\n最优方案: 散牌${result.plans[0].remainingCount}张, 胡息${result.plans[0].totalHuxi}`);
for (const g of result.plans[0].groups) {
  console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
}
console.log(`  将: ${result.plans[0].pair?.join("") || "无"}`);
if (result.plans[0].remaining?.length) {
  console.log(`  散牌: ${result.plans[0].remaining.join(" ")}`);
}

// 听五的详细胡牌牌型
console.log("\n\n=== 听五：来五后的完整胡牌牌型 ===");
const withFive = [...afterDiscard, "五"];
console.log(`来五后${withFive.length}张:`, withFive.join(" "));
const huResult = canHu(withFive, 0, 10);
console.log(`能胡: ${huResult.canHu}, 胡息: ${huResult.maxHuxi}`);
if (huResult.canHu && huResult.bestPlan) {
  for (const g of huResult.bestPlan.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
  console.log(`  将: ${huResult.bestPlan.pair?.join("") || "无"}`);
}

// 听八的详细胡牌牌型
console.log("\n\n=== 听八：来八后的完整胡牌牌型 ===");
const withEight = [...afterDiscard, "八"];
console.log(`来八后${withEight.length}张:`, withEight.join(" "));
const huResult2 = canHu(withEight, 0, 10);
console.log(`能胡: ${huResult2.canHu}, 胡息: ${huResult2.maxHuxi}`);
if (huResult2.canHu && huResult2.bestPlan) {
  for (const g of huResult2.bestPlan.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
  console.log(`  将: ${huResult2.bestPlan.pair?.join("") || "无"}`);
}

// 也看看打拾后的情况
console.log("\n\n=== 打拾后 ===");
const afterRemovedShi = [...hand];
const shiIdx = afterRemovedShi.indexOf("拾");
afterRemovedShi.splice(shiIdx, 1);
console.log(`打拾后${afterRemovedShi.length}张:`, afterRemovedShi.join(" "));
const resultShi = analyzeHand(afterRemovedShi, { exposedHuxi: 0, minHuxi: 10 });
console.log(`最优方案: 散牌${resultShi.plans[0].remainingCount}张, 胡息${resultShi.plans[0].totalHuxi}`);
for (const g of resultShi.plans[0].groups) {
  console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
}
console.log(`  将: ${resultShi.plans[0].pair?.join("") || "无"}`);
if (resultShi.plans[0].remaining?.length) {
  console.log(`  散牌: ${resultShi.plans[0].remaining.join(" ")}`);
}
