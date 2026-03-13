import { describe, expect, it } from "vitest";
import {
  findKnownScreenshotFixture,
  normalizeOcrText,
} from "./local-recognition";

describe("local recognition helpers", () => {
  it("normalizes OCR text by removing whitespace", () => {
    expect(normalizeOcrText("2026-03-10 \n 22:21")).toBe("2026-03-1022:21");
  });

  it("no longer uses hardcoded screenshot fixtures", () => {
    expect(
      findKnownScreenshotFixture("remaining 40  2026-03-10 22:21")
    ).toBeNull();
  });
});
