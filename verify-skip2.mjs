import { handFromTiles, handToTiles, handTotal, canHu, backtrackSearch, cloneHand, analyzeTing } from "./server/zipai-engine.ts";

// 原始21张：十、叁、六、捌、五、七、贰、陆、八、四、九、鬼、二、壹、陆、八、三、玖、一、叁、柒
// 打1个叁后20张：
const tiles20 = ["十", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"];

console.log("=== 测试打叁后20张 ===");
console.log("手牌:", tiles20.join(" "));
console.log("总数:", tiles20.length);

const hand = handFromTiles(tiles20);
console.log("hand数组:", hand.join(","));
console.log("handTotal:", handTotal(hand));

// 期望的拆法：
// 一二三(3胡) + 壹贰叁(6胡) + 六七八(0胡) + 八九十(0胡) + 柒捌玖(0胡) + 四五鬼(→三/六,0胡) + 将:陆陆
// 验证：一二三=一二三, 壹贰叁=壹贰叁, 六七八=六七八, 八九十=八九十, 柒捌玖=柒捌玖, 四五鬼=四五三/四五六
// 牌数：3+3+3+3+3+3+2=20 ✓

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

console.log("\n--- 所有完美方案 ---");
const start3 = Date.now();
const results = [];
const bestRef = { bestRemaining: 20, bestHuxi: 0 };
backtrackSearch(hand, [], null, results, 5000, 0, bestRef);
const t3 = Date.now() - start3;
console.log(`搜索耗时: ${t3}ms, 总方案数: ${results.length}`);

const perfect = results.filter(r => r.remainingCount === 0 && r.pair);
console.log(`完美方案数(0散牌+有将): ${perfect.length}`);

// 按胡息排序
perfect.sort((a, b) => b.totalHuxi - a.totalHuxi);

for (const p of perfect.slice(0, 10)) {
  console.log(`\n  方案(${p.totalHuxi}胡):`);
  for (const g of p.groups) {
    console.log(`    ${g.tiles.join("")} ${g.type} ${g.huxi}胡 ${g.ghostAs ? `(鬼→${g.ghostAs})` : ""}`);
  }
  console.log(`    将: ${p.pair?.join("")}`);
}

// 找包含六七八的方案
const has678 = perfect.filter(r => 
  r.groups.some(g => {
    const ts = g.tiles.map(t => t).sort().join("");
    return ts === "七八六" || ts === "六七八";
  })
);
console.log(`\n包含六七八的完美方案: ${has678.length}`);
for (const p of has678.slice(0, 5)) {
  console.log(`\n  方案(${p.totalHuxi}胡):`);
  for (const g of p.groups) {
    console.log(`    ${g.tiles.join("")} ${g.type} ${g.huxi}胡 ${g.ghostAs ? `(鬼→${g.ghostAs})` : ""}`);
  }
  console.log(`    将: ${p.pair?.join("")}`);
}

// 听牌分析
console.log("\n\n--- 听牌分析(21张打1张) ---");
const tiles21 = ["十", "叁", "六", "捌", "五", "七", "贰", "陆", "八", "四", "九", "鬼", "二", "壹", "陆", "八", "三", "玖", "一", "叁", "柒"];
console.log("21张:", tiles21.length);
const start4 = Date.now();
const ting = analyzeTing(tiles21, 0, 10);
const t4 = Date.now() - start4;
console.log(`听牌分析耗时: ${t4}ms, 打法数: ${ting.length}`);

// 按听牌宽度排序
ting.sort((a, b) => b.tingCount - a.tingCount);
for (const t of ting.slice(0, 5)) {
  console.log(`\n打${t.discard}: 听${t.tingWidth}种${t.tingCount}张, 最高${t.maxHuxi}胡`);
  for (const tt of t.tingTiles) {
    console.log(`  听${tt.tile} ${tt.maxHuxi}胡 ${tt.bestPair ? `将:${tt.bestPair.join("")}` : ""}`);
  }
}
