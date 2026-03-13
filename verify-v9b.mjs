import { analyzeHand, analyzeTing } from "./server/zipai-engine.ts";

// 测试1：21张手牌听牌分析（必须找到打叁听陆）
console.log("=== 测试1：21张手牌听牌分析 ===");
const tiles21 = ["十", "叁", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"];
console.log(`手牌(${tiles21.length}张): ${tiles21.join("、")}`);

const result21 = analyzeHand(tiles21);
console.log(`\n听牌分析结果: ${result21.tingAnalysis.length} 种打法可听牌`);

for (const ting of result21.tingAnalysis.slice(0, 10)) {
  console.log(`\n打${ting.discard} → 听${ting.tingTiles.map(t => t.tile).join("、")} (${ting.tingWidth}种${ting.tingCount}张, 最高${ting.maxHuxi}胡)`);
  for (const tt of ting.tingTiles) {
    if (tt.bestGroups) {
      const planDesc = tt.bestGroups.map(g => g.description).join(" + ");
      const pairDesc = tt.bestPair ? ` 将:${tt.bestPair.join("")}` : "";
      console.log(`  听${tt.tile}: ${planDesc}${pairDesc} = ${tt.maxHuxi}胡`);
    }
  }
}

// 检查打叁是否听陆
const daSanTing = result21.tingAnalysis.find(t => t.discard === "叁");
if (daSanTing) {
  console.log(`\n✅ 打叁在听牌列表中!`);
  const tingLu = daSanTing.tingTiles.find(t => t.tile === "陆");
  console.log(`  听陆: ${tingLu ? `是 (${tingLu.maxHuxi}胡)` : "否"}`);
  for (const tt of daSanTing.tingTiles) {
    console.log(`  听${tt.tile}: ${tt.maxHuxi}胡`);
  }
} else {
  console.log(`\n❌ 打叁不在听牌列表中`);
}

// 测试2：20张拆组方案（打叁后）
console.log("\n\n=== 测试2：打叁后20张拆组方案 ===");
const tiles20 = ["十", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"];
const result20 = analyzeHand(tiles20);
console.log(`找到 ${result20.plans.length} 个方案`);
for (let i = 0; i < Math.min(3, result20.plans.length); i++) {
  const p = result20.plans[i];
  console.log(`\n--- 方案${i + 1} (分数:${p.score}, 散牌:${p.remainingCount}张, 胡息:${p.totalHuxi}) ---`);
  for (const g of p.groups) console.log(`  ${g.description}`);
  if (p.pair) console.log(`  将牌: ${p.pair.join("")}`);
  if (p.remainingCount > 0) console.log(`  散牌: ${p.remainingTiles.join("、")}`);
}
