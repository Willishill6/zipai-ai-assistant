export const STANDARD_TILES = [
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
  "壹",
  "贰",
  "叁",
  "肆",
  "伍",
  "陆",
  "柒",
  "捌",
  "玖",
  "拾",
  "鬼",
] as const;

export type StandardTile = (typeof STANDARD_TILES)[number];

export const LARGE_TO_SMALL: Record<string, StandardTile> = {
  壹: "一",
  贰: "二",
  叁: "三",
  肆: "四",
  伍: "五",
  陆: "六",
  柒: "七",
  捌: "八",
  玖: "九",
  拾: "十",
};

export const SMALL_TO_LARGE: Record<string, StandardTile> = {
  一: "壹",
  二: "贰",
  三: "叁",
  四: "肆",
  五: "伍",
  六: "陆",
  七: "柒",
  八: "捌",
  九: "玖",
  十: "拾",
};

const STANDARD_TILE_SET = new Set<string>(STANDARD_TILES);
const NON_TILE_CHARS = /[\s,，、.。:：;；"'`“”‘’()[\]{}<>《》]/g;

const TILE_ALIASES = new Map<string, StandardTile>([
  ["小一", "一"],
  ["小二", "二"],
  ["小三", "三"],
  ["小四", "四"],
  ["小五", "五"],
  ["小六", "六"],
  ["小七", "七"],
  ["小八", "八"],
  ["小九", "九"],
  ["小十", "十"],
  ["大一", "壹"],
  ["大二", "贰"],
  ["大三", "叁"],
  ["大四", "肆"],
  ["大五", "伍"],
  ["大六", "陆"],
  ["陸", "陆"],
  ["大陸", "陆"],
  ["黑陸", "陆"],
  ["大七", "柒"],
  ["大八", "捌"],
  ["大九", "玖"],
  ["大十", "拾"],
  ["红二", "二"],
  ["红七", "七"],
  ["红十", "十"],
  ["红贰", "贰"],
  ["红柒", "柒"],
  ["红拾", "拾"],
  ["黑一", "一"],
  ["黑三", "三"],
  ["黑四", "四"],
  ["黑五", "五"],
  ["黑六", "六"],
  ["黑八", "八"],
  ["黑九", "九"],
  ["黑壹", "壹"],
  ["黑叁", "叁"],
  ["黑肆", "肆"],
  ["黑伍", "伍"],
  ["黑陆", "陆"],
  ["黑捌", "捌"],
  ["黑玖", "玖"],
  ["鬼牌", "鬼"],
  ["飞飞", "鬼"],
  ["王", "鬼"],
  ["王牌", "鬼"],
  ["癞子", "鬼"],
  ["赖子", "鬼"],
  ["混牌", "鬼"],
]);

function countTiles(tiles: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tile of tiles) {
    counts[tile] = (counts[tile] || 0) + 1;
  }
  return counts;
}

