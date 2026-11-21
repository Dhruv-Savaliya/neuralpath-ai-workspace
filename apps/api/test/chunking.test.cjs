const test = require("node:test");
const assert = require("node:assert/strict");
const { chunkKnowledgeText } = require("../dist/ai/chunking.js");

test("chunking repeats section headings when long sections need multiple chunks", () => {
  const body = Array.from({ length: 80 }, (_, index) => `Concept ${index}: a detailed explanation that builds on the prior learning objective and gives a concrete example.`).join(" ");
  const chunks = chunkKnowledgeText(`# Retrieval Systems\n\n${body}`, 420, 60);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 420));
  assert.ok(chunks.every(chunk => chunk.startsWith("# Retrieval Systems\n")));
});

test("chunking preserves paragraph, list and fenced-code structure", () => {
  const input = [
    "# API Design",
    "",
    "An API exposes a stable contract between systems. Keep this explanation together.",
    "",
    "## Checklist",
    "",
    "- Validate the input",
    "- Authorize the caller",
    "1. Bound the query",
    "2. Return a useful error",
    "",
    "## Example",
    "",
    "```ts",
    "const result = await fetchData();",
    "if (!result.ok) throw new Error('failed');",
    "```",
  ].join("\n");
  const chunks = chunkKnowledgeText(input, 1200, 180);
  const joined = chunks.join("\n\n");
  assert.match(joined, /# API Design/);
  assert.match(joined, /## Checklist/);
  assert.match(joined, /- Validate the input\n- Authorize the caller/);
  assert.match(joined, /1\. Bound the query\n2\. Return a useful error/);
  assert.match(joined, /```ts[\s\S]*?```/);
});

test("chunking normalizes whitespace and rejects empty material", () => {
  assert.deepEqual(chunkKnowledgeText("  \n \t "), []);
  const chunks = chunkKnowledgeText("A useful paragraph with enough words to become a retrieval chunk.\n\nAnother paragraph with enough context to remain useful.");
  assert.equal(chunks.length, 1);
  assert.ok(!chunks[0].includes("\r"));
});
