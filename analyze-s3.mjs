// 分析截图3
import { analyzeHand, analyzeTing, canHu, handFromTiles, backtrackSearch, canCompleteAll } from "./server/zipai-engine.ts";

// 明牌区：
// - 八九十顺子 = 0胡
// - 壹壹壹碰(或偎) = 大字碰3胡 或 大字偎6胡
// - 四四四四提 = 小字提9胡
// 界面显示9胡 → 可能是：提四=9胡 + 八九十=0胡 + 壹壹壹碰=0胡?
// 不对，壹壹壹碰=3胡，那总共12胡？但界面显示9胡
// 可能壹壹一是混碰=1胡? 9+0+0=9? 不对
// 或者：提四=9胡，其他都是0胡 → 总共9胡
// 最可能：提四=9胡，壹一壹是吃的(不是碰)? 不对壹一壹不能吃
// 
// 重新理解：界面显示9胡，提四=9胡最合理
// 壹壹壹可能不是碰而是坎（暗牌），但显示出来了说明是碰/偎
// 碰壹=大字碰=3胡 → 9+3=12胡? 但界面显示9胡
// 
// 可能壹一壹是混碰 = 小字碰1胡? 9+1-1=9? 不对
// 或者明牌区不是壹壹壹，而是壹一壹（混碰）= 1胡?
// 9胡 = 提四(9) + 混碰壹一壹(0) + 八九十(0) = 9胡
// 混碰=0胡，这说得通！

// 明牌胡息 = 9胡（提四9胡 + 其他0胡）
const exposedHuxi = 9;

// 手牌识别（12张，摸牌后需打1张）
// 从截图仔细看：
// 上排突出：五、陆
// 中排：叁、伍、六、二、鬼
// 下排：贰、伍、六、二、七、肆、拾
// 右下角：捌（刚摸的？）
// 底部明牌区单独的八 → 这是明牌不是手牌
// 
// 但这样是 2+5+7+1 = 15张，太多了
// 庄家21张 - 10张明牌(八九十3+壹壹壹3+四四四四4) = 11张
// 摸牌后 = 12张
// 
// 可能上排突出的五陆是刚摸的牌被提起来了
// 或者有些牌我重复识别了
// 
// 让我尝试不同的手牌组合来分析

// 方案1：假设手牌12张
// 上排突出可能是选中的牌，不是额外的
// 手牌：叁、五、伍、伍、六、六、陆、二、二、七、鬼、贰
// 刚摸的：拾 或 捌
// 
// 但界面右下角有"捌"，可能是刚摸的牌

// 尝试：手牌 = 叁、五、伍、伍、六、六、陆、二、二、七、鬼、贰、拾、捌
// 这是14张...

// 让我重新看：也许明牌区有更多牌
// 左侧：十、九、八 = 吃的八九十
// 中间上：壹、四 / 一、四 / 壹、四 / 空、四
// 这看起来像两列：
// 左列：壹、一、壹 = 3张
// 右列：四、四、四、四 = 4张
// 共7张 + 八九十3张 = 10张明牌
// 
// 底部单独的八 → 可能是第二个吃的八? 或者是明牌区的一部分
// 如果八也是明牌，那明牌=11张，手牌=21-11=10张，摸牌后11张

// 让我试两种方案

console.log("=== 方案A: 手牌12张（摸牌后）===");
// 五、陆是突出的（选中状态），属于手牌的一部分
// 手牌：叁、五、伍、伍、六、六、陆、二、二、七、鬼、贰
// 不对，这只有12张，但还有拾和捌
// 
// 重新：可能手牌就是这些：
// 中排+下排 = 叁、伍、六、二、鬼、贰、伍、六、二、七、肆、拾
// = 12张
// 上排突出的五、陆是"选中准备打出"的牌
// 右下角捌是刚摸的

// 最终手牌13张（含刚摸的捌）：
const handA = ["叁", "五", "伍", "伍", "六", "六", "陆", "二", "二", "七", "鬼", "贰", "拾"];
// 加上捌 = 14张? 不对

// 算了，让我按最可能的来：
// 庄家21张，明牌10张（八九十+壹壹壹+四四四四），手牌11张
// 摸牌后12张，需要打1张
// 
// 从截图看到的所有手牌字符：
// 五、陆、叁、伍、六、二、鬼、贰、伍、六、二、七、肆、拾、捌
// = 15张，太多了
// 
// 可能肆是明牌区的（四四四四提中的一张显示为肆？不对四四四四都是小字四）
// 
// 或者：上排五陆不是手牌，是什么提示？
// 
// 最简单的方法：直接用能看到的所有手牌来分析