function toSafeInteger(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function cleanTileToken(tile: string): string {
  return tile.replace(NON_TILE_CHARS, "").trim();
}

export function isStandardTile(tile: string): tile is StandardTile {
  return STANDARD_TILE_SET.has(tile);
}

export function normalizeTileName(tile: unknown): StandardTile | null {
  if (typeof tile !== "string") {
    return null;
  }

  const cleaned = cleanTileToken(tile);
  if (!cleaned) {
    return null;
  }

  if (isStandardTile(cleaned)) {
    return cleaned;
  }

  const alias = TILE_ALIASES.get(cleaned);
  if (alias) {
    return alias;
  }

  const stripped = cleaned
    .replace(/^(?:牌|张)+/, "")
    .replace(/(?:牌|张)+$/, "")
    .replace(/^(?:大字|小字|大|小|红|黑)+/, "")
    .replace(/(?:大字|小字|牌|张)+$/, "");

  if (isStandardTile(stripped)) {
    return stripped;
  }

  return TILE_ALIASES.get(stripped) || null;
}

export function normalizeTiles(tiles: unknown): string[] {
  if (!Array.isArray(tiles)) {
    return [];
  }

  const normalized: string[] = [];
  for (const tile of tiles) {
    const next = normalizeTileName(tile);
    if (next) {
      normalized.push(next);
    }
  }

  return normalized;
}

export function normalizeRecognition(
  recognition: Record<string, any>
): Record<string, any> {
  const normalized: Record<string, any> = { ...recognition };

  normalized.handTiles = normalizeTiles(recognition.handTiles);
  normalized.discardedTiles = normalizeTiles(recognition.discardedTiles);
  normalized.myExposedGroups = Array.isArray(recognition.myExposedGroups)
    ? recognition.myExposedGroups.map((group: any) => ({
        ...group,
        tiles: normalizeTiles(group?.tiles),
        type: typeof group?.type === "string" ? group.type : "未知",
      }))
    : [];
  normalized.opponentExposedGroups = Array.isArray(
    recognition.opponentExposedGroups
  )
    ? recognition.opponentExposedGroups.map((group: any) => ({
        ...group,
        tiles: normalizeTiles(group?.tiles),
        type: typeof group?.type === "string" ? group.type : "未知",
      }))
    : [];
  normalized.remainingTiles = toSafeInteger(recognition.remainingTiles);
  normalized.myCurrentHuxi = toSafeInteger(recognition.myCurrentHuxi);
  normalized.opponentCurrentHuxi = toSafeInteger(
    recognition.opponentCurrentHuxi
  );
  normalized.actionButtons =
    typeof recognition.actionButtons === "string" &&
    recognition.actionButtons.trim()
      ? recognition.actionButtons
      : "无";
  normalized.isDealer = Boolean(recognition.isDealer);

  return normalized;
}

export interface RecognitionQuality {
  tileCount: number;
  invalidTileCount: number;
  invalidTiles: string[];
  overLimitKinds: number;
  overLimitCopies: number;
}

export function getRecognitionQuality(tiles: string[]): RecognitionQuality {
  const counts = countTiles(tiles);
  let overLimitKinds = 0;
  let overLimitCopies = 0;
  const invalidTiles = tiles.filter(tile => !isStandardTile(tile));

  for (const [tile, count] of Object.entries(counts)) {
    if (tile === "鬼" || count <= 4) continue;
    overLimitKinds++;
    overLimitCopies += count - 4;
  }

  return {
    tileCount: tiles.length,
    invalidTileCount: invalidTiles.length,
    invalidTiles,
    overLimitKinds,
    overLimitCopies,
  };
}

export function needsRecognitionRetry(tiles: string[]): boolean {
  if (tiles.length === 0) return true;
  const quality = getRecognitionQuality(tiles);
  return quality.invalidTileCount > 0 || quality.overLimitKinds > 0;
}

export function compareRecognitionQuality(
  left: string[],
  right: string[]
): number {
  const a = getRecognitionQuality(left);
  const b = getRecognitionQuality(right);

  if (a.invalidTileCount !== b.invalidTileCount) {
    return a.invalidTileCount - b.invalidTileCount;
  }
  if (a.overLimitCopies !== b.overLimitCopies) {
    return a.overLimitCopies - b.overLimitCopies;
  }
  if (a.overLimitKinds !== b.overLimitKinds) {
    return a.overLimitKinds - b.overLimitKinds;
  }
  if (a.tileCount !== b.tileCount) {
    return b.tileCount - a.tileCount;
  }
  return 0;
}

export function repairOverLimitTiles(tiles: string[]): string[] {
  const counts = countTiles(tiles);
  let normalizedTiles = [...tiles];

  for (const [tile, count] of Object.entries(counts)) {
    if (tile === "鬼" || count <= 4) {
      continue;
    }

    const counterpart = LARGE_TO_SMALL[tile] || SMALL_TO_LARGE[tile];
    if (!counterpart) {
      continue;
    }

    const excess = count - 4;
    const counterpartCount = counts[counterpart] || 0;
    const canConvert = Math.min(excess, Math.max(0, 4 - counterpartCount));
    if (canConvert <= 0) {
      continue;
    }

    let converted = 0;
    normalizedTiles = normalizedTiles.map(currentTile => {
      if (
        currentTile === tile &&
        converted < canConvert &&
        (counts[tile] || 0) > 4
      ) {
        converted++;
        counts[tile] = (counts[tile] || 0) - 1;
        counts[counterpart] = (counts[counterpart] || 0) + 1;
        return counterpart;
      }
      return currentTile;
    });
  }

  return normalizedTiles;
}

