import { analyzeHand, handFromTiles, canHu, analyzeTing } from "./server/zipai-engine.ts";

// 用户实例：打叁后的20张牌
// 正确拆法：一二三(3胡) + 壹贰叁(6胡) + 六七八(0胡) + 八九十(0胡) + 柒捌玖(0胡) + 四五鬼(0胡) + 将:陆陆 = 9胡
// 听陆 → 碰陆=陆陆陆(+3胡) = 12胡 胡牌

console.log("=== 测试1：打叁后20张手牌分析 ===");
const tiles20 = ["十", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"];
console.log(`手牌(${tiles20.length}张): ${tiles20.join("、")}`);

const result20 = analyzeHand(tiles20);
console.log(`\n找到 ${result20.plans.length} 个方案`);

for (let i = 0; i < Math.min(5, result20.plans.length); i++) {
  const p = result20.plans[i];
  console.log(`\n--- 方案${i + 1} (分数:${p.score}, 散牌:${p.remainingCount}张, 胡息:${p.totalHuxi}) ---`);
  for (const g of p.groups) {
    console.log(`  ${g.description}`);
  }
  if (p.pair) console.log(`  将牌: ${p.pair.join("")}`);
  if (p.remainingCount > 0) console.log(`  散牌: ${p.remainingTiles.join("、")}`);
}

// 检查是否找到了正确拆法
const correctFound = result20.plans.some(p => {
  if (p.remainingCount !== 0) return false;
  if (!p.pair) return false;
  const pairStr = [...p.pair].sort().join("");
  if (pairStr !== "陆陆") return false;
  // 检查是否包含六七八顺子
  const hasLiuQiBa = p.groups.some(g => {
    const ts = [...g.tiles].sort().join("");
    return ts === "七八六" || ts === "六七八";
  });
  // 检查是否包含四五鬼
  const hasSiWuGui = p.groups.some(g => g.tiles.includes("鬼") && (g.tiles.includes("四") || g.tiles.includes("五")));
  return hasLiuQiBa && hasSiWuGui;
});
console.log(`\n✅ 找到正确拆法(六七八+四五鬼+陆陆将): ${correctFound ? "是" : "否"}`);

// 测试2：21张手牌听牌分析
console.log("\n\n=== 测试2：21张手牌听牌分析 ===");
const tiles21 = ["十", "叁", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"];
console.log(`手牌(${tiles21.length}张): ${tiles21.join("、")}`);

const result21 = analyzeHand(tiles21);
console.log(`\n听牌分析结果: ${result21.tingAnalysis.length} 种打法可听牌`);

for (const ting of result21.tingAnalysis.slice(0, 5)) {
  console.log(`\n打${ting.discard} → 听${ting.tingTiles.map(t => t.tile).join("、")} (${ting.tingWidth}种${ting.tingCount}张)`);
  for (const tt of ting.tingTiles) {
    if (tt.bestGroups) {
      const planDesc = tt.bestGroups.map(g => g.description).join(" + ");
      const pairDesc = tt.bestPair ? ` 将:${tt.bestPair.join("")}` : "";
      console.log(`  来${tt.tile}: ${planDesc}${pairDesc} = ${tt.maxHuxi}胡`);
    }
  }
}

// 检查打叁是否听陆
const daSanTing = result21.tingAnalysis.find(t => t.discard === "叁");
if (daSanTing) {
  const tingLu = daSanTing.tingTiles.find(t => t.tile === "陆");
  console.log(`\n✅ 打叁听陆: ${tingLu ? `是 (${tingLu.maxHuxi}胡)` : "否"}`);
} else {
  console.log(`\n❌ 打叁不在听牌列表中`);
}

// 测试3：简单坎测试
console.log("\n\n=== 测试3：简单牌型验证 ===");
// 五伍伍 = 混组0胡
const mixTest = ["五", "伍", "伍"];
const mixResult = analyzeHand(mixTest);
console.log(`五伍伍: ${mixResult.plans[0]?.groups[0]?.description || "无"}`);

// 二二鬼 = 坎3胡
const ghostKanTest = ["二", "二", "鬼"];
const ghostKanResult = analyzeHand(ghostKanTest);
console.log(`二二鬼: ${ghostKanResult.plans[0]?.groups[0]?.description || "无"}`);
