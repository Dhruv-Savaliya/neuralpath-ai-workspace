const test = require("node:test");
const assert = require("node:assert/strict");
const { LearningService } = require("../dist/learning/learning.service.js");

function makeDb(responses) {
  const calls = [];
  return {
    calls,
    from(table) {
      const query = {
        table,
        operation: "select",
        filters: [],
        select(value) { calls.push({ table, method: "select", value }); return this; },
        eq(column, value) { this.filters.push([column, value]); calls.push({ table, method: "eq", column, value }); return this; },
        order() { return this; },
        limit() { return this; },
        gt() { return this; },
        is() { return this; },
        neq() { return this; },
        insert(value) { this.operation = "insert"; this.value = value; return this; },
        update(value) { this.operation = "update"; this.value = value; return this; },
        maybeSingle: async () => responses[table] ?? { data: null, error: null },
        single: async () => responses[table] ?? { data: { id: "saved-recommendation" }, error: null },
        then(resolve, reject) { return Promise.resolve(responses[table] ?? { data: [], error: null }).then(resolve, reject); },
      };
      return query;
    },
  };
}

function learnerRequest(db) {
  return { user: { id: "learner-a" }, supabase: db };
}

function contextData() {
  return {
    profiles: { data: { display_name: "Learner A", timezone: "Asia/Kolkata", experience_level: "beginner", interests: ["AI"] }, error: null },
    learner_preferences: { data: { learning_formats: ["projects"], learning_pace: "balanced", weekly_minutes: 240, language_code: "en", preferred_days: [1, 2, 3] }, error: null },
    learning_goals: { data: [{ id: "goal-a", title: "Learn AI", category: "AI", status: "active", priority: 1, target_date: null, weekly_minutes: 240 }], error: null },
    learning_paths: { data: [{ id: "path-a", title: "AI Engineer Roadmap", status: "active", goal_id: "goal-a" }], error: null },
    learning_path_items: { data: [
      { id: "task-a", path_id: "path-a", title: "Day 1: Python basics", description: "Learn Python", position: 0, status: "completed" },
      { id: "task-b", path_id: "path-a", title: "Day 1: Variables", description: "Practice variables", position: 1, status: "not_started" },
    ], error: null },
    learning_progress: { data: [
      { path_item_id: "task-a", status: "completed", completed_at: new Date().toISOString(), reflection: "Practiced Python." },
    ], error: null },
  };
}

test("getInsights derives phase, activity and weekly metrics from the authenticated learner's rows", async () => {
  const db = makeDb(contextData());
  const service = new LearningService({ generateForLearning: async () => { throw new Error("not used"); } });
  const result = await service.getInsights(learnerRequest(db));

  assert.equal(result.dataSource, "supabase");
  assert.equal(result.learner.displayName, "Learner A");
  assert.equal(result.roadmap.pathId, "path-a");
  assert.equal(result.roadmap.totalTasks, 2);
  assert.equal(result.roadmap.completedTasks, 1);
  assert.equal(result.roadmap.progressPercent, 50);
  assert.equal(result.roadmap.nextTasks[0].id, "task-b");
  assert.equal(result.activity.completedLast7Days, 1);
  assert.equal(result.activity.currentStreak, 1);
  assert.equal(result.activity.weekly.length, 6);
  assert.ok(db.calls.some(call => call.table === "learning_progress" && call.method === "eq" && call.column === "user_id" && call.value === "learner-a"));
  assert.ok(db.calls.some(call => call.table === "learning_path_items" && call.method === "eq" && call.column === "user_id" && call.value === "learner-a"));
});

test("getRecommendations uses deterministic owned-task fallback when the AI provider is unavailable", async () => {
  const responses = {
    ...contextData(),
    learning_recommendations: { data: null, error: null },
  };
  const db = makeDb(responses);
  const service = new LearningService({ generateForLearning: async () => { throw new Error("provider unavailable"); } });
  const result = await service.getRecommendations(learnerRequest(db));

  assert.equal(result.source, "deterministic");
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].taskId, "task-b");
  assert.match(result.recommendations[0].reason, /saved roadmap/);
  assert.ok(db.calls.some(call => call.table === "learning_path_items" && call.method === "eq" && call.column === "user_id" && call.value === "learner-a"));
});

test("getRecommendations rejects model-invented candidate identifiers and falls back safely", async () => {
  const responses = {
    ...contextData(),
    learning_recommendations: { data: null, error: null },
  };
  const db = makeDb(responses);
  const service = new LearningService({
    generateForLearning: async () => ({
      provider: "gemini",
      model: "test-model",
      answer: JSON.stringify({ recommendations: [
        { candidateId: "task:someone-elses-id", reason: "Do this invented task.", priority: 1 },
      ] }),
    }),
  });
  const result = await service.getRecommendations(learnerRequest(db));

  assert.equal(result.source, "deterministic");
  assert.equal(result.recommendations[0].taskId, "task-b");
});
