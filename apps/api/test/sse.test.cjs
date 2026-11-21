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
