/**
 * 桂林飞飞字牌计算引擎 V9.0
 *
 * 核心改进：回溯搜索算法
 * 1. 把所有牌当整体，递归穷举每种3张组合
 * 2. 鬼牌在每次尝试组合时动态决定充当哪张
 * 3. 优先找散牌=0的完美拆法（N组×3 + 1对将 = 胡牌）
 * 4. 胡牌条件：所有牌 = M组×3张 + 1对将(2张)，且胡息≥10
 *
 * 规则：
 * - 大小字同数字可混组 = 组合牌 = 0胡息
 * - 纯同类型坎：小字3胡，大字6胡
 * - 特殊顺子：一二三=3胡，壹贰叁=6胡，二七十=3胡，贰柒拾=6胡
 * - 鬼牌替代后只有形成纯同类型有胡息牌型才算胡息
 */

// ===== 牌面定义 =====
const SMALL_TILES = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"] as const;
const BIG_TILES = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"] as const;
const GHOST_TILE = "鬼";

type TileType = "big" | "small" | "ghost";

function parseTile(name: string): { value: number; type: TileType } | null {
  const si = SMALL_TILES.indexOf(name as any);
  if (si >= 0) return { value: si + 1, type: "small" };
  const bi = BIG_TILES.indexOf(name as any);
  if (bi >= 0) return { value: bi + 1, type: "big" };
  if (name === GHOST_TILE || name === "飞飞") return { value: 0, type: "ghost" };
  return null;
}

function tileName(value: number, type: "big" | "small"): string {
  if (type === "small") return SMALL_TILES[value - 1];
  return BIG_TILES[value - 1];
}

// ===== 手牌数组 =====
// index 0-9 = 小字一~十, 10-19 = 大字壹~拾, 20 = 鬼牌
type HandArray = number[];

function handFromTiles(tiles: string[]): HandArray {
  const h = new Array(21).fill(0);
  for (const t of tiles) {
    const p = parseTile(t);
    if (!p) continue;
    if (p.type === "ghost") { h[20]++; continue; }
    h[p.type === "small" ? p.value - 1 : p.value + 9]++;
  }
  return h;
}

function handToTiles(h: HandArray): string[] {
  const r: string[] = [];
  for (let i = 0; i < 10; i++) for (let c = 0; c < h[i]; c++) r.push(SMALL_TILES[i]);
  for (let i = 10; i < 20; i++) for (let c = 0; c < h[i]; c++) r.push(BIG_TILES[i - 10]);
  for (let c = 0; c < h[20]; c++) r.push(GHOST_TILE);
  return r;
}

function handTotal(h: HandArray): number {
  return h.reduce((s, v) => s + v, 0);
}

function cloneHand(h: HandArray): HandArray { return [...h]; }

// ===== 牌组定义 =====
type GroupType = "kan" | "shunzi" | "mixed_kan" | "ghost_kan" | "ghost_shunzi" | "ghost_mixed";

interface TileGroup {
  tiles: string[];
  type: GroupType;
  huxi: number;
  description: string;
  ghostAs?: string;
}

// ===== 胡息计算 =====
function calcGroupHuxi(tiles: string[], ghostAs?: string): number {
  const parsed: { value: number; type: "big" | "small" }[] = [];
  for (const t of tiles) {
    if (t === GHOST_TILE || t === "飞飞") {
      if (ghostAs) {
        const gp = parseTile(ghostAs);
        if (gp && gp.type !== "ghost") parsed.push({ value: gp.value, type: gp.type });
      }
      continue;
    }
    const p = parseTile(t);
    if (p && p.type !== "ghost") parsed.push({ value: p.value, type: p.type });
  }
  if (parsed.length !== 3) return 0;

  const allSmall = parsed.every(p => p.type === "small");
  const allBig = parsed.every(p => p.type === "big");
  const vals = parsed.map(p => p.value);

  if (vals[0] === vals[1] && vals[1] === vals[2]) {
    if (allSmall) return 3;
    if (allBig) return 6;
    return 0;
  }

  if (!allSmall && !allBig) return 0;

  const sorted = [...vals].sort((a, b) => a - b);
  if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3) return allBig ? 6 : 3;
  if (sorted[0] === 2 && sorted[1] === 7 && sorted[2] === 10) return allBig ? 6 : 3;

  return 0;
}

// ===== 回溯搜索核心 =====
// 从手牌中找到第一个有牌的位置（保证搜索有序，避免重复）
function firstTileIndex(hand: HandArray): number {
  for (let i = 0; i <= 20; i++) {
    if (hand[i] > 0) return i;
  }
  return -1;
}

function idxToName(i: number): string {
  if (i < 10) return SMALL_TILES[i];
  if (i < 20) return BIG_TILES[i - 10];
  return GHOST_TILE;
}

function idxIsBig(i: number): boolean { return i >= 10 && i < 20; }
function idxValue(i: number): number { return i < 10 ? i + 1 : i - 9; }

interface SearchResult {
  groups: TileGroup[];
  pair: string[] | null; // 将牌(2张)
  totalHuxi: number;
  remainingTiles: string[];
  remainingCount: number;
}

/**
 * 核心回溯搜索：从手牌中穷举所有可能的拆法
 * 策略：每次取第一个有牌的位置，尝试所有包含该牌的3张组合
 * 这样保证不遗漏、不重复
 */
