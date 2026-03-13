import { handFromTiles, handToTiles, handTotal, canHu, backtrackSearch, cloneHand, analyzeTing } from "./server/zipai-engine.ts";

// 用户实例：打叁后20张
const tiles20 = ["十", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "柒"];
// 注意：打叁后是19张？让我重新数
// 原始21张：十、叁、六、捌、五、七、贰、陆、八、四、九、鬼、二、壹、陆、八、三、玖、一、叁、柒
// 打叁后20张：十、六、捌、五、七、贰、陆、八、四、九、鬼、二、壹、陆、八、三、玖、一、叁、柒
// 等等，有两个叁，打掉一个还有一个叁
// 重新列：十、六、捌、五、七、贰、陆、八、四、九、鬼、二、壹、陆、八、三、玖、一、叁、柒 = 20张 ✓

console.log("=== 测试打叁后20张 ===");
console.log("手牌:", tiles20.join(" "));
console.log("总数:", tiles20.length);

const hand = handFromTiles(tiles20);
console.log("\n--- canHu测试 (minHuxi=0) ---");
const start1 = Date.now();
const r1 = canHu(hand, 0, 0);
const t1 = Date.now() - start1;
console.log(`耗时: ${t1}ms, ok=${r1.ok}, maxHuxi=${r1.maxHuxi}`);
if (r1.bestGroups) {
  console.log("牌组:");
  for (const g of r1.bestGroups) {
    console.log(`  ${g.tiles.join("")} ${g.type} ${g.huxi}胡 ${g.ghostAs ? `(鬼→${g.ghostAs})` : ""}`);
  }
}
if (r1.bestPair) {
  console.log("将牌:", r1.bestPair.join(""));
}

console.log("\n--- canHu测试 (minHuxi=10) ---");
const start2 = Date.now();
const r2 = canHu(hand, 0, 10);
const t2 = Date.now() - start2;
console.log(`耗时: ${t2}ms, ok=${r2.ok}, maxHuxi=${r2.maxHuxi}`);

// 检查是否找到了"六七八+四五鬼+陆陆将"的方案
console.log("\n--- 检查所有0散牌方案 ---");
const start3 = Date.now();
const results = [];
const bestRef = { bestRemaining: 20, bestHuxi: 0 };
backtrackSearch(hand, [], null, results, 2000, 0, bestRef);
const t3 = Date.now() - start3;
console.log(`搜索耗时: ${t3}ms, 总方案数: ${results.length}`);

const perfect = results.filter(r => r.remainingCount === 0 && r.pair);
console.log(`完美方案数(0散牌+有将): ${perfect.length}`);

// 找包含六七八的方案
const has678 = perfect.filter(r => 
  r.groups.some(g => {
    const sorted = [...g.tiles].sort().join("");
    return sorted.includes("六") && sorted.includes("七") && sorted.includes("八");
  })
);
console.log(`包含六七八的完美方案: ${has678.length}`);

for (const p of has678.slice(0, 5)) {
  console.log(`\n  方案(${p.totalHuxi}胡):`);
  for (const g of p.groups) {
    console.log(`    ${g.tiles.join("")} ${g.type} ${g.huxi}胡 ${g.ghostAs ? `(鬼→${g.ghostAs})` : ""}`);
  }
  console.log(`    将: ${p.pair?.join("")}`);
}

// 听牌分析
console.log("\n--- 听牌分析(21张打1张) ---");
const tiles21 = ["十", "叁", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"];
const start4 = Date.now();
const ting = analyzeTing(tiles21, 0, 10);
const t4 = Date.now() - start4;
console.log(`听牌分析耗时: ${t4}ms`);

const discardSan = ting.find(r => r.discard === "叁");
if (discardSan) {
  console.log(`打叁: 听${discardSan.tingWidth}种${discardSan.tingCount}张`);
  for (const t of discardSan.tingTiles) {
    console.log(`  听${t.tile} ${t.maxHuxi}胡`);
    if (t.bestGroups) {
      for (const g of t.bestGroups) {
        console.log(`    ${g.tiles.join("")} ${g.type} ${g.huxi}胡`);
      }
    }
    if (t.bestPair) console.log(`    将: ${t.bestPair.join("")}`);
  }
}
