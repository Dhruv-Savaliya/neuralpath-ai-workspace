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
  assert.throws(() => parser().parseCurriculumBatch(JSON.stringify(invalidType), 1, 5), /invalid or duplicate task type/);

  const outOfOrder = batch();
  outOfOrder.days[0].day = 2;
  assert.throws(() => parser().parseCurriculumBatch(JSON.stringify(outOfOrder), 1, 5), /day 1 is incomplete/);

  const duplicateType = batch();
  duplicateType.days[0].tasks[1].item_type = "lesson";
  assert.throws(() => parser().parseCurriculumBatch(JSON.stringify(duplicateType), 1, 5), /invalid or duplicate task type/);
});

test("bootstrap generates nine validated batches and persists exactly 180 ordered tasks", async () => {
  const goal = {
    id: "goal-1", title: "Start a small business", category: "Business",
    desired_outcome: "Launch a profitable local business", current_level: "beginner",
    target_date: null, weekly_minutes: 300,
  };
  const path = { id: "path-1", title: "Start a small business — 45-day learning path" };
  let insertedItems = [];
  let batchCalls = 0;
  let firstPrompt = "";

  const db = {
    from(table) {
      if (table === "learning_goals") {
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: goal, error: null }) };
      }
      if (table === "profiles") {
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { display_name: "Learner", profession: "founder", experience_level: "Beginner", interests: ["business", "marketing"], timezone: "Asia/Kolkata", onboarding_completed: true }, error: null }) };
      }
      if (table === "learner_preferences") {
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({
          data: { learning_formats: ["video", "hands_on_projects"], learning_pace: "intensive", weekly_minutes: 600, language_code: "en", preferred_days: [1, 2, 3] },
          error: null,
        }) };
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
      if (!firstPrompt) firstPrompt = _prompt;
      assert.equal(options.jsonMode, true);
      assert.equal(options.preferFallback, false);
      assert.equal(options.maxOutputTokens, 1800);
      batchCalls += 1;
      const start = (batchCalls - 1) * 3 + 1;
      return { answer: JSON.stringify(batch(start, 3)), provider: "gemini", model: "test-model" };
    },
  };
  const service = new PathsService(ai);
  const result = await service.bootstrap({ user: { id: "learner-1" }, supabase: db }, { goal_id: goal.id });

  assert.equal(batchCalls, 15);
  assert.match(firstPrompt, /founder/);
  assert.match(firstPrompt, /business/);
  assert.match(firstPrompt, /customer problems/);
  assert.match(firstPrompt, /Do not block broad but interpretable goals/);
  assert.match(firstPrompt, /intensive/);
  assert.match(firstPrompt, /hands_on_projects/);
  assert.match(firstPrompt, /universal learning and career curriculum architect/);
  assert.equal(result.items.length, 180);
  assert.equal(result.generation.days, 45);
  assert.equal(result.generation.tasks, 180);
  assert.equal(result.items[0].position, 0);
  assert.equal(result.items[179].position, 179);
  assert.equal(result.items[0].title.startsWith("Day 1:"), true);
  assert.equal(result.items[179].title.startsWith("Day 45:"), true);
});


test("bootstrap returns an existing populated roadmap without regeneration or progress overwrite", async () => {
  const savedItems = Array.from({ length: 8 }, (_, position) => ({
    id: `item-${position}`, path_id: "existing-path", position,
    title: `Day ${Math.floor(position / 4) + 1}: Existing task ${position + 1}`,
    description: "Previously saved learner content",
    status: position < 4 ? "completed" : "not_started",
  }));
  const existing = { id: "existing-path", title: "My existing roadmap", status: "active", items: savedItems };
  const db = {
    from(table) {
      const query = {
        select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
        maybeSingle: async () => {
          if (table === "learning_goals") return { data: { id: "goal-existing", title: "Learn design" }, error: null };
          if (table === "profiles") return { data: { onboarding_completed: true }, error: null };
          if (table === "learner_preferences") return { data: null, error: null };
          if (table === "learning_paths") return { data: existing, error: null };
          throw new Error("Unexpected maybeSingle table: " + table);
        },
      };
      return query;
    },
  };
  let aiCalls = 0;
  const service = new PathsService({ async generateForLearning() { aiCalls += 1; throw new Error("Must not regenerate"); } });
  const result = await service.bootstrap({ user: { id: "learner-existing" }, supabase: db }, { goal_id: "goal-existing" });
  assert.equal(aiCalls, 0);
  assert.equal(result.id, "existing-path");
  assert.equal(result.items.length, 8);
  assert.equal(result.items[0].status, "completed");
  assert.equal(result.items[0].description, "Previously saved learner content");
});


test("bootstrap resumes a valid partial roadmap from the next day without replacing saved items", async () => {
  const existingItems = Array.from({ length: 12 }, (_, position) => ({
    id: `saved-${position}`, path_id: "partial-path", position,
    title: `Day ${Math.floor(position / 4) + 1}: Saved task ${position + 1}`,
    description: "Preserve this learner task",
    item_type: ["lesson", "exercise", "resource", "project"][position % 4],
    status: position === 0 ? "completed" : "not_started",
  }));
  const existing = { id: "partial-path", title: "My learning path", status: "in_progress", items: existingItems };
  let inserted = [];
  let activation = null;
  const db = {
    from(table) {
      const q = {
        select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
        maybeSingle: async () => {
          if (table === "learning_goals") return { data: { id: "goal-partial", title: "Learn video editing", category: "Video", desired_outcome: "Publish a short film", current_level: "beginner", weekly_minutes: 240 }, error: null };
          if (table === "profiles") return { data: { onboarding_completed: true, experience_level: "beginner" }, error: null };
          if (table === "learner_preferences") return { data: { learning_formats: ["reading"], learning_pace: "balanced", weekly_minutes: 240, language_code: "en", preferred_days: [] }, error: null };
          if (table === "learning_paths") return { data: existing, error: null };
          throw new Error("Unexpected maybeSingle table: " + table);
        },
        insert(rows) {
          inserted = rows;
          return { select: async () => ({ data: rows.map((row, index) => ({ ...row, id: `new-${index}` })), error: null }) };
        },
        update(values) {
          return { eq() { return this; }, select() { return this; }, single: async () => {
            activation = values;
            return { data: { ...existing, ...values }, error: null };
          } };
        },
      };
      return q;
    },
  };
  let firstRequestedDay = null;
  const ai = {
    async generateForLearning(_req, prompt) {
      const match = prompt.match(/Generate exactly days (\d+) through (\d+)/);
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (firstRequestedDay === null) firstRequestedDay = start;
      return { answer: JSON.stringify(batch(start, end - start + 1)), provider: "gemini", model: "test" };
    },
  };
  const service = new PathsService(ai);
  const result = await service.bootstrap({ user: { id: "learner-partial" }, supabase: db }, { goal_id: "goal-partial" });
  assert.equal(firstRequestedDay, 4);
  assert.equal(inserted.length, 168);
  assert.equal(result.items.length, 180);
  assert.equal(result.items[0].status, "completed");
  assert.equal(result.items[0].description, "Preserve this learner task");
  assert.equal(activation.status, "active");
  assert.equal(result.generation.resumed, true);
});