function backtrackSearch(
  hand: HandArray,
  groups: TileGroup[],
  pair: string[] | null,
  results: SearchResult[],
  maxResults: number,
  huxi: number,
  bestRef: { bestRemaining: number; bestHuxi: number },
  skipped: number = 0
): void {
  if (results.length >= maxResults) return;

  const total = handTotal(hand);

  // 剪枝：跳过次数不能超过3张（限制搜索空间）
  // 如果已经找到完美方案，不再探索散牌更多的分支
  if (skipped > 3) return;
  if (bestRef.bestRemaining === 0 && total > 6 && skipped > 1) return;

  // 终止条件：没有牌了
  if (total === 0) {
    if (pair) {
      const result: SearchResult = {
        groups: [...groups],
        pair: [...pair],
        totalHuxi: huxi,
        remainingTiles: [],
        remainingCount: 0,
      };
      results.push(result);
      if (0 < bestRef.bestRemaining || (0 === bestRef.bestRemaining && huxi > bestRef.bestHuxi)) {
        bestRef.bestRemaining = 0;
        bestRef.bestHuxi = huxi;
      }
    }
    return;
  }

  // 剩余2张：可以作为将牌
  if (total === 2 && !pair) {
    const tiles = handToTiles(hand);
    // 将牌必须是对子（2张相同）或者含鬼牌
    if (tiles.length === 2) {
      const p0 = parseTile(tiles[0]);
      const p1 = parseTile(tiles[1]);
      if (p0 && p1) {
        const isGhostPair = p0.type === "ghost" || p1.type === "ghost";
        const isSame = tiles[0] === tiles[1];
        // 同数字大小字也可以做将（如 六陆）
        const isMixPair = p0.type !== "ghost" && p1.type !== "ghost" && p0.value === p1.value;
        if (isSame || isGhostPair || isMixPair) {
          const result: SearchResult = {
            groups: [...groups],
            pair: tiles,
            totalHuxi: huxi,
            remainingTiles: [],
            remainingCount: 0,
          };
          results.push(result);
          if (0 < bestRef.bestRemaining || (0 === bestRef.bestRemaining && huxi > bestRef.bestHuxi)) {
            bestRef.bestRemaining = 0;
            bestRef.bestHuxi = huxi;
          }
          return;
        }
      }
    }
  }

  // 记录当前状态作为非完美方案（有散牌）
  if (total < 3 || (total < 3 && pair)) {
    const rem = handToTiles(hand);
    const result: SearchResult = {
      groups: [...groups],
      pair,
      totalHuxi: huxi,
      remainingTiles: rem,
      remainingCount: rem.length,
    };
    results.push(result);
    if (rem.length < bestRef.bestRemaining || (rem.length === bestRef.bestRemaining && huxi > bestRef.bestHuxi)) {
      bestRef.bestRemaining = rem.length;
      bestRef.bestHuxi = huxi;
    }
    return;
  }

  // 找第一个有牌的位置
  const fi = firstTileIndex(hand);
  if (fi < 0) return;

  const gc = hand[20]; // 鬼牌数量

  // === 尝试将牌（如果还没选将，且这个位置有>=2张）===
  if (!pair) {
    // 纯对子做将
    if (hand[fi] >= 2 && fi < 20) {
      const nh = cloneHand(hand);
      nh[fi] -= 2;
      const nm = idxToName(fi);
      backtrackSearch(nh, groups, [nm, nm], results, maxResults, huxi, bestRef, skipped);
    }
    // 大小字混对做将（如 六陆）
    if (fi < 10 && hand[fi + 10] > 0) {
      const nh = cloneHand(hand);
      nh[fi]--;
      nh[fi + 10]--;
      backtrackSearch(nh, groups, [idxToName(fi), idxToName(fi + 10)], results, maxResults, huxi, bestRef, skipped);
    }
    if (fi >= 10 && fi < 20 && hand[fi - 10] > 0) {
      const nh = cloneHand(hand);
      nh[fi]--;
      nh[fi - 10]--;
      backtrackSearch(nh, groups, [idxToName(fi), idxToName(fi - 10)], results, maxResults, huxi, bestRef, skipped);
    }
    // 鬼+任意牌做将
    if (fi === 20 && gc >= 1) {
      // 鬼和下一个有牌的位置配对
      for (let j = 0; j < 20; j++) {
        if (hand[j] > 0) {
          const nh = cloneHand(hand);
          nh[20]--;
          nh[j]--;
          backtrackSearch(nh, groups, [GHOST_TILE, idxToName(j)], results, maxResults, huxi, bestRef, skipped);
        }
      }
      // 两个鬼做将
      if (gc >= 2) {
        const nh = cloneHand(hand);
        nh[20] -= 2;
        backtrackSearch(nh, groups, [GHOST_TILE, GHOST_TILE], results, maxResults, huxi, bestRef, skipped);
      }
    }
    if (fi < 20 && gc >= 1) {
      const nh = cloneHand(hand);
      nh[fi]--;
      nh[20]--;
      backtrackSearch(nh, groups, [idxToName(fi), GHOST_TILE], results, maxResults, huxi, bestRef, skipped);
    }
  }

  // === 尝试包含fi位置牌的所有3张组合 ===

  // 1. 纯坎（3张相同）
  if (hand[fi] >= 3 && fi < 20) {
    const nh = cloneHand(hand);
    nh[fi] -= 3;
    const nm = idxToName(fi);
    const isBig = idxIsBig(fi);
    const hx = isBig ? 6 : 3;
    const g: TileGroup = { tiles: [nm, nm, nm], type: "kan", huxi: hx, description: `${nm}${nm}${nm} 坎=${hx}胡` };
    backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + hx, bestRef, skipped);
  }

  // 2. 混坎（大小字同数字混组，0胡）
  if (fi < 10) {
    const bi = fi + 10;
    // 2小1大
    if (hand[fi] >= 2 && hand[bi] >= 1) {
      const nh = cloneHand(hand); nh[fi] -= 2; nh[bi] -= 1;
      const sn = idxToName(fi), bn = idxToName(bi);
      const g: TileGroup = { tiles: [sn, sn, bn], type: "mixed_kan", huxi: 0, description: `${sn}${sn}${bn} 组合牌=0胡` };
      backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi, bestRef, skipped);
    }
    // 1小2大
    if (hand[fi] >= 1 && hand[bi] >= 2) {
      const nh = cloneHand(hand); nh[fi] -= 1; nh[bi] -= 2;
      const sn = idxToName(fi), bn = idxToName(bi);
      const g: TileGroup = { tiles: [sn, bn, bn], type: "mixed_kan", huxi: 0, description: `${sn}${bn}${bn} 组合牌=0胡` };
      backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi, bestRef, skipped);
    }
  }
  if (fi >= 10 && fi < 20) {
    const si = fi - 10;
    // 2大1小
    if (hand[fi] >= 2 && hand[si] >= 1) {
      const nh = cloneHand(hand); nh[fi] -= 2; nh[si] -= 1;
      const bn = idxToName(fi), sn = idxToName(si);
      const g: TileGroup = { tiles: [bn, bn, sn], type: "mixed_kan", huxi: 0, description: `${bn}${bn}${sn} 组合牌=0胡` };
      backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi, bestRef, skipped);
    }
    // 1大2小 (fi有1张，si有2张) — 但fi是第一个有牌位置，si<fi，所以si应该=0
    // 不需要处理，因为如果si>0，fi不会是firstTileIndex
  }

  // 3. 纯顺子（同类型连续3张）
  if (fi < 20) {
    const isBig = idxIsBig(fi);
    const off = isBig ? 10 : 0;
    const v = idxValue(fi); // 1-10

    // fi, fi+1, fi+2 连续
    if (v <= 8) {
      const i1 = off + v - 1, i2 = off + v, i3 = off + v + 1;
      if (hand[i1] > 0 && hand[i2] > 0 && hand[i3] > 0) {
        const nh = cloneHand(hand); nh[i1]--; nh[i2]--; nh[i3]--;
        const tp: "big" | "small" = isBig ? "big" : "small";
        const t1 = tileName(v, tp), t2 = tileName(v + 1, tp), t3 = tileName(v + 2, tp);
        const hx = calcGroupHuxi([t1, t2, t3]);
        const g: TileGroup = { tiles: [t1, t2, t3], type: "shunzi", huxi: hx, description: `${t1}${t2}${t3} 顺=${hx}胡` };
        backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + hx, bestRef, skipped);
      }
    }
    // fi, fi+1, fi-1 → fi-1,fi,fi+1 (fi在中间)
    if (v >= 2 && v <= 9) {
      const i0 = off + v - 2, i1 = off + v - 1, i2 = off + v;
      if (hand[i0] > 0 && hand[i1] > 0 && hand[i2] > 0 && i0 !== fi - 1 + off - off) {
        // 只有当fi确实是最小的时候才处理，避免重复
        // 实际上fi是firstTileIndex，所以i0<fi意味着hand[i0]应该=0
        // 所以这个分支不会被触发（如果i0<fi，hand[i0]=0）
      }
    }

    // 二七十特殊顺子（fi参与）
    const i2 = off + 1, i7 = off + 6, i10 = off + 9;
    if (fi === i2 && hand[i2] > 0 && hand[i7] > 0 && hand[i10] > 0) {
      const nh = cloneHand(hand); nh[i2]--; nh[i7]--; nh[i10]--;
      const tp: "big" | "small" = isBig ? "big" : "small";
      const t2 = tileName(2, tp), t7 = tileName(7, tp), t10 = tileName(10, tp);
      const hx = isBig ? 6 : 3;
      const g: TileGroup = { tiles: [t2, t7, t10], type: "shunzi", huxi: hx, description: `${t2}${t7}${t10} 顺=${hx}胡` };
      backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + hx, bestRef, skipped);
    }
  }

  // 4. 鬼牌参与的3张组合
  if (gc > 0) {
    if (fi === 20) {
      // 鬼是第一个有牌位置，说明只剩鬼牌了
      // 鬼+任意2张（但其他牌都没了，只有鬼）
      // 3个鬼做坎？不合规则，跳过
      return;
    }

    // 4a. 鬼+fi位置的2张 → 坎(有胡息)
    if (hand[fi] >= 2 && fi < 20) {
      const nh = cloneHand(hand); nh[fi] -= 2; nh[20]--;
      const nm = idxToName(fi);
      const isBig = idxIsBig(fi);
      const hx = isBig ? 6 : 3;
      const g: TileGroup = { tiles: [nm, nm, GHOST_TILE], type: "ghost_kan", huxi: hx, description: `${nm}${nm}鬼 坎=${hx}胡(鬼→${nm})`, ghostAs: nm };
      backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + hx, bestRef, skipped);
    }

    // 4b. 鬼+fi+大/小字同数字 → 混组(0胡)
    if (fi < 10 && hand[fi + 10] > 0) {
      const nh = cloneHand(hand); nh[fi]--; nh[fi + 10]--; nh[20]--;
      const sn = idxToName(fi), bn = idxToName(fi + 10);
      const g: TileGroup = { tiles: [sn, bn, GHOST_TILE], type: "ghost_mixed", huxi: 0, description: `${sn}${bn}鬼 组合牌=0胡`, ghostAs: sn };
      backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi, bestRef, skipped);
    }
    if (fi >= 10 && fi < 20 && hand[fi - 10] > 0) {
      const nh = cloneHand(hand); nh[fi]--; nh[fi - 10]--; nh[20]--;
      const bn = idxToName(fi), sn = idxToName(fi - 10);
      const g: TileGroup = { tiles: [bn, sn, GHOST_TILE], type: "ghost_mixed", huxi: 0, description: `${bn}${sn}鬼 组合牌=0胡`, ghostAs: bn };
      backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi, bestRef, skipped);
    }

    // 4c. 鬼+fi+另一张组顺子（同类型）
    if (fi < 20) {
      const isBig = idxIsBig(fi);
      const off = isBig ? 10 : 0;
      const v = idxValue(fi);
      const tp: "big" | "small" = isBig ? "big" : "small";

      // fi + fi+1 + 鬼(→fi+2)
      if (v <= 8) {
        const i2 = off + v;
        if (hand[i2] > 0) {
          const nh = cloneHand(hand); nh[fi]--; nh[i2]--; nh[20]--;
          const t1 = tileName(v, tp), t2 = tileName(v + 1, tp), ga = tileName(v + 2, tp);
          const hx = calcGroupHuxi([t1, t2, ga]);
          const g: TileGroup = { tiles: [t1, t2, GHOST_TILE], type: "ghost_shunzi", huxi: hx, description: `${t1}${t2}鬼 顺=${hx}胡(鬼→${ga})`, ghostAs: ga };
          backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + hx, bestRef, skipped);
        }
      }

      // fi + fi+2 + 鬼(→fi+1) 中间缺
      if (v <= 8) {
        const i3 = off + v + 1;
        if (hand[i3] > 0) {
          const nh = cloneHand(hand); nh[fi]--; nh[i3]--; nh[20]--;
          const t1 = tileName(v, tp), ga = tileName(v + 1, tp), t3 = tileName(v + 2, tp);
          const hx = calcGroupHuxi([t1, ga, t3]);
          const g: TileGroup = { tiles: [t1, GHOST_TILE, t3], type: "ghost_shunzi", huxi: hx, description: `${t1}鬼${t3} 顺=${hx}胡(鬼→${ga})`, ghostAs: ga };
          backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + hx, bestRef, skipped);
        }
      }

      // 鬼(→fi-1) + fi + fi+1
      if (v >= 2 && v <= 9) {
        const i2 = off + v;
        if (hand[i2] > 0) {
          const nh = cloneHand(hand); nh[fi]--; nh[i2]--; nh[20]--;
          const ga = tileName(v - 1, tp), t1 = tileName(v, tp), t2 = tileName(v + 1, tp);
          const hx = calcGroupHuxi([ga, t1, t2]);
          const g: TileGroup = { tiles: [GHOST_TILE, t1, t2], type: "ghost_shunzi", huxi: hx, description: `鬼${t1}${t2} 顺=${hx}胡(鬼→${ga})`, ghostAs: ga };
          backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + hx, bestRef, skipped);
        }
      }

      // 二七十 with 鬼
      const i2 = off + 1, i7 = off + 6, i10 = off + 9;
      const n2 = tileName(2, tp), n7 = tileName(7, tp), n10 = tileName(10, tp);
      const shx = isBig ? 6 : 3;

      if (fi === i2) {
        // 有二，鬼补七或十
        if (hand[i7] > 0) {
          const nh = cloneHand(hand); nh[i2]--; nh[i7]--; nh[20]--;
          const g: TileGroup = { tiles: [n2, n7, GHOST_TILE], type: "ghost_shunzi", huxi: shx, description: `${n2}${n7}鬼 顺=${shx}胡(鬼→${n10})`, ghostAs: n10 };
          backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + shx, bestRef, skipped);
        }
        if (hand[i10] > 0) {
          const nh = cloneHand(hand); nh[i2]--; nh[i10]--; nh[20]--;
          const g: TileGroup = { tiles: [n2, n10, GHOST_TILE], type: "ghost_shunzi", huxi: shx, description: `${n2}${n10}鬼 顺=${shx}胡(鬼→${n7})`, ghostAs: n7 };
          backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + shx, bestRef, skipped);
        }
      }
      // fi=七位置，有七+鬼
      if (fi === i7) {
        if (hand[i10] > 0) {
          const nh = cloneHand(hand); nh[i7]--; nh[i10]--; nh[20]--;
          const g: TileGroup = { tiles: [n7, n10, GHOST_TILE], type: "ghost_shunzi", huxi: shx, description: `${n7}${n10}鬼 顺=${shx}胡(鬼→${n2})`, ghostAs: n2 };
          backtrackSearch(nh, [...groups, g], pair, results, maxResults, huxi + shx, bestRef, skipped);
        }
      }
    }
  }

  // 5. 跳过fi位置的1张牌（作为散牌），继续搜索后面的牌
  // 这是关键分支！不跳过的话，会漏掉很多拆法
  // 例如：四五六被优先组合后六没了，就找不到六七八+四五鬼的拆法
  // 跳过四后，六七八可以先组，四再和鬼配对
  if (fi < 20) {
    const nh = cloneHand(hand);
    nh[fi]--;
    // 跳过的牌算散牌，继续搜索
    backtrackSearch(nh, groups, pair, results, maxResults, huxi, bestRef, skipped + 1);
  } else if (fi === 20) {
    // 鬼牌跳过（作为散牌）
    const nh = cloneHand(hand);
    nh[20]--;
    backtrackSearch(nh, groups, pair, results, maxResults, huxi, bestRef, skipped + 1);
  }

  // 记录当前状态作为非完美方案（有散牌）
  const rem = handToTiles(hand);
  if (rem.length > 0) {
    const result: SearchResult = {
      groups: [...groups],
      pair,
      totalHuxi: huxi,
      remainingTiles: rem,
      remainingCount: rem.length,
    };
    results.push(result);
    if (rem.length < bestRef.bestRemaining || (rem.length === bestRef.bestRemaining && huxi > bestRef.bestHuxi)) {
      bestRef.bestRemaining = rem.length;
      bestRef.bestHuxi = huxi;
    }
  }
}

