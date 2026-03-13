// 详细分析：打叁后，听每张牌的完整胡牌牌型
import { analyzeHand } from './server/zipai-engine.ts';

// 当前手牌21张
const originalHand = [
  "十", "叁", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼",
  "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"
];

console.log("=== 当前手牌(21张) ===");
console.log(originalHand.join("、"));
console.log();

// 打叁后的手牌(20张) - 正确移除一张叁
const hand20 = [...originalHand];
const removeIdx = hand20.indexOf("叁");
hand20.splice(removeIdx, 1);

console.log("=== 打叁后手牌(20张) ===");
console.log(hand20.join("、"));
console.log(`共${hand20.length}张`);
console.log();

// 先分析打叁后20张的基础方案
const base = analyzeHand(hand20, { exposedHuxi: 0, minHuxi: 10 });
console.log("=== 打叁后20张基础方案 ===");
const bp = base.plans[0];
if (bp) {
  for (const g of bp.groups) {
    console.log(`  ${g.description}`);
  }
  console.log(`  散牌(${bp.remainingCount}张): ${bp.remainingTiles.join("、")}`);
  console.log(`  总胡息: ${bp.totalHuxi}`);
}
console.log();

// 对每个听牌，加入后分析完整牌型
const tingTiles = ["三", "六", "九", "陆"];

for (const ting of tingTiles) {
  console.log(`${"=".repeat(50)}`);
  console.log(`来【${ting}】后的完整胡牌牌型分析`);
  console.log(`${"=".repeat(50)}`);
  
  const fullHand = [...hand20, ting];
  console.log(`手牌(${fullHand.length}张): ${fullHand.join("、")}`);
  
  const result = analyzeHand(fullHand, { exposedHuxi: 0, minHuxi: 10 });
  
  // 找到能胡的方案（散牌<=2张且胡息>=10）
  let huPlanCount = 0;
  for (const plan of result.plans) {
    if (plan.totalHuxi >= 10 && plan.remainingCount <= 2) {
      huPlanCount++;
      console.log();
      console.log(`--- 胡牌方案${huPlanCount} (胡息:${plan.totalHuxi}) ---`);
      for (const g of plan.groups) {
        console.log(`  ${g.tiles.join("")} ${g.description}`);
      }
      if (plan.remainingCount > 0) {
        console.log(`  将牌: ${plan.remainingTiles.join("、")}`);
      }
      console.log(`  总胡息: ${plan.totalHuxi} ✓`);
    }
    if (huPlanCount >= 5) break;
  }
  
  if (huPlanCount === 0) {
    console.log();
    console.log("⚠ 未找到直接胡牌方案（散牌>2或胡息<10）");
    console.log("最优方案（非胡牌）：");
    const best = result.plans[0];
    if (best) {
      for (const g of best.groups) {
        console.log(`  ${g.tiles.join("")} ${g.description}`);
      }
      console.log(`  散牌(${best.remainingCount}张): ${best.remainingTiles.join("、")}`);
      console.log(`  总胡息: ${best.totalHuxi}`);
    }
  }
  
  console.log();
}

// 也看看引擎的听牌分析结果
console.log(`${"=".repeat(50)}`);
console.log("引擎听牌分析（21张，所有打法）");
console.log(`${"=".repeat(50)}`);
const resultFull = analyzeHand(originalHand, { exposedHuxi: 0, minHuxi: 10 });
if (resultFull.tingAnalysis && resultFull.tingAnalysis.length > 0) {
  for (const ting of resultFull.tingAnalysis) {
    console.log(`打${ting.discard} → 听${ting.tingTiles.map(t => `${t.tile}(${t.maxHuxi}胡)`).join("、")} (${ting.tingWidth}种${ting.tingCount}张)`);
  }
} else {
  console.log("引擎未找到一步听牌方案");
}

// 额外：逐个尝试所有可能的听牌
console.log();
console.log(`${"=".repeat(50)}`);
console.log("手动穷举：打叁后，尝试所有可能来牌");
console.log(`${"=".repeat(50)}`);

const ALL_TILES = [
  "一","二","三","四","五","六","七","八","九","十",
  "壹","贰","叁","肆","伍","陆","柒","捌","玖","拾"
];

for (const incoming of ALL_TILES) {
  const testHand = [...hand20, incoming];
  const testResult = analyzeHand(testHand, { exposedHuxi: 0, minHuxi: 10 });
  
  // 检查是否有胡牌方案
  for (const plan of testResult.plans) {
    if (plan.totalHuxi >= 10 && plan.remainingCount <= 2) {
      const groups = plan.groups.map(g => g.description).join(" + ");
      const jiang = plan.remainingCount > 0 ? ` 将:${plan.remainingTiles.join("")}` : "";
      console.log(`来【${incoming}】→ ${groups}${jiang} = ${plan.totalHuxi}胡 ✓胡牌`);
      break;
    }
  }
}
