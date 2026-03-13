import { analyzeHand } from "./server/zipai-engine.ts";

/**
 * 听牌分析：打1张后，来哪些牌就能胡？
 * 
 * 胡牌条件：所有牌都组成3张一组（坎/顺/碰），胡息≥10
 * 鬼牌可以变任何牌
 * 
 * 手牌14张: 五、陆、叁、伍、六、二、鬼、贰、伍、六、二、七、肆、拾
 * 明牌胡息: 9胡
 */

const SMALL_TILES = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const BIG_TILES = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"];
const ALL_TILES = [...SMALL_TILES, ...BIG_TILES];

const handTiles = ["五", "陆", "叁", "伍", "六", "二", "鬼", "贰", "伍", "六", "二", "七", "肆", "拾"];
const existingHuxi = 9;
const HUXI_THRESHOLD = 10;

console.log("=== 当前手牌 ===");
console.log(handTiles.join("、"));
console.log(`手牌数: ${handTiles.length}张 | 明牌胡息: ${existingHuxi}胡\n`);

/**
 * 检查一组牌是否能完全组成牌组（全部3张一组），且胡息达标
 * 鬼牌会被穷举替代
 */
function canHu(tiles, minHuxi) {
  const result = analyzeHand(tiles);
  // 检查最优方案是否散牌为0（全部组好）且胡息够
  for (const plan of result.plans) {
    if (plan.remainingCount === 0 && (plan.totalHuxi + existingHuxi) >= minHuxi) {
      return { canHu: true, huxi: plan.totalHuxi, groups: plan.groups.map(g => g.description).join(" + ") };
    }
  }
  return { canHu: false };
}

// 对每种出牌，计算打出后能听几张牌
const uniqueTiles = [...new Set(handTiles)].filter(t => t !== "鬼");
const results = [];

for (const discard of uniqueTiles) {
  const remaining = [...handTiles];
  const idx = remaining.indexOf(discard);
  if (idx >= 0) remaining.splice(idx, 1);
  
  // 剩13张，现在检查：来哪张牌能胡？
  // 模拟摸到每种牌（20种），检查14张能否全部组好且胡息够
  const tingTiles = [];
  
  for (const incoming of ALL_TILES) {
    const testHand = [...remaining, incoming];
    const huResult = canHu(testHand, HUXI_THRESHOLD);
    if (huResult.canHu) {
      tingTiles.push({ tile: incoming, huxi: huResult.huxi, groups: huResult.groups });
    }
  }
  
  results.push({
    discard,
    tingCount: tingTiles.length,
    tingTiles,
    remaining: remaining.join("、"),
  });
}

// 按听牌数排序
results.sort((a, b) => b.tingCount - a.tingCount);

console.log("=== 听牌分析（按听牌面宽度排序）===\n");
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const rank = i === 0 ? "★最优★" : `第${i+1}`;
  console.log(`${rank} 打 【${r.discard}】 → 听 ${r.tingCount} 张牌`);
  if (r.tingTiles.length > 0) {
    console.log(`  听: ${r.tingTiles.map(t => t.tile).join("、")}`);
    // 显示前3个听牌的胡法
    for (const t of r.tingTiles.slice(0, 3)) {
      console.log(`    来${t.tile}: 手牌${t.huxi}胡+明牌${existingHuxi}胡=${t.huxi+existingHuxi}胡 | ${t.groups}`);
    }
    if (r.tingTiles.length > 3) console.log(`    ...还有${r.tingTiles.length - 3}种`);
  } else {
    console.log(`  未听牌`);
  }
  console.log();
}

console.log("=== 最终推荐 ===");
if (results.length > 0 && results[0].tingCount > 0) {
  const best = results[0];
  console.log(`打 【${best.discard}】 → 听 ${best.tingCount} 张: ${best.tingTiles.map(t => t.tile).join("、")}`);
} else {
  console.log("当前无法一步听牌");
}