// ===== 判断能否全部组完（用于听牌分析） =====
// 胡牌 = N组×3张 + 1对将(2张)
function canHu(hand: HandArray, exposedHuxi: number, minHuxi: number): { ok: boolean; maxHuxi: number; bestGroups: TileGroup[] | null; bestPair: string[] | null } {
  const total = handTotal(hand);
  // 胡牌时手牌必须是 3N+2 (N组+1将)
  if (total < 2 || total % 3 !== 2) return { ok: false, maxHuxi: 0, bestGroups: null, bestPair: null };

  const results: SearchResult[] = [];
  const bestRef = { bestRemaining: total, bestHuxi: 0 };
  backtrackSearch(hand, [], null, results, 200, 0, bestRef);

  let bestHx = -1;
  let bestGs: TileGroup[] | null = null;
  let bestPr: string[] | null = null;

  for (const r of results) {
    if (r.remainingCount === 0 && r.pair) {
      const totalHx = r.totalHuxi + exposedHuxi;
      if (totalHx >= minHuxi && r.totalHuxi > bestHx) {
        bestHx = r.totalHuxi;
        bestGs = r.groups;
        bestPr = r.pair;
      }
    }
  }

  return bestHx >= 0
    ? { ok: true, maxHuxi: bestHx, bestGroups: bestGs, bestPair: bestPr }
    : { ok: false, maxHuxi: 0, bestGroups: null, bestPair: null };
}

