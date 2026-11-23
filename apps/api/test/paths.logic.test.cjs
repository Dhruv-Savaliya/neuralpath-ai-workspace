const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyProjectDomain, buildAdaptiveCurriculumPrompt } = require("../dist/paths/paths.logic.js");

test("classifies software and AI goals as technical", () => {
  assert.equal(classifyProjectDomain({ title: "Learn Python", category: "Technology", desired_outcome: "Build an AI application" }), "technical");
});

test("classifies audio production independently from learning formats", () => {
  assert.equal(classifyProjectDomain({ title: "Produce a podcast", category: "Audio", desired_outcome: "Record and mix episodes" }), "audio");
});

test("classifies video production goals", () => {
  assert.equal(classifyProjectDomain({ title: "Learn video editing", category: "Media" }), "video");
});

test("classifies creative design goals", () => {
  assert.equal(classifyProjectDomain({ title: "Become a graphic designer", category: "Creative" }), "creative");
});

test("classifies business goals", () => {
  assert.equal(classifyProjectDomain({ title: "Start a small business", category: "Business", desired_outcome: "Launch a profitable local business" }), "business");
});

test("classifies academic goals", () => {
  assert.equal(classifyProjectDomain({ title: "Prepare for mathematics exams", category: "Academic" }), "academic");
});

test("uses other for unknown goals rather than assuming a profession", () => {
  assert.equal(classifyProjectDomain({ title: "Build confidence", category: "Personal development" }), "other");
});

test("domain prompt remains separate from learning format preferences", () => {
  const prompt = buildAdaptiveCurriculumPrompt({
    goal: { title: "Learn Python", category: "Technology", desired_outcome: "Build a CLI tool", current_level: "beginner", weekly_minutes: 240 },
    profile: { profession: "student", experience_level: "beginner", interests: ["music"] },
    preferences: { learning_formats: ["video"], learning_pace: "balanced", weekly_minutes: 240, language_code: "en", preferred_days: [1, 3] },
    domain: "technical", startDay: 1, endDay: 3, previousSummary: "",
  });
  assert.match(prompt, /project domain controls the subject matter/);
  assert.match(prompt, /TECHNICAL TEACHING MODE/);
  assert.match(prompt, /"learningFormats":\["video"\]/);
  assert.doesNotMatch(prompt, /VIDEO PRODUCTION MODE/);
});

test("audio and video prompt guidance stays concise and workflow-oriented", () => {
  const base = {
    goal: { title: "Create a podcast", category: "Audio" },
    profile: {},
    preferences: { learning_formats: [], learning_pace: "balanced", weekly_minutes: 180, language_code: "en", preferred_days: [] },
    startDay: 1, endDay: 3, previousSummary: "",
  };
  assert.match(buildAdaptiveCurriculumPrompt({ ...base, domain: "audio" }), /AUDIO PRODUCTION MODE/);
  assert.match(buildAdaptiveCurriculumPrompt({ ...base, domain: "video" }), /VIDEO PRODUCTION MODE/);
});
