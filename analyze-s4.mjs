// 分析截图4
import { analyzeHand, analyzeTing } from "./server/zipai-engine.ts";

// 基本信息：
// - 庄家（左下角有"庄"标记）
// - 对手分数：-29，我的分数：29
// - 剩余底牌：40（刚开局）
// - 当前胡息：0胡
// - 无明牌区（刚开局）
// - "滑过此线出牌" → 刚摸牌，需打1张
// - 2连胜

// 手牌识别（庄家21张）：
// 上排（突出4张）：拾(红)、九、伍、捌
// 中排（8张）：柒(红)、玖、五、八、十(红)、六、四、三
// 下排（9张）：贰(红)、玖、五、八、拾(红)、陆、肆、叁、鬼
// 
// 总计：4+8+9 = 21张 ✓ 庄家开局21张

const hand = [
  "拾", "九", "伍", "捌",           // 上排突出
  "柒", "玖", "五", "八", "十", "六", "四", "三",  // 中排
  "贰", "玖", "五", "八", "拾", "陆", "肆", "叁", "鬼"  // 下排
];

console.log(`手牌${hand.length}张:`, hand.join(" "));

// 开局无明牌，exposedHuxi=0
const result = analyzeHand(hand, { exposedHuxi: 0, minHuxi: 10 });
console.log(`\n方案数: ${result.plans.length}`);

// 显示前3个最优方案
for (let i = 0; i < Math.min(3, result.plans.length); i++) {
  const p = result.plans[i];
  console.log(`\n--- 方案${i+1}: 散牌${p.remainingCount}张, 胡息${p.totalHuxi}, 将:${p.pair?.join("")||"无"} ---`);
  for (const g of p.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
  if (p.remaining && p.remaining.length > 0) {
    console.log(`  散牌: ${p.remaining.join(" ")}`);
  }
}

// 听牌分析（21张打1剩20张）
console.log("\n\n=== 听牌分析 ===");
const ting = analyzeTing(hand, 0, 10);
const sorted = ting.sort((a, b) => {
  // 先按听牌数降序
  if (b.tingCount !== a.tingCount) return b.tingCount - a.tingCount;
  // 再按最高胡息降序
  return b.maxHuxi - a.maxHuxi;
});

console.log(`共${sorted.length}种打法有听牌`);
for (const t of sorted.slice(0, 10)) {
  console.log(`\n打${t.discard}: 听${t.tingWidth}种${t.tingCount}张, 最高${t.maxHuxi}胡`);
  for (const tt of t.tingTiles) {
    console.log(`  听${tt.tile}(${tt.type}): ${tt.maxHuxi}胡`);
  }
}

// 如果没有听牌，分析哪种打法散牌最少
if (sorted.length === 0) {
  console.log("\n当前无法一步听牌，分析各打法的散牌情况：");
  const allTiles = [...new Set(hand)];
  const results = [];
  for (const discard of allTiles) {
    const remaining = [...hand];
    const idx = remaining.indexOf(discard);
    if (idx >= 0) remaining.splice(idx, 1);
    const r = analyzeHand(remaining, { exposedHuxi: 0, minHuxi: 10 });
    if (r.plans.length > 0) {
      const best = r.plans[0];
      results.push({ discard, remaining: best.remainingCount, huxi: best.totalHuxi, hasPair: !!best.pair });
    }
  }
  results.sort((a, b) => {
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return b.huxi - a.huxi;
  });
  for (const r of results) {
    console.log(`  打${r.discard}: 散牌${r.remaining}张, 胡息${r.huxi}, 有将:${r.hasPair}`);
  }
}