// 判断能否全部组成3张组（无将牌，用于纯3N张的情况）
function canCompleteAll(hand: HandArray): { ok: boolean; maxHuxi: number; bestPlan: TileGroup[] | null } {
  const total = handTotal(hand);
  if (total === 0) return { ok: true, maxHuxi: 0, bestPlan: [] };
  if (total % 3 !== 0) return { ok: false, maxHuxi: 0, bestPlan: null };

  const results: SearchResult[] = [];
  const bestRef = { bestRemaining: total, bestHuxi: 0 };
  // 传入一个假将牌让搜索不再尝试选将
  backtrackSearch(hand, [], ["_", "_"], results, 200, 0, bestRef);

  let bestHx = -1;
  let bestGs: TileGroup[] | null = null;

  for (const r of results) {
    if (r.remainingCount === 0) {
      if (r.totalHuxi > bestHx) { bestHx = r.totalHuxi; bestGs = r.groups; }
    }
  }

  return bestHx >= 0 ? { ok: true, maxHuxi: bestHx, bestPlan: bestGs } : { ok: false, maxHuxi: 0, bestPlan: null };
}

// ===== 听牌分析 =====
interface TingResult {
  discard: string;
  tingTiles: { tile: string; maxHuxi: number; bestGroups: TileGroup[] | null; bestPair: string[] | null }[];
  tingWidth: number;
  tingCount: number;
  maxHuxi: number;
}

