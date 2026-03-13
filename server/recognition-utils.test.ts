import { describe, expect, it } from "vitest";
import {
  compareRecognitionQuality,
  getRecognitionQuality,
  needsRecognitionRetry,
  normalizeRecognition,
  normalizeTileName,
  repairOverLimitTiles,
} from "./recognition-utils";

describe("recognition-utils", () => {
  it("normalizes common aliases into canonical tile names", () => {
    expect(normalizeTileName("小七")).toBe("七");
    expect(normalizeTileName("大十")).toBe("拾");
    expect(normalizeTileName("陸")).toBe("陆");
    expect(normalizeTileName("鬼牌")).toBe("鬼");
    expect(normalizeTileName(" 牌伍 ")).toBe("伍");
  });

  it("normalizes recognition payload tile arrays", () => {
    const recognition = normalizeRecognition({
      handTiles: ["小五", "大七", "鬼牌", "未知牌"],
      discardedTiles: ["小十", "大二"],
      myExposedGroups: [{ tiles: ["大八", "小八"], type: "碰" }],
      opponentExposedGroups: [{ tiles: ["大六"], type: "提" }],
      remainingTiles: "38",
      myCurrentHuxi: "12",
      opponentCurrentHuxi: undefined,
      actionButtons: "",
      isDealer: 1,
    });

    expect(recognition.handTiles).toEqual(["五", "柒", "鬼"]);
    expect(recognition.discardedTiles).toEqual(["十", "贰"]);
    expect(recognition.myExposedGroups[0].tiles).toEqual(["捌", "八"]);
    expect(recognition.opponentExposedGroups[0].tiles).toEqual(["陆"]);
    expect(recognition.remainingTiles).toBe(38);
    expect(recognition.myCurrentHuxi).toBe(12);
    expect(recognition.opponentCurrentHuxi).toBe(0);
    expect(recognition.actionButtons).toBe("无");
    expect(recognition.isDealer).toBe(true);
  });

  it("invalid tiles should trigger retry", () => {
    expect(needsRecognitionRetry(["一", "二", "错牌"])).toBe(true);
  });

  it("over-limit tiles should trigger retry", () => {
    const tiles = ["伍", "伍", "伍", "伍", "伍", "一"];
    const quality = getRecognitionQuality(tiles);

    expect(quality.overLimitCopies).toBe(1);
    expect(needsRecognitionRetry(tiles)).toBe(true);
  });

  it("prefers valid results over outputs with invalid tiles", () => {
    const initial = ["一", "二", "三", "错牌"];
    const retry = ["一", "二", "三", "四"];

    expect(compareRecognitionQuality(retry, initial)).toBeLessThan(0);
  });

  it("repairs excess copies by swapping to the matching big or small tile", () => {
    const repaired = repairOverLimitTiles(["七", "七", "七", "七", "七", "柒"]);

    expect(repaired.filter(tile => tile === "七")).toHaveLength(4);
    expect(repaired.filter(tile => tile === "柒")).toHaveLength(2);
  });
});

