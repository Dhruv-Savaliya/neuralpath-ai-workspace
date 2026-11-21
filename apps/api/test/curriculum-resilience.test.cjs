const test = require("node:test");
const assert = require("node:assert/strict");
const { PathsService } = require("../dist/paths/paths.service.js");
const { AiService } = require("../dist/ai/ai.service.js");
const { ServiceUnavailableException } = require("@nestjs/common");

function createMockBatch(startDay = 1, count = 3) {
  return {
    days: Array.from({ length: count }, (_, index) => ({
      day: startDay + index,
      title: `Day ${startDay + index} Foundations`,
      focus: `Focus area for day ${startDay + index}`,
      tasks: [
        { title: "Lesson 1", description: "Learn key architectural concept.", item_type: "lesson" },
        { title: "Exercise 1", description: "Implement test verification.", item_type: "exercise" },
        { title: "Resource 1", description: "Read official documentation.", item_type: "resource" },
        { title: "Project 1", description: "Deliver working milestone.", item_type: "project" },
      ],
    })),
  };
}

// (a) Groq token-limit error then retry succeeds
test("resilience (a): Groq token-limit error triggers fallback and retry succeeds", async () => {
  let batchCalls = 0;
  let firstAttemptFailed = false;

  const aiMock = {
    async generateForLearning(_req, prompt, options) {
      batchCalls += 1;
      const match = prompt.match(/Generate exactly days (\d+) through (\d+)/);
      const start = match ? parseInt(match[1], 10) : 1;
      const end = match ? parseInt(match[2], 10) : 3;
      const count = end - start + 1;

      if (!firstAttemptFailed) {
        firstAttemptFailed = true;
        // First attempt simulates Groq hitting the token ceiling (HTTP 502)
        const err = new Error("Groq output reached its token limit.");
        err.status = 502;
        throw err;
      }

      // Retry attempt succeeds
      return {
        answer: JSON.stringify(createMockBatch(start, count)),
        provider: "gemini",
        model: "gemini-3.8-flash",
      };
    },
  };

  const service = new PathsService(aiMock);
  const goal = { id: "goal-1", title: "Learn AI", category: "Technology", desired_outcome: "Build agents", current_level: "beginner", target_date: null, weekly_minutes: 300 };
  let savedItems = [];

  const db = {
    from(table) {
      if (table === "learning_goals") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: goal, error: null }) }) }) }) };
      if (table === "profiles") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "Learner", onboarding_completed: true }, error: null }) }) }) };
      if (table === "learner_preferences") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { learning_formats: ["reading"], learning_pace: "balanced" }, error: null }) }) }) };
      if (table === "learning_paths") return {
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: "path-1", title: "Learn AI" }, error: null }) }) }),
      };
      if (table === "learning_path_items") return {
        insert: (rows) => { savedItems = rows; return { select: async () => ({ data: savedItems.map((r, i) => ({ ...r, id: String(i + 1) })), error: null }) }; },
      };
      throw new Error("Unexpected table: " + table);
    },
  };

  const result = await service.bootstrap({ user: { id: "user-1" }, supabase: db }, { goal_id: "goal-1" });
  assert.ok(result);
  assert.equal(result.items.length, 180);
  assert.equal(firstAttemptFailed, true);
  // 15 batches with 1 failure on batch 1 means 16 calls total
  assert.equal(batchCalls, 16);
});

// (b) invalid JSON then repair/retry succeeds
test("resilience (b): invalid JSON with trailing commas and unclosed brackets repairs and parses cleanly", () => {
  const service = new PathsService({});
  const rawBatch = createMockBatch(1, 3);
  // Inject trailing comma and code fence
  const flawedJson = `\`\`\`json\n{\n  "days": [\n    ${JSON.stringify(rawBatch.days[0])},\n    ${JSON.stringify(rawBatch.days[1])},\n    ${JSON.stringify(rawBatch.days[2])},\n  ]\n}\n\`\`\``;

  const parsed = service.parseCurriculumBatch(flawedJson, 1, 3);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].day, 1);
  assert.equal(parsed[2].day, 3);
  assert.equal(parsed[0].tasks.length, 4);
});