function getAllPossibleTiles(): string[] {
  const ts: string[] = [];
  for (const t of SMALL_TILES) ts.push(t);
  for (const t of BIG_TILES) ts.push(t);
  ts.push(GHOST_TILE);
  return ts;
}

/**
 * 听牌分析（支持碰听+自摸听）
 * 
 * 字牌胡牌条件：手牌 = N组×3 + 1将×2 = 3N+2张，且胡息≥10
 * 
 * 听牌方式：
 * 1. 自摸听：打1张后剩3N+1张，摸到X后3N+2张，能胡
 * 2. 碰听：打1张后剩3N+2张，手上有对子YY，别人打Y碰出YYY(+胡息)，
 *    碰后打1张，剩3N+2-2-1=3N-1=3(N-1)+2张，加碰胡息后能胡
 * 3. 直接胡：打1张后剩3N+2张，本身就能胡（天胡/自摸胡）
 */
function analyzeTing(
  handTiles: string[],
  exposedHuxi: number = 0,
  minHuxi: number = 10,
  knownTiles: string[] = [],
  lockedIndices: Set<number> = new Set()
): TingResult[] {
  const results: TingResult[] = [];
  const hand = handFromTiles(handTiles);
  
  // 移除提/坎牌（不可拆，不参与搜索）
  let kanHuxiInTing = 0;
  const lockedArr = Array.from(lockedIndices);
  for (let li = 0; li < lockedArr.length; li++) {
    const idx = lockedArr[li];
    if (hand[idx] >= 4) {
      // 提：4张
      const isBig = idx >= 10;
      kanHuxiInTing += isBig ? 12 : 9;
      hand[idx] -= 4;
    } else if (hand[idx] >= 3) {
      // 坎：3张
      const isBig = idx >= 10;
      kanHuxiInTing += isBig ? 6 : 3;
      hand[idx] -= 3;
    }
  }
  // 提/坎牌胡息已包含在exposedHuxi中，不需要重复加
  
  const knownH = handFromTiles(knownTiles);
  const allKnown = cloneHand(knownH);
  for (let i = 0; i < 21; i++) allKnown[i] += hand[i];
  // 提/坎牌也要计入已知牌
  for (let li = 0; li < lockedArr.length; li++) {
    // 检查原始手牌中该位置是提(4张)还是坎(3张)
    const origHand = handFromTiles(handTiles);
    allKnown[lockedArr[li]] += origHand[lockedArr[li]] >= 4 ? 4 : 3;
  }

  const discarded = new Set<string>();
  for (let i = 0; i < 21; i++) {
    if (hand[i] === 0) continue;
    // 跳过坎牌（已锁定不可打）
    if (lockedIndices.has(i)) continue;
    const isGhost = i === 20;
    const isBig = i >= 10 && i < 20;
    const dName = isGhost ? GHOST_TILE : tileName(isBig ? i - 9 : i + 1, isBig ? "big" : "small");
    if (discarded.has(dName)) continue;
    discarded.add(dName);

    const after = cloneHand(hand);
    after[i]--;
    const afterTotal = handTotal(after);

    const tingTiles: TingResult["tingTiles"] = [];
    const tingTileSet = new Set<string>();

    // === 情况1：打后剩3N+2张，直接能胡 ===
    if (afterTotal % 3 === 2) {
      const res = canHu(after, exposedHuxi, minHuxi);
      if (res.ok) {
        // 打这张直接胡了（天胡/自摸胡），用特殊标记
        tingTiles.push({ tile: "自摸", maxHuxi: res.maxHuxi, bestGroups: res.bestGroups, bestPair: res.bestPair });
        tingTileSet.add("自摸");
      }
    }

    // === 情况2：打后剩3N+1张，来1张变3N+2张能胡（自摸听） ===
    if (afterTotal % 3 === 1) {
      for (const incoming of getAllPossibleTiles()) {
        const ip = parseTile(incoming);
        if (!ip) continue;
        const maxC = incoming === GHOST_TILE ? 1 : 4;
        const idx = ip.type === "ghost" ? 20 : (ip.type === "small" ? ip.value - 1 : ip.value + 9);
        const used = allKnown[idx] - (i === idx ? 1 : 0);
        if (maxC - used <= 0) continue;

        const test = cloneHand(after);
        test[idx]++;

        const res = canHu(test, exposedHuxi, minHuxi);
        if (res.ok && !tingTileSet.has(incoming)) {
          tingTiles.push({ tile: incoming, maxHuxi: res.maxHuxi, bestGroups: res.bestGroups, bestPair: res.bestPair });
          tingTileSet.add(incoming);
        }
      }
    }

    // === 情况3：打后剩3N+2张，碰听 ===
    // 手上有对子YY，碰Y后去掉2张Y，碰出YYY(+碰胡息)，再打1张
    // 碰后手牌 = afterTotal-2张，打1张后 = afterTotal-3张
    // afterTotal-3 必须是 3M+2 → afterTotal = 3M+5 → afterTotal%3 = 2
    if (afterTotal % 3 === 2) {
      // 找手上所有对子（可碰的牌）
      for (let j = 0; j < 20; j++) {
        if (after[j] < 2) continue;
        const jBig = j >= 10;
        const jv = jBig ? j - 9 : j + 1;
        const jName = tileName(jv, jBig ? "big" : "small");
        
        // 检查这张牌还有没有剩余可碰
        const maxC = 4;
        const used = allKnown[j] - (i === j ? 1 : 0);
        if (maxC - used <= 0) continue;

        // 碰后：去掉2张j，碰出jjj
        const afterPeng = cloneHand(after);
        afterPeng[j] -= 2;
        const pengHuxi = jBig ? 3 : 1; // 碰大字3胡，碰小字1胡
        const totalExposedHuxi = exposedHuxi + pengHuxi;

        // 碰后需要打1张，遍历所有可打的牌
        const afterPengTotal = handTotal(afterPeng);
        // 打1张后 = afterPengTotal-1，需要是3M+2
        if ((afterPengTotal - 1) % 3 !== 2) continue;

        for (let k = 0; k < 21; k++) {
          if (afterPeng[k] === 0) continue;
          const kGhost = k === 20;
          const kBig = k >= 10 && k < 20;
          const kName = kGhost ? GHOST_TILE : tileName(kBig ? k - 9 : k + 1, kBig ? "big" : "small");

          const afterPengDiscard = cloneHand(afterPeng);
          afterPengDiscard[k]--;

          const res = canHu(afterPengDiscard, totalExposedHuxi, minHuxi);
          if (res.ok && !tingTileSet.has(jName)) {
            tingTiles.push({
              tile: jName,
              maxHuxi: res.maxHuxi + pengHuxi,
              bestGroups: res.bestGroups,
              bestPair: res.bestPair,
            });
            tingTileSet.add(jName);
            break; // 找到一种碰后打法就够了
          }
        }
      }
    }

    if (tingTiles.length > 0) {
      let tingCount = 0;
      for (const tt of tingTiles) {
        if (tt.tile === "自摸") { tingCount += 1; continue; }
        const tp = parseTile(tt.tile);
        if (!tp) continue;
        const maxC = tt.tile === GHOST_TILE ? 1 : 4;
        const tidx = tp.type === "ghost" ? 20 : (tp.type === "small" ? tp.value - 1 : tp.value + 9);
        tingCount += Math.max(0, maxC - (allKnown[tidx] - (i === tidx ? 1 : 0)));
      }
      results.push({
        discard: dName,
        tingTiles,
        tingWidth: tingTiles.length,
        tingCount,
        maxHuxi: Math.max(...tingTiles.map(t => t.maxHuxi)) + exposedHuxi,
      });
    }
  }

  results.sort((a, b) => b.tingWidth !== a.tingWidth ? b.tingWidth - a.tingWidth : b.tingCount !== a.tingCount ? b.tingCount - a.tingCount : b.maxHuxi - a.maxHuxi);
  return results;
}

