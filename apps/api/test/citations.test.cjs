const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAnswerCitations } = require("../dist/ai/citations.js");

test("citation validation removes labels not returned by retrieval", () => {
  const sources = [
    { citation: "S1", title: "Notes", url: null, similarity: 0.8 },
    { citation: "S2", title: "Guide", url: "https://example.com", similarity: 0.7 },
  ];
  const result = validateAnswerCitations("Supported [S1]. Fake [S9]. Also [S2].", sources);
  assert.equal(result.answer, "Supported [S1]. Fake . Also [S2].");
  assert.deepEqual(result.sources.map(source => source.citation), ["S1", "S2"]);
});

test("citation validation omits sources the answer did not cite", () => {
  const sources = [{ citation: "S1", title: "Notes", url: null, similarity: 0.8 }];
  assert.deepEqual(validateAnswerCitations("A general answer.", sources).sources, []);
});
