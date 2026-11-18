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
