import { describe, expect, it } from "vitest";
import { validateAnswerCitations } from "./citations";

describe("validateAnswerCitations", () => {
  it("keeps only citations returned by retrieval", () => {
    const sources = [
      { citation: "S1", title: "Notes", url: null, similarity: 0.8 },
      { citation: "S2", title: "Guide", url: "https://example.com", similarity: 0.7 },
    ];
    const result = validateAnswerCitations("Supported [S1]. Fake [S9]. Also [S2].", sources);
    expect(result.answer).toBe("Supported [S1]. Fake . Also [S2].");
    expect(result.sources.map(source => source.citation)).toEqual(["S1", "S2"]);
  });

  it("removes source cards that were not cited in the answer", () => {
    const sources = [{ citation: "S1", title: "Notes", url: null, similarity: 0.8 }];
    expect(validateAnswerCitations("A general answer.", sources).sources).toEqual([]);
  });
});
