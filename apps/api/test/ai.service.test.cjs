const test = require("node:test");
const assert = require("node:assert/strict");
const { AiService } = require("../dist/ai/ai.service.js");

function makeReq({ allow = true } = {}) {
  const rpcCalls = [];
  return {
    user: { id: "learner-a" },
    rpcCalls,
    supabase: {
      async rpc(name, args) {
        rpcCalls.push({ name, args });
        if (name.startsWith("reserve_")) {
          return { data: [{ allowed: allow, reservation_id: "reservation-test" }], error: null };
        }
        return { data: true, error: null };
      },
      from() {
        return {
          select() {
            return {
              eq() { return this; },
              in() { return Promise.resolve({ data: [], error: null }); },
            };
          },
          upsert() { return Promise.resolve({ data: [], error: null }); },
        };
      },
    },
  };
}

function makeConfig(values = {}) {
  return { get(key) { return values[key]; } };
}

test("learning generation records provider, model, output size and latency on success", async () => {
  const service = new AiService(makeConfig());
  const events = [];
  service.recordUsage = async (...args) => events.push(args);
  service.generate = async () => ({ answer: "Grounded response", provider: "groq", model: "openai/gpt-oss-120b" });
  const result = await service.generateForLearning(makeReq(), "learner context");
  assert.equal(result.provider, "groq");
  assert.equal(events.length, 1);
  assert.equal(events[0][1], "groq");
  assert.equal(events[0][2], "openai/gpt-oss-120b");
  assert.equal(events[0][7], true);
});

test("learning generation rejects oversized prompts before provider invocation", async () => {
  const service = new AiService(makeConfig());
  let called = false;
  service.generate = async () => { called = true; throw new Error("unexpected"); };
  await assert.rejects(service.generateForLearning(makeReq(), "x".repeat(12001)));
  assert.equal(called, false);
});

test("Groq is primary and Gemini is not called after a successful Groq response", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    return new Response(JSON.stringify({ choices: [{ message: { content: "Groq answer" }, finish_reason: "stop" }] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const service = new AiService(makeConfig({
      GROQ_API_KEY: "test-groq-key",
      GROQ_MODEL: "openai/gpt-oss-120b",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    }));
    service.recordUsage = async () => {};
    const req = makeReq();
    const result = await service.generateForLearning(req, "learner context");
    assert.equal(result.provider, "groq");
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("api.groq.com"));
    assert.ok(req.rpcCalls.some(call => call.name === "reserve_ai_generation" && call.args.p_provider === "groq"));
    assert.ok(req.rpcCalls.some(call => call.name === "complete_ai_generation"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Gemini is used when primary Groq is rate limited", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes("api.groq.com")) {
      return new Response(JSON.stringify({ error: { message: "rate limit reached" } }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini fallback answer" }] } }] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const service = new AiService(makeConfig({
      GROQ_API_KEY: "test-groq-key",
      GROQ_MODEL: "openai/gpt-oss-120b",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    }));
    service.recordUsage = async () => {};
    const req = makeReq();
    const result = await service.generateForLearning(req, "learner context");
    assert.equal(result.provider, "gemini");
    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes("api.groq.com"));
    assert.ok(calls[1].includes("generativelanguage.googleapis.com"));
    assert.ok(req.rpcCalls.some(call => call.name === "release_ai_generation" && call.args.p_reservation_id === "reservation-test"));
    assert.ok(req.rpcCalls.some(call => call.name === "complete_ai_generation"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Cloudflare BGE-M3 embedding cache misses are metered and cached", async () => {
  const originalFetch = global.fetch;
  const vector = Array.from({ length: 1024 }, (_, index) => index / 1024);
  let requestBody;
  global.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ success: true, result: { data: [vector] } }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const service = new AiService(makeConfig({
      CLOUDFLARE_ACCOUNT_ID: "test-account",
      CLOUDFLARE_API_TOKEN: "test-token",
      CLOUDFLARE_EMBEDDING_MODEL: "@cf/baai/bge-m3",
      EMBEDDING_DIMENSIONS: "1024",
    }));
    service.recordUsage = async () => {};
    const req = makeReq();
    const result = await service.embed(req, ["sample embedding text"]);
    assert.deepEqual(requestBody.text, ["sample embedding text"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].length, 1024);
    assert.ok(req.rpcCalls.some(call => call.name === "reserve_cloudflare_neurons"));
    assert.ok(req.rpcCalls.some(call => call.name === "complete_cloudflare_neurons"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Cloudflare BGE-M3 rejects vectors that do not match vector(1024)", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    success: true, result: { data: [[0.1, 0.2, 0.3]] },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const service = new AiService(makeConfig({
      CLOUDFLARE_ACCOUNT_ID: "test-account",
      CLOUDFLARE_API_TOKEN: "test-token",
      CLOUDFLARE_EMBEDDING_MODEL: "@cf/baai/bge-m3",
      EMBEDDING_DIMENSIONS: "1024",
    }));
    service.recordUsage = async () => {};
    await assert.rejects(() => service.embed(makeReq(), ["sample embedding text"]), /dimensions did not match vector\(1024\)/);
  } finally {
    global.fetch = originalFetch;
  }
});


test("Gemini fallback is used when Groq truncates a curriculum response", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes("api.groq.com")) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\\"days\\":[" }, finish_reason: "length" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "{\\"days\\":[]}" }] }, finishReason: "STOP" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const service = new AiService(makeConfig({
      GROQ_API_KEY: "test-groq-key",
      GROQ_MODEL: "openai/gpt-oss-120b",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    }));
    service.recordUsage = async () => {};
    const result = await service.generateForLearning(makeReq(), "compact curriculum prompt", {
      jsonMode: true, maxOutputTokens: 1800,
    });
    assert.equal(result.provider, "gemini");
    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes("api.groq.com"));
    assert.ok(calls[1].includes("generativelanguage.googleapis.com"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Gemini retries a transient 503 before returning a curriculum response", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes("api.groq.com")) {
      return new Response(JSON.stringify({ error: { message: "daily quota exhausted" } }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
    if (calls.filter(value => value.includes("generativelanguage.googleapis.com")).length === 1) {
      return new Response(JSON.stringify({ error: { message: "temporarily unavailable" } }), {
        status: 503, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "{\\"days\\":[]}" }] }, finishReason: "STOP" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const service = new AiService(makeConfig({
      GROQ_API_KEY: "test-groq-key",
      GROQ_MODEL: "openai/gpt-oss-120b",
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    }));
    service.recordUsage = async () => {};
    const result = await service.generateForLearning(makeReq(), "compact curriculum prompt", {
      jsonMode: true, maxOutputTokens: 1800,
    });
    assert.equal(result.provider, "gemini");
    assert.equal(calls.length, 3);
    assert.equal(calls.filter(value => value.includes("generativelanguage.googleapis.com")).length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
