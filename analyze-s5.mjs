// 分析截图5 - 正确处理坎不可拆
import { analyzeHand, analyzeTing } from "./server/zipai-engine.ts";

// 手牌识别（21张，庄家开局）：
// 上排突出4张：叁(红)、十(红)、六、拾(红)
// 中排7张：叁(红)、十(红)、陆、五、玖、四、柒(红)
// 下排10张：叁(红)、十(红)、陆、五、捌、肆、壹、三、八
// 
// 总计：4+7+10 = 21张 ✓

const fullHand = [
  "叁", "十", "六", "拾",           // 上排
  "叁", "十", "陆", "五", "玖", "四", "柒",  // 中排
  "叁", "十", "陆", "五", "捌", "肆", "壹", "三", "八"  // 下排
];

console.log(`全部手牌${fullHand.length}张:`, fullHand.join(" "));

// 统计每张牌的数量
const count = {};
for (const t of fullHand) {
  count[t] = (count[t] || 0) + 1;
}
console.log("\n牌面统计:");
for (const [k, v] of Object.entries(count)) {
  console.log(`  ${k}: ${v}张${v >= 3 ? " ★坎！" : ""}`);
}

// 识别坎牌（3张相同 = 坎，不可拆）
// 叁叁叁 = 大字坎 = 6胡
// 十十十 = 小字坎 = 3胡
// 坎牌胡息 = 6+3 = 9胡
const lockedHuxi = 9; // 叁叁叁(6胡) + 十十十(3胡)
console.log(`\n坎牌: 叁叁叁(6胡) + 十十十(3胡) = ${lockedHuxi}胡`);

// 剩余手牌（去掉坎牌后）
const remaining = [];
const kanUsed = { "叁": 0, "十": 0 };
for (const t of fullHand) {
  if ((t === "叁" && kanUsed["叁"] < 3) || (t === "十" && kanUsed["十"] < 3)) {
    kanUsed[t]++;
    continue; // 跳过坎牌
  }
  remaining.push(t);
}

console.log(`\n剩余手牌${remaining.length}张:`, remaining.join(" "));
// 21 - 6(两个坎) = 15张

// 用引擎分析剩余牌，exposedHuxi=9（坎的胡息当作已有胡息）
const result = analyzeHand(remaining, { exposedHuxi: lockedHuxi, minHuxi: 10 });
console.log(`\n方案数: ${result.plans.length}`);

for (let i = 0; i < Math.min(5, result.plans.length); i++) {
  const p = result.plans[i];
  console.log(`\n--- 方案${i+1}: 散牌${p.remainingCount}张, 手牌胡息${p.totalHuxi}, 总胡息${p.totalHuxi + lockedHuxi}, 将:${p.pair?.join("")||"无"} ---`);
  for (const g of p.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
  if (p.remaining && p.remaining.length > 0) {
    console.log(`  散牌: ${p.remaining.join(" ")}`);
  }
}

// 听牌分析（15张打1剩14张）
console.log("\n\n=== 听牌分析（剩余15张，打1剩14张）===");
const ting = analyzeTing(remaining, lockedHuxi, 10);
const sorted = ting.sort((a, b) => {
  if (b.tingCount !== a.tingCount) return b.tingCount - a.tingCount;
  return b.maxHuxi - a.maxHuxi;
});

console.log(`共${sorted.length}种打法有听牌`);
for (const t of sorted.slice(0, 10)) {
  console.log(`\n打${t.discard}: 听${t.tingWidth}种${t.tingCount}张, 最高${t.maxHuxi}胡`);
  for (const tt of t.tingTiles) {
    console.log(`  听${tt.tile}(${tt.type}): ${tt.maxHuxi}胡`);
  }
}

if (sorted.length === 0) {
  console.log("\n无法一步听牌，分析各打法的散牌情况：");
  const allTiles = [...new Set(remaining)];
  const results2 = [];
  for (const discard of allTiles) {
    const rem = [...remaining];
    const idx = rem.indexOf(discard);
    if (idx >= 0) rem.splice(idx, 1);
    const r = analyzeHand(rem, { exposedHuxi: lockedHuxi, minHuxi: 10 });
    if (r.plans.length > 0) {
      const best = r.plans[0];
      results2.push({ 
        discard, 
        remaining: best.remainingCount, 
        huxi: best.totalHuxi, 
        totalHuxi: best.totalHuxi + lockedHuxi,
        hasPair: !!best.pair 
      });
    }
  }
  results2.sort((a, b) => {
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return b.totalHuxi - a.totalHuxi;
  });
  for (const r of results2) {
    console.log(`  打${r.discard}: 散牌${r.remaining}张, 手牌胡息${r.huxi}, 总胡息${r.totalHuxi}, 有将:${r.hasPair}`);
  }
}
