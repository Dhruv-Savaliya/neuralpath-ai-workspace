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


test("Gemini 429 uses the configured Groq GPT-OSS fallback", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recommendations: [] }) } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const config = {
      get(key) {
        return ({
          GEMINI_API_KEY: "test-gemini-key",
          GEMINI_MODEL: "gemini-3.8-flash",
          GROQ_API_KEY: "test-groq-key",
          GROQ_MODEL: "openai/gpt-oss-120b",
        })[key];
      },
    };
    const service = new AiService(config);
    service.recordUsage = async () => {};
    const result = await service.generateForLearning(
      { user: { id: "learner-a" } },
      "candidate-only learning context",
    );

    assert.equal(result.provider, "groq");
    assert.equal(result.model, "openai/gpt-oss-120b");
    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes("generativelanguage.googleapis.com"));
    assert.ok(calls[1].includes("api.groq.com"));
  } finally {
    global.fetch = originalFetch;
  }
});


test("Gemini model/configuration errors also attempt the explicitly enabled Groq fallback", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ error: { message: "model not found for this API key" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "valid fallback response" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const config = { get(key) {
      return ({
        GEMINI_API_KEY: "test-gemini-key",
        GEMINI_MODEL: "invalid-model-for-test",
        GROQ_API_KEY: "test-groq-key",
        GROQ_MODEL: "openai/gpt-oss-120b",
        GROQ_ENABLED: "true",
      })[key];
    }};
    const service = new AiService(config);
    const result = await service.generate("test prompt");
    assert.equal(result.provider, "groq");
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Gemini failure preserves provider reason when Groq is disabled", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ error: { message: "invalid model" } }), {
    status: 404, headers: { "Content-Type": "application/json" },
  });
  try {
    const config = { get(key) {
      return ({
        GEMINI_API_KEY: "test-gemini-key",
        GEMINI_MODEL: "invalid-model-for-test",
        GROQ_ENABLED: "false",
      })[key];
    }};
    const service = new AiService(config);
    await assert.rejects(
      () => service.generate("test prompt"),
      error => error.status === 503 && /Gemini returned HTTP 404: invalid model/.test(error.message),
    );
  } finally {
    global.fetch = originalFetch;
  }
});
