const test = require("node:test");
const assert = require("node:assert/strict");
const { PathsService } = require("../dist/paths/paths.service.js");

function batch(startDay = 1, count = 5) {
  return {
    days: Array.from({ length: count }, (_, index) => ({
      day: startDay + index,
      title: `Day ${startDay + index} title`,
      focus: `Day ${startDay + index} focus`,
      tasks: Array.from({ length: 4 }, (_, taskIndex) => ({
        title: `Task ${taskIndex + 1}`,
        description: `Complete practical task ${taskIndex + 1} for day ${startDay + index}.`,
        item_type: ["lesson", "exercise", "resource", "project"][taskIndex],
      })),
    })),
  };
}

function parser() {
  return new PathsService({});
}

test("curriculum parser accepts a valid five-day batch", () => {
  const result = parser().parseCurriculumBatch(JSON.stringify(batch()), 1, 5);
  assert.equal(result.length, 5);
  assert.equal(result.reduce((sum, day) => sum + day.tasks.length, 0), 20);
});

test("curriculum parser extracts JSON from a fenced provider response", () => {
  const result = parser().parseCurriculumBatch(`\`\`json\n${JSON.stringify(batch(6, 5))}\n\`\``, 6, 10);
  assert.equal(result[0].day, 6);
  assert.equal(result.at(-1).day, 10);
});

test("curriculum parser extracts a complete JSON object surrounded by provider prose", () => {
  const result = parser().parseCurriculumBatch(`Here is your result:\n${JSON.stringify(batch(11, 5))}\nHope this helps.`, 11, 15);
  assert.equal(result.length, 5);
  assert.equal(result[0].day, 11);
});

test("curriculum parser rejects truncated JSON", () => {
  const truncated = JSON.stringify(batch()).slice(0, -12);
  assert.throws(() => parser().parseCurriculumBatch(truncated, 1, 5), /incomplete or invalid curriculum JSON/);
});

test("curriculum parser rejects missing days, task counts, invalid types and out-of-order days", () => {
  const missingDay = batch();
  missingDay.days.pop();
  assert.throws(() => parser().parseCurriculumBatch(JSON.stringify(missingDay), 1, 5), /exactly days 1-5/);

  const missingTask = batch();
  missingTask.days[0].tasks.pop();
  assert.throws(() => parser().parseCurriculumBatch(JSON.stringify(missingTask), 1, 5), /day 1 is incomplete/);

  const invalidType = batch();
  invalidType.days[0].tasks[0].item_type = "video";
  assert.throws(() => parser().parseCurriculumBatch(JSON.stringify(invalidType), 1, 5), /invalid task/);

  const outOfOrder = batch();
  outOfOrder.days[0].day = 2;
  assert.throws(() => parser().parseCurriculumBatch(JSON.stringify(outOfOrder), 1, 5), /day 1 is incomplete/);
});

test("bootstrap generates nine validated batches and persists exactly 180 ordered tasks", async () => {
  const goal = {
    id: "goal-1", title: "Learn full-stack development", category: "Technology",
    desired_outcome: "Build production apps", current_level: "Beginner",
    target_date: null, weekly_minutes: 300,
  };
  const path = { id: "path-1", title: "Full-stack development — 45-day personalized learning path" };
  let insertedItems = [];
  let batchCalls = 0;

  const db = {
    from(table) {
      if (table === "learning_goals") {
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: goal, error: null }) };
      }
      if (table === "profiles") {
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { profession: "Developer", experience_level: "Beginner", interests: ["web"] }, error: null }) };
      }
      if (table === "learning_paths") {
        return {
          select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
          maybeSingle: async () => ({ data: null, error: null }),
          insert() { return this; }, single: async () => ({ data: path, error: null }),
        };
      }
      if (table === "learning_path_items") {
        return {
          insert(rows) { insertedItems = rows; return this; },
          select: async () => ({ data: insertedItems.map((item, index) => ({ ...item, id: String(index + 1) })), error: null }),
        };
      }
      throw new Error("Unexpected table " + table);
    },
  };

  const ai = {
    async generateForLearning(_req, _prompt, options) {
      assert.equal(options.jsonMode, true);
      assert.equal(options.preferFallback, false);
      batchCalls += 1;
      const start = (batchCalls - 1) * 5 + 1;
      return { answer: JSON.stringify(batch(start, 5)), provider: "gemini", model: "test-model" };
    },
  };
  const service = new PathsService(ai);
  const result = await service.bootstrap({ user: { id: "learner-1" }, supabase: db }, { goal_id: goal.id });

  assert.equal(batchCalls, 9);
  assert.equal(result.items.length, 180);
  assert.equal(result.generation.days, 45);
  assert.equal(result.generation.tasks, 180);
  assert.equal(result.items[0].position, 0);
  assert.equal(result.items[179].position, 179);
  assert.equal(result.items[0].title.startsWith("Day 1:"), true);
  assert.equal(result.items[179].title.startsWith("Day 45:"), true);
});