// ===== 散牌分析 =====
interface LooseTileAnalysis {
  tile: string; type: TileType; value: number;
  partialShunzi: { need: string; form: string }[];
  hasPair: boolean; jinzhangCount: number; isWaste: boolean;
}

function analyzeLooseTiles(looseTiles: string[]): LooseTileAnalysis[] {
  const hand = handFromTiles(looseTiles);
  const results: LooseTileAnalysis[] = [];
  const done = new Set<string>();

  for (const tile of looseTiles) {
    if (done.has(tile)) continue;
    done.add(tile);
    const p = parseTile(tile);
    if (!p || p.type === "ghost") continue;

    const idx = p.type === "small" ? p.value - 1 : p.value + 9;
    const count = hand[idx];
    const hasPair = count >= 2;
    const partials: { need: string; form: string }[] = [];
    const off = p.type === "small" ? 0 : 10;
    const tp: "big" | "small" = p.type as any;

    for (let s = Math.max(1, p.value - 2); s <= Math.min(8, p.value); s++) {
      const vs = [s, s + 1, s + 2];
      if (!vs.includes(p.value)) continue;
      const others = vs.filter(v => v !== p.value);
      for (const o of others) {
        if (hand[off + o - 1] > 0) {
          const need = vs.find(v => v !== p.value && v !== o)!;
          partials.push({ need: tileName(need, tp), form: vs.map(v => tileName(v, tp)).join("") });
        }
      }
    }
    const sp = [2, 7, 10];
    if (sp.includes(p.value)) {
      const oth = sp.filter(v => v !== p.value);
      for (const o of oth) {
        if (hand[off + o - 1] > 0) {
          const need = oth.find(v => v !== o)!;
          partials.push({ need: tileName(need, tp), form: `${tileName(2, tp)}${tileName(7, tp)}${tileName(10, tp)}` });
        }
      }
    }

    const otherIdx = p.type === "small" ? p.value + 9 : p.value - 1;
    const hasMix = hand[otherIdx] > 0;

    let jin = 0;
    if (hasPair) jin++;
    jin += new Set(partials.map(ps => ps.need)).size;
    if (hasMix) jin++;

    const isWaste = jin === 0 && !hasPair && partials.length === 0 && !hasMix;
    results.push({ tile, type: p.type, value: p.value, partialShunzi: partials, hasPair, jinzhangCount: jin, isWaste });
  }
  return results;
}