console.log("\n=== 尝试：所有可见手牌 ===");
const allVisible = ["五", "陆", "叁", "伍", "六", "二", "鬼", "贰", "伍", "六", "二", "七", "肆", "拾", "捌"];
console.log(`可见手牌${allVisible.length}张:`, allVisible.join(" "));

// 先用12张试（去掉上排突出的五陆和右下角捌，假设五陆是选中状态的重复显示）
const hand12 = ["叁", "伍", "六", "二", "鬼", "贰", "伍", "六", "二", "七", "肆", "拾"];
console.log(`\n手牌12张:`, hand12.join(" "));

// 分析
const result12 = analyzeHand(hand12, { exposedHuxi: 9, minHuxi: 10 });
console.log(`\n最优方案数: ${result12.plans.length}`);
if (result12.plans.length > 0) {
  const best = result12.plans[0];
  console.log(`最优: 散牌${best.remainingCount}张, 胡息${best.totalHuxi}, 将:${best.pair?.join("")||"无"}`);
  for (const g of best.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
}

// 听牌分析
if (hand12.length % 3 === 0) {
  console.log("\n=== 听牌分析（12张，打1剩11张）===");
  const ting = analyzeTing(hand12, 9, 10);
  // 按听牌数排序
  const sorted = ting.sort((a, b) => b.tingCount - a.tingCount);
  for (const t of sorted.slice(0, 5)) {
    console.log(`打${t.discard}: 听${t.tingWidth}种${t.tingCount}张`);
    for (const tt of t.tingTiles) {
      console.log(`  听${tt.tile}(${tt.type}): ${tt.maxHuxi}胡`);
    }
  }
}

// 也试试13张（加上捌）
console.log("\n\n=== 手牌13张（加上捌）===");
const hand13 = [...hand12, "捌"];
console.log(`手牌:`, hand13.join(" "));
const result13 = analyzeHand(hand13, { exposedHuxi: 9, minHuxi: 10 });
console.log(`最优方案数: ${result13.plans.length}`);
if (result13.plans.length > 0) {
  const best = result13.plans[0];
  console.log(`最优: 散牌${best.remainingCount}张, 胡息${best.totalHuxi}, 将:${best.pair?.join("")||"无"}`);
  for (const g of best.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
}

// 也试试14张
console.log("\n\n=== 手牌14张（加上五陆）===");
const hand14 = ["五", "陆", ...hand12];
console.log(`手牌:`, hand14.join(" "));
const result14 = analyzeHand(hand14, { exposedHuxi: 9, minHuxi: 10 });
console.log(`最优方案数: ${result14.plans.length}`);
if (result14.plans.length > 0) {
  const best = result14.plans[0];
  console.log(`最优: 散牌${best.remainingCount}张, 胡息${best.totalHuxi}, 将:${best.pair?.join("")||"无"}`);
  for (const g of best.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
}

// 15张全部
console.log("\n\n=== 手牌15张（全部可见）===");
console.log(`手牌:`, allVisible.join(" "));
const result15 = analyzeHand(allVisible, { exposedHuxi: 9, minHuxi: 10 });
console.log(`最优方案数: ${result15.plans.length}`);
if (result15.plans.length > 0) {
  const best = result15.plans[0];
  console.log(`最优: 散牌${best.remainingCount}张, 胡息${best.totalHuxi}, 将:${best.pair?.join("")||"无"}`);
  for (const g of best.groups) {
    console.log(`  ${g.tiles.join("")} (${g.type}) = ${g.huxi}胡${g.ghostAs ? ` 鬼→${g.ghostAs}` : ""}`);
  }
}

// 听牌分析 15张
if (allVisible.length % 3 === 0) {
  console.log("\n=== 听牌分析（15张）===");
  const ting = analyzeTing(allVisible, 9, 10);
  const sorted = ting.sort((a, b) => b.tingCount - a.tingCount);
  for (const t of sorted.slice(0, 8)) {
    console.log(`打${t.discard}: 听${t.tingWidth}种${t.tingCount}张`);
    for (const tt of t.tingTiles) {
      console.log(`  听${tt.tile}(${tt.type}): ${tt.maxHuxi}胡`);
    }
  }
}
