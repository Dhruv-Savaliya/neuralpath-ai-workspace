const test = require("node:test");
const assert = require("node:assert/strict");
const { AiService } = require("../dist/ai/ai.service.js");

function makeRequest() {
  const calls = [];
  return {
    user: { id: "learner-1" },
    calls,
    supabase: {
      async rpc(name, args) {
        calls.push({ name, args });
        if (name === "match_knowledge_chunks") {
          return {
            data: [{
              id: "chunk-1",
              source_title: "Vector Search Notes",
              source_url: null,
              content: "Hybrid search combines semantic and lexical retrieval.",
              similarity: 0.84,
            }],
            error: null,
          };
        }
        if (name === "save_ai_exchange") return { data: "conversation-1", error: null };
        return { data: true, error: null };
      },
    },
  };
}

function makeService() {
  const service = new AiService({ get: () => undefined });
  service.embed = async (_req, texts) => texts.map(() => Array(1024).fill(0.01));
  service.generate = async () => ({ answer: "Hybrid search combines both methods [S1].", provider: "groq", model: "test-model" });
  service.generateStreaming = async (_req, _prompt, _signal, onToken) => {
    const answer = "Hybrid search combines both methods [S1].";
    onToken(answer);
    return { answer, provider: "groq", model: "test-model" };
  };
  service.recordUsage = async () => {};
  return service;
}

test("non-streaming tutor retrieval passes the learner question to hybrid search", async () => {
  const service = makeService();
  const req = makeRequest();
  const question = "How does hybrid search improve retrieval?";
  await service.chat(req, { question });
  const call = req.calls.find(item => item.name === "match_knowledge_chunks");
  assert.equal(call.args.query_text, question);
});

test("streaming tutor retrieval passes the learner question to hybrid search", async () => {
  const service = makeService();
  const req = makeRequest();
  const question = "Explain exact-term matching in RAG.";
  await service.streamChat(req, { question }, new AbortController().signal, () => {});
  const call = req.calls.find(item => item.name === "match_knowledge_chunks");
  assert.equal(call.args.query_text, question);
});