// ===== 方案评分 =====
interface CombinationPlan {
  groups: TileGroup[];
  pair: string[] | null;
  totalHuxi: number;
  remainingTiles: string[];
  remainingCount: number;
}

interface ScoredPlan extends CombinationPlan {
  score: number; stepsToTing: number;
  looseAnalysis: LooseTileAnalysis[]; looseRelation: string;
  isComplete: boolean;
}

function scorePlan(plan: CombinationPlan): ScoredPlan {
  const la = analyzeLooseTiles(plan.remainingTiles);
  let pairs = 0, partials = 0, wastes = 0;
  const rels: string[] = [];
  const counted = new Set<string>();

  for (const a of la) {
    if (counted.has(a.tile)) continue;
    counted.add(a.tile);
    const cnt = plan.remainingTiles.filter(t => t === a.tile).length;
    if (cnt >= 2) { pairs++; rels.push(`${a.tile}${a.tile}对子可碰`); }
    else if (a.partialShunzi.length > 0) { partials++; rels.push(`${a.tile}搭子(差${a.partialShunzi[0].need})`); }
    else if (a.isWaste) { wastes++; rels.push(`${a.tile}废牌`); }
    else rels.push(`${a.tile}孤张`);
  }

  const isComplete = plan.remainingCount === 0 && plan.pair !== null;

  if (isComplete) {
    return { ...plan, score: 10000 + plan.totalHuxi * 100, stepsToTing: 0, looseAnalysis: la, looseRelation: "全部组完", isComplete: true };
  }

  // 评分核心改进：散牌少 > 胡息高
  // 散牌每少1张 = +500分（最重要）
  // 有将牌 = +200分
  // 胡息每1点 = +10分
  const steps = Math.max(0, Math.ceil(plan.remainingCount / 3));
  const remPenalty = plan.remainingCount * 500;
  const hxBonus = plan.totalHuxi * 10;
  const pairBonus = plan.pair ? 200 : 0;
  const structBonus = pairs * 30 + partials * 15 - wastes * 40;

  const score = 5000 - remPenalty + hxBonus + pairBonus + structBonus;

  return { ...plan, score, stepsToTing: steps, looseAnalysis: la, looseRelation: rels.join("，"), isComplete };
}

// ===== 去重 =====
function groupKey(g: TileGroup): string {
  return [...g.tiles].sort().join(",") + ":" + g.type + ":" + (g.ghostAs || "");
}
function planKey(p: { groups: TileGroup[]; pair?: string[] | null }): string {
  const gk = p.groups.map(g => groupKey(g)).sort().join("|");
  const pk = p.pair ? [...p.pair].sort().join(",") : "none";
  return gk + "||" + pk;
}

