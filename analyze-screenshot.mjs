// 分析用户截图的手牌
// 从截图识别的手牌（闲家20张，0胡，剩余底牌40张，刚开局）

import { analyzeHand } from './server/zipai-engine.ts';

// 从截图仔细识别的手牌（3行排列，共20张）:
// 第1行: 壹 十 八
// 第2行: 壹 七 捌 肆 肆 柒 五 三    九
// 第3行: 壹 二 捌 肆 柒 伍 叁 拾 一
// 
// 按列对齐分析:
// 壹壹壹 = 3张壹
// 十七二 = 十、七、二 (红色牌列)
// 八捌捌 = 八、捌、捌 (但第1行的八是小字)
// 
// 仔细看第2行第3行的对齐关系:
// 第2行: 壹 七 捌 肆 肆 柒 五 三 (空) 九
// 第3行: 壹 二 捌 肆 (空) 柒 伍 叁 拾 一
//
// 所以手牌是:
// 壹×3, 十, 七, 二, 八, 捌×2, 肆×3, 柒×2, 五, 伍, 三, 叁, 九, 一
// = 3+1+1+1+1+2+3+2+1+1+1+1+1+1 = 21张? 还是多了
//
// 闲家20张。再看一次:
// 第1行只有3张: 壹 十 八
// 第2行: 壹 七 捌 肆 肆 柒 五 三 九 = 9张
// 第3行: 壹 二 捌 肆 柒 伍 叁 拾 一 = 9张
// 3+9+9=21 多了1张
//
// 可能第2行的"肆肆"其实只有1张肆，或者某处识别错误
// 但从图片看第2行确实有两张肆紧挨着
// 
// 也可能这是庄家21张？但截图显示对手有"庄"标记
// 
// 等等，再看：对手头像旁有"庄"字，说明对手是庄家
// 但如果我是闲家，应该20张。可能是刚摸了一张还没打？
// 庄家先打牌，如果庄家还没打，闲家就是20张
// 但如果庄家已经打了一张，闲家摸了一张，就是21张
//
// 从截图看0胡、剩余40张，可能是庄家刚打了牌我摸了一张
// 81-40=41张已发出, 21+20=41, 所以我21张对手20张
// 说明我摸了一张需要打出一张
//
// 手牌21张:
const handTiles = [
  "壹", "壹", "壹",  // 3张壹
  "十",               // 1张十(红)
  "七",               // 1张七(红)  
  "二",               // 1张二(红)
  "八",               // 1张八
  "捌", "捌",         // 2张捌
  "肆", "肆", "肆",   // 3张肆 (第2行2张+第3行1张)
  "柒", "柒",         // 2张柒(红)
  "五",               // 1张五
  "伍",               // 1张伍
  "三",               // 1张三
  "叁",               // 1张叁
  "九",               // 1张九
  "一",               // 1张一
  // 缺拾? 第3行有拾
];

// 等等，第3行有拾，我漏了。那就是22张了，肯定有识别错误
// 让我重新来，更保守地识别

// 重新识别 - 按照图片中牌的实际位置:
// 图片底部有3行手牌
// 
// 最上面一行(短): 壹 十 八  (3张)
// 中间一行: 壹 七 捌 肆 柒 五 三    九 (8张)  
// 最下面一行: 壹 二 捌 肆 柒 伍 叁 拾 一 (9张)
//
// 3+8+9 = 20张! 
// 中间行的"肆肆"可能只是1张肆，不是2张

const handTiles2 = [
  "壹", "壹", "壹",  // 3张壹
  "十",               // 十(红)
  "七",               // 七(红)
  "二",               // 二(红)
  "八",               // 八
  "捌", "捌",         // 2张捌
  "肆", "肆",         // 2张肆
  "柒", "柒",         // 2张柒(红)
  "五",               // 五
  "伍",               // 伍
  "三",               // 三
  "叁",               // 叁
  "拾",               // 拾(红)
  "九",               // 九
  "一",               // 一
];

// 20张 = 闲家
// 但81-40=41, 闲家20+庄家21=41 ✓

console.log("=== 手牌识别 ===");
console.log(`手牌(${handTiles2.length}张): ${handTiles2.join("、")}`);
console.log();

// 调用引擎分析
const result = analyzeHand(handTiles2, { exposedHuxi: 0, minHuxi: 10 });

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

// 听牌分析
if (result.tingAnalysis && result.tingAnalysis.length > 0) {
  console.log();
  console.log("=== 听牌分析 ===");
  for (const ting of result.tingAnalysis.slice(0, 10)) {
    console.log(`打${ting.discard} → 听${ting.tingTiles.map(t => t.tile).join("、")} (${ting.tingWidth}种${ting.tingCount}张, 最高${ting.maxHuxi}胡)`);
  }
} else {
  console.log();
  console.log("=== 听牌分析 ===");
  console.log("当前无法一步听牌（需要多步组牌）");
}

// 散牌进张分析
const bestPlan = result.plans[0];
if (bestPlan && bestPlan.looseAnalysis.length > 0) {
  console.log();
  console.log("=== 散牌进张分析 ===");
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
