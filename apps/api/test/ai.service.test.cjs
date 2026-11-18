const test = require("node:test");
const assert = require("node:assert/strict");
const { AiService } = require("../dist/ai/ai.service.js");

function createService() {
  const config = {
    get(key) {
      if (key === "GEMINI_MODEL") return "gemini-3.8-flash";
      if (key === "GROQ_MODEL") return "openai/gpt-oss-120b";
      return undefined;
    },
  };
  const service = new AiService(config);
  const events = [];
  service.recordUsage = async (...args) => { events.push(args); };
  return { service, events };
}

test("learning generation records provider, model, output size and latency on success", async () => {
  const { service, events } = createService();
  service.generate = async () => ({ answer: "Grounded recommendation JSON", provider: "gemini", model: "gemini-3.8-flash" });
  const result = await service.generateForLearning({ user: { id: "learner-a" } }, "minimal learner context");

  assert.equal(result.provider, "gemini");
  assert.equal(events.length, 1);
  assert.equal(events[0][1], "gemini");
  assert.equal(events[0][2], "gemini-3.8-flash");
  assert.equal(events[0][3], "generation");
  assert.equal(events[0][7], true);
  assert.equal(events[0][8], undefined);
  assert.ok(events[0][6] >= 0);
});

test("learning generation records provider-chain failure without leaking prompts", async () => {
  const { service, events } = createService();
  service.generate = async () => { throw new Error("provider unavailable"); };

  await assert.rejects(
    service.generateForLearning({ user: { id: "learner-a" } }, "private context omitted from telemetry"),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0][1], "generation_chain");
  assert.equal(events[0][2], "gemini-3.8-flash+openai/gpt-oss-120b");
  assert.equal(events[0][7], false);
  assert.equal(events[0][8], "provider_unavailable");
  assert.equal(events[0][5], 0);
});

test("learning generation rejects oversized prompts before calling a provider", async () => {
  const { service, events } = createService();
  let called = false;
  service.generate = async () => { called = true; throw new Error("should not run"); };

  await assert.rejects(
    service.generateForLearning({ user: { id: "learner-a" } }, "x".repeat(12001)),
  );
  assert.equal(called, false);
  assert.equal(events.length, 0);
});