// (c) Groq fails + Gemini 503 then retries then eventually a clean retryable error
test("resilience (c): all providers failing with 503 returns clean retryable ServiceUnavailableException without leaking secrets", async () => {
  const mockConfig = {
    get(key) {
      if (key === "GROQ_ENABLED") return "true";
      if (key === "GROQ_API_KEY") return "mock-groq-key";
      if (key === "GEMINI_API_KEY") return "mock-gemini-key";
      return undefined;
    },
  };
  const aiService = new AiService(mockConfig);

  // Mock global fetch to return 503 for all calls
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const mockReq = {
      user: { id: "test-user-c" },
      supabase: {
        rpc: async (name) => {
          if (name === "reserve_ai_generation") return { data: [{ allowed: true, reservation_id: "res-1" }], error: null };
          if (name === "release_ai_generation" || name === "complete_ai_generation") return { data: null, error: null };
          return { data: null, error: null };
        },
        from: () => ({ insert: async () => ({ error: null }) }),
      },
    };

    let caughtError;
    try {
      await aiService.generateForLearning(mockReq, "Test prompt");
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError instanceof ServiceUnavailableException);
    const resp = caughtError.getResponse();
    assert.equal(resp.code, "AI_PROVIDERS_TEMPORARILY_UNAVAILABLE");
    assert.match(resp.message, /temporarily busy/i);
    // Crucial check: verify no credentials or raw API keys leaked in error
    assert.ok(!JSON.stringify(resp).includes("mock-groq-key"));
    assert.ok(!JSON.stringify(resp).includes("mock-gemini-key"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// (d) a batch failure keeps earlier successful batches
test("resilience (d): a batch failure saves previously completed batches before throwing retryable error", async () => {
  let batchCalls = 0;
  const aiMock = {
    async generateForLearning() {
      batchCalls += 1;
      if (batchCalls === 1) {
        // First batch (days 1-3) succeeds
        return { answer: JSON.stringify(createMockBatch(1, 3)), provider: "groq", model: "test" };
      }
      // Second batch (days 4-6) fails on all attempts
      throw new ServiceUnavailableException("AI service unavailable");
    },
  };

  const service = new PathsService(aiMock);
  const goal = { id: "goal-resilience", title: "Public Speaking", category: "Communication", desired_outcome: "Deliver keynote", current_level: "beginner", target_date: null, weekly_minutes: 180 };
  let savedPath = null;
  let savedItems = [];

  const db = {
    from(table) {
      if (table === "learning_goals") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: goal, error: null }) }) }) }) };
      if (table === "profiles") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: "Speaker", onboarding_completed: true }, error: null }) }) }) };
      if (table === "learner_preferences") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { learning_formats: ["reading"], learning_pace: "balanced" }, error: null }) }) }) };
      if (table === "learning_paths") return {
        select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
        insert: (row) => {
          savedPath = { id: "saved-path-id", ...row };
          return { select: () => ({ single: async () => ({ data: savedPath, error: null }) }) };
        },
      };
      if (table === "learning_path_items") return {
        insert: (rows) => {
          savedItems.push(...rows);
          return { select: async () => ({ data: rows, error: null }) };
        },
      };
      throw new Error("Unexpected table: " + table);
    },
  };

  let caughtError;
  try {
    await service.bootstrap({ user: { id: "user-d" }, supabase: db }, { goal_id: goal.id });
  } catch (err) {
    caughtError = err;
  }

  assert.ok(caughtError instanceof ServiceUnavailableException);
  const resp = caughtError.getResponse();
  assert.equal(resp.code, "CURRICULUM_GENERATION_TEMPORARILY_UNAVAILABLE");
  assert.match(resp.message, /busy|saved/i);

  // Verify that the first 3 days (12 items) WERE persisted and NOT deleted
  assert.ok(savedPath !== null, "Partial learning path must be saved");
  assert.equal(savedPath.status, "in_progress");
  assert.equal(savedItems.length, 12, "All 12 items for days 1-3 must be saved in database");
  assert.equal(savedItems[0].title, "Day 1: Lesson 1");
  assert.equal(savedItems[11].title, "Day 3: Project 1");
});
