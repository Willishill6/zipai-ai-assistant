import { describe, expect, it } from "vitest";
import { generateAdviceFromEngine } from "./advice-generator";
import type { EngineResult, TileGroup } from "./zipai-engine";

describe("generateAdviceFromEngine", () => {
  it("should not double count locked kan huxi", () => {
    const lockedKan: TileGroup[] = [
      {
        tiles: ["伍", "伍", "伍"],
        type: "kan",
        huxi: 6,
        description: "伍伍伍坎(大字6胡)",
      },
    ];

    const engine: EngineResult = {
      plans: [
        {
          groups: [
            lockedKan[0],
            {
              tiles: ["一", "二", "三"],
              type: "shunzi",
              huxi: 3,
              description: "一二三顺(小字3胡)",
            },
          ],
          pair: ["九", "玖"],
          totalHuxi: 9,
          remainingTiles: [],
          remainingCount: 0,
          score: 10900,
          stepsToTing: 0,
          looseAnalysis: [],
          looseRelation: "全部组完",
          isComplete: true,
        },
      ],
      ghostAnalysis: {
        hasGhost: false,
        bestReplacement: "",
        allReplacements: [],
      },
      tingAnalysis: [],
      totalTiles: 21,
      isDealer: true,
      lockedKan,
      kanHuxi: 6,
    };

    const advice = generateAdviceFromEngine(
      engine,
      {
        handTiles: ["伍", "伍", "伍", "一", "二", "三", "九", "玖"],
        remainingTiles: 25,
        discardedTiles: [],
        opponentExposedGroups: [],
        opponentCurrentHuxi: 0,
        actionButtons: "无",
      },
      4
    );

    expect(advice.currentHuxi).toBe(13);
    expect(advice.huxiBreakdown).toContain("🔒伍伍伍=6胡");
    expect(advice.huxiBreakdown.match(/🔒伍伍伍=6胡/g)).toHaveLength(1);
  });
});