// ===== 主入口 =====
export interface EngineResult {
  plans: ScoredPlan[];
  ghostAnalysis: {
    hasGhost: boolean; bestReplacement: string;
    allReplacements: { tile: string; bestPlanScore: number; bestPlanHuxi: number; stepsToTing: number }[];
  };
  tingAnalysis: TingResult[];
  totalTiles: number; isDealer: boolean;
  lockedKan: TileGroup[];
  kanHuxi: number;
}

export function analyzeHand(
  tiles: string[],
  options?: { exposedHuxi?: number; minHuxi?: number; knownTiles?: string[] }
): EngineResult {
  const totalTiles = tiles.length;
  const isDealer = totalTiles === 21;
  const hand = handFromTiles(tiles);
  const hasGhost = hand[20] > 0;

  // ===== 提牌和坎牌自动检测和锁定 =====
  // 手牌中4张相同 = 提（大字12胡/小字9胡），3张相同 = 坎（大字6胡/小字3胡）
  // 提和坎都不可拆，必须锁定
  const lockedKan: TileGroup[] = [];
  let kanHuxi = 0;
  const lockedIndices = new Set<number>(); // 被锁定的牌索引
  for (let i = 0; i < 20; i++) {
    if (hand[i] >= 4) {
      // 提：4张相同
      const isBig = i >= 10;
      const v = isBig ? i - 9 : i + 1;
      const tName = tileName(v, isBig ? "big" : "small");
      const huxi = isBig ? 12 : 9; // 大字提12胡，小字提9胡
      lockedKan.push({
        tiles: [tName, tName, tName, tName],
        type: "kan" as GroupType, // 复用kan类型，前端通过4张区分提/坎
        huxi,
        description: `${tName}${tName}${tName}${tName}提(${isBig ? "大" : "小"}字${huxi}胡)`,
      });
      kanHuxi += huxi;
      hand[i] -= 4; // 从手牌中移除4张
      lockedIndices.add(i);
    } else if (hand[i] >= 3) {
      // 坎：3张相同
      const isBig = i >= 10;
      const v = isBig ? i - 9 : i + 1;
      const tName = tileName(v, isBig ? "big" : "small");
      const huxi = isBig ? 6 : 3; // 大字坎6胡，小字坎3胡
      lockedKan.push({
        tiles: [tName, tName, tName],
        type: "kan" as GroupType,
        huxi,
        description: `${tName}${tName}${tName}坎(${isBig ? "大" : "小"}字${huxi}胡)`,
      });
      kanHuxi += huxi;
      hand[i] -= 3; // 从手牌中移除坎牌
      lockedIndices.add(i);
    }
  }
  // 鬼牌也可能和对子组成坎，但鬼坎在回溯搜索中处理，不在这里锁定

  const effectiveExposedHuxi = (options?.exposedHuxi || 0) + kanHuxi;
  const remainingTotal = handTotal(hand);

  // 回溯搜索所有拆法（只搜索非坎牌部分）
  const rawResults: SearchResult[] = [];
  const bestRef = { bestRemaining: remainingTotal, bestHuxi: 0 };
  backtrackSearch(hand, [], null, rawResults, 500, 0, bestRef);

  // 转换为CombinationPlan并评分（将锁定坎牌加入groups）
  const plans: CombinationPlan[] = rawResults.map(r => ({
    groups: [...lockedKan, ...r.groups],
    pair: r.pair,
    totalHuxi: r.totalHuxi + kanHuxi,
    remainingTiles: r.remainingTiles,
    remainingCount: r.remainingCount,
  }));

  const scored = plans.map(p => scorePlan(p));
  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const unique: ScoredPlan[] = [];
  for (const p of scored) {
    const k = planKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
    if (unique.length >= 10) break;
  }

  // 听牌分析（传入坎牌胡息作为exposedHuxi，传入锁定索引跳过坎牌）
  let ting: TingResult[] = [];
  if (totalTiles % 3 === 0) {
    ting = analyzeTing(tiles, effectiveExposedHuxi, options?.minHuxi || 10, options?.knownTiles || [], lockedIndices);
  }

  // 鬼牌分析
  const ghostRes: { tile: string; bestPlanScore: number; bestPlanHuxi: number; stepsToTing: number }[] = [];
  if (hasGhost && unique.length > 0) {
    const usages = new Map<string, { score: number; huxi: number; steps: number }>();
    for (const p of unique) {
      for (const g of p.groups) {
        if (g.ghostAs && !usages.has(g.ghostAs)) usages.set(g.ghostAs, { score: p.score, huxi: p.totalHuxi, steps: p.stepsToTing });
      }
    }
    usages.forEach((info, t) => ghostRes.push({ tile: t, bestPlanScore: info.score, bestPlanHuxi: info.huxi, stepsToTing: info.steps }));
    ghostRes.sort((a, b) => b.bestPlanScore - a.bestPlanScore);
  }

  return {
    plans: unique,
    ghostAnalysis: { hasGhost, bestReplacement: ghostRes[0]?.tile || "", allReplacements: ghostRes },
    tingAnalysis: ting,
    totalTiles, isDealer,
    lockedKan,
    kanHuxi,
  };
}

// ===== 导出 =====
export { parseTile, tileName, calcGroupHuxi, handFromTiles, handToTiles, handTotal, analyzeLooseTiles, analyzeTing, canCompleteAll, canHu, backtrackSearch, cloneHand, SMALL_TILES, BIG_TILES, GHOST_TILE };
export type { TileGroup, LooseTileAnalysis, ScoredPlan, CombinationPlan, TingResult, HandArray, GroupType, TileType };
