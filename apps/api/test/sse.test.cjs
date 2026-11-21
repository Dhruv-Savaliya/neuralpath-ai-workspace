const test = require("node:test");
const assert = require("node:assert/strict");
const { consumeSseStream } = require("../dist/ai/sse.js");

function streamFrom(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test("SSE parser handles fragmented frames and CRLF delimiters", async () => {
  const events = [];
  await consumeSseStream(streamFrom(["event: to", "ken\r", "\ndata: hel", "lo\r\n\r", "\n"]), undefined, event => events.push(event));
  assert.deepEqual(events, [{ event: "token", data: "hello" }]);
});

test("SSE parser joins multiple data lines and ignores comments", async () => {
  const events = [];
  await consumeSseStream(streamFrom([": heartbeat\n event: ignored\nevent: message\ndata: first\ndata: second\n\n"]), undefined, event => events.push(event));
  assert.deepEqual(events, [{ event: "message", data: "first\nsecond" }]);
});

test("SSE parser flushes a final unterminated event", async () => {
  const events = [];
  await consumeSseStream(streamFrom(["event: done\ndata: {\"ok\":true}"]), undefined, event => events.push(event));
  assert.deepEqual(events, [{ event: "done", data: "{\"ok\":true}" }]);
});

test("SSE parser ignores malformed JSON at the consumer boundary without losing later events", async () => {
  const events = [];
  await consumeSseStream(streamFrom(["event: token\ndata: {broken}\n\nevent: done\ndata: {\"ok\":true}\n\n"]), undefined, event => events.push(event));
  assert.equal(events.length, 2);
  assert.equal(events[0].data, "{broken}");
  assert.equal(JSON.parse(events[1].data).ok, true);
});

test("SSE parser rejects an already-aborted stream", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(consumeSseStream(streamFrom(["data: ignored\n\n"]), controller.signal, () => {}), { name: "AbortError" });
});

const { AiService } = require("../dist/ai/ai.service.js");

function makeStreamingRequest() {
  const calls = [];
  return {
    user: { id: "learner-a" },
    calls,
    supabase: {
      async rpc(name, args) {
        calls.push({ name, args });
        if (name === "reserve_ai_generation") {
          return { data: [{ allowed: true, reservation_id: `reservation-${args.p_provider}` }], error: null };
        }
        return { data: true, error: null };
      },
    },
  };
}

function makeConfig(values) {
  return { get(key) { return values[key]; } };
}

test("abort cancels the upstream reader and rejects the consumer", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const pending = consumeSseStream(body, controller.signal, () => {});
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(cancelled, true);
});

test("streaming does not fall back after the first provider token", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const tokens = [];
  global.fetch = async url => {
    calls.push(String(url));
    return new Response(
      'data: {"choices":[{"delta":{"content":"partial"}}]}\\n\\n',
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  };

  };
  try {
    const service = new AiService(makeConfig({
      GROQ_API_KEY: "groq-test",
      GEMINI_API_KEY: "gemini-test",
    }));
    service.recordUsage = async () => {};
    const req = makeStreamingRequest();
    await assert.rejects(
      service.generateStreaming(req, "prompt", new AbortController().signal, token => { tokens.push(token); throw new Error("client stream write failed"); }),
      /client stream write failed/,
    );
    assert.deepEqual(tokens, ["partial"]);
    assert.equal(calls.length, 1, "Gemini must not be called after partial Groq output");
    assert.ok(req.calls.some(call => call.name === "complete_ai_generation"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("streaming falls back to Gemini when Groq fails before emitting a token", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url));
    if (String(url).includes("api.groq.com")) {
      return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      'data: {"candidates":[{"content":{"parts":[{"text":"Gemini answer"}]}}]}\n\n',
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  };
  try {
    const service = new AiService(makeConfig({
      GROQ_API_KEY: "groq-test",
      GEMINI_API_KEY: "gemini-test",
    }));
    service.recordUsage = async () => {};
    const req = makeStreamingRequest();
    const result = await service.generateStreaming(req, "prompt", new AbortController().signal, () => {});
    assert.equal(result.provider, "gemini");
    assert.equal(result.answer, "Gemini answer");
    assert.equal(calls.length, 2);
    assert.ok(req.calls.some(call => call.name === "release_ai_generation" && call.args.p_reservation_id === "reservation-groq"));
    assert.ok(req.calls.some(call => call.name === "complete_ai_generation" && call.args.p_reservation_id === "reservation-gemini"));
  } finally {
    global.fetch = originalFetch;
  }
});
