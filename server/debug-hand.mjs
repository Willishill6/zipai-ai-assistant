// 测试LLM识别的手牌 vs 正确手牌
import { analyzeHand } from './zipai-engine.ts';

// LLM识别的21张（把七识别为柒）
const llmTiles = ['伍','伍','伍','伍','贰','贰','陆','陆','柒','柒','玖','捌','拾','三','四','五','一','壹','鬼','十','肆'];
console.log('=== LLM识别的手牌(21张) ===');
console.log(llmTiles.join(', '));
const llmResult = analyzeHand(llmTiles, { exposedHuxi: 0, minHuxi: 10, knownTiles: [] });
console.log('锁定:', llmResult.lockedKan.map(k => `${k.tiles.join('')}=${k.huxi}胡`).join(', '));
console.log('坎胡息:', llmResult.kanHuxi);
console.log('最优方案胡息:', llmResult.plans[0]?.totalHuxi);
console.log('最优方案散牌:', llmResult.plans[0]?.remainingCount);
console.log('最优方案组:', llmResult.plans[0]?.groups.map(g => `${g.tiles.join('')}(${g.type}=${g.huxi}胡)`).join(' + '));
console.log('');

// 正确的21张（七不是柒）
const correctTiles = ['伍','伍','伍','伍','贰','贰','陆','陆','七','七','玖','捌','拾','三','四','五','一','壹','鬼','十','肆'];
console.log('=== 正确的手牌(21张) ===');
console.log(correctTiles.join(', '));
const correctResult = analyzeHand(correctTiles, { exposedHuxi: 0, minHuxi: 10, knownTiles: [] });
console.log('锁定:', correctResult.lockedKan.map(k => `${k.tiles.join('')}=${k.huxi}胡`).join(', '));
console.log('坎胡息:', correctResult.kanHuxi);
console.log('最优方案胡息:', correctResult.plans[0]?.totalHuxi);
console.log('最优方案散牌:', correctResult.plans[0]?.remainingCount);
console.log('最优方案组:', correctResult.plans[0]?.groups.map(g => `${g.tiles.join('')}(${g.type}=${g.huxi}胡)`).join(' + '));

// 看看听牌分析
if (correctResult.tingAnalysis?.length > 0) {
  const best = correctResult.tingAnalysis[0];
  console.log(`\n推荐打: ${best.discard}, 听${best.tingWidth}种${best.tingCount}张`);
}
if (llmResult.tingAnalysis?.length > 0) {
  const best = llmResult.tingAnalysis[0];
  console.log(`LLM版推荐打: ${best.discard}, 听${best.tingWidth}种${best.tingCount}张`);
}
