const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  localDateKey,
  streakFromDates,
  countWithinDays,
  validateRankedRecommendations,
  fallbackRecommendations,
} = require("../dist/learning/learning.logic.js");

test("localDateKey respects learner timezone boundaries", () => {
  const instant = new Date("2026-11-18T02:00:00.000Z");
  assert.equal(localDateKey(instant, "Asia/Kolkata"), "2026-11-18");
  assert.equal(localDateKey(instant, "America/Los_Angeles"), "2026-11-17");
});

test("streak counts consecutive learner-local days and tolerates duplicate completions", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  assert.equal(streakFromDates([
    "2026-11-18T04:00:00.000Z",
    "2026-11-18T08:00:00.000Z",
    "2026-11-17T08:00:00.000Z",
    "2026-11-16T08:00:00.000Z",
  ], "Asia/Kolkata", now), 3);
});

test("streak continues from yesterday when there is no completion today", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  assert.equal(streakFromDates([
    "2026-11-17T08:00:00.000Z",
    "2026-11-16T08:00:00.000Z",
  ], "Asia/Kolkata", now), 2);
});

test("rolling activity excludes future and invalid timestamps", () => {
  const now = Date.parse("2026-11-18T12:00:00.000Z");
  assert.equal(countWithinDays([
    "2026-11-17T12:00:00.000Z",
    "2026-10-01T12:00:00.000Z",
    "2026-11-19T12:00:00.000Z",
    "not-a-date",
  ], 7, now), 1);
});

test("recommendation validator rejects invented task IDs and malformed output", () => {
  const candidates = [{
    candidateId: "task:owned",
    kind: "focus_task",
    taskId: "owned",
    goalId: "goal-owned",
    title: "Continue Python",
    actionValue: null,
    estimatedMinutes: 45,
  }];
  const valid = validateRankedRecommendations({ recommendations: [
    { candidateId: "task:owned", reason: "This is next.", priority: 1 },
    { candidateId: "task:invented", reason: "Invented task.", priority: 2 },
  ] }, candidates);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].taskId, "owned");
  assert.equal(validateRankedRecommendations({ recommendations: "bad" }, candidates).length, 0);
});

test("deterministic fallback only uses server-created candidates", () => {
  const result = fallbackRecommendations([{
    candidateId: "task:owned",
    kind: "focus_task",
    taskId: "owned",
    goalId: null,
    title: "Continue Python",
    actionValue: null,
    estimatedMinutes: 45,
  }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].taskId, "owned");
  assert.match(result[0].reason, /saved roadmap/);
});


const evaluationCases = JSON.parse(fs.readFileSync(
  path.join(__dirname, "fixtures", "learning-recommendation-evals.json"),
  "utf8",
));
for (const evaluation of evaluationCases) {
  test(`offline recommendation evaluation: ${evaluation.name}`, () => {
    const result = validateRankedRecommendations(evaluation.output, evaluation.candidates);
    assert.deepEqual(result.map(item => item.candidateId), evaluation.expectedCandidateIds);
  });
}
