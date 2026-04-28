import { describe, expect, it } from "vitest";
import { europeanLocalDateTimeToUtcIso } from "./time";

describe("time helpers", () => {
  it("converts Europe/Zurich summer local time to UTC ISO for OJP requests", () => {
    expect(europeanLocalDateTimeToUtcIso("2026-04-28", "13:00")).toBe("2026-04-28T11:00:00.000Z");
  });

  it("converts Europe/Zurich winter local time to UTC ISO for OJP requests", () => {
    expect(europeanLocalDateTimeToUtcIso("2026-01-28", "13:00")).toBe("2026-01-28T12:00:00.000Z");
  });
});
