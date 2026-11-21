const test = require("node:test");
const assert = require("node:assert/strict");
const { AiService } = require("../dist/ai/ai.service.js");

test("resource discovery returns podcast and GitHub results plus a safe YouTube search fallback", async () => {
  const service = new AiService({ get: () => undefined });
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("itunes.apple.com")) return new Response(JSON.stringify({ results: [{
      collectionName: "Learn Python Podcast", artistName: "Example Creator",
      collectionViewUrl: "https://podcasts.apple.com/podcast/example", artworkUrl100: "https://example.com/art.png",
      primaryGenreName: "Education",
    }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (target.includes("api.github.com/search/repositories")) return new Response(JSON.stringify({ items: [{
      full_name: "example/python-project", description: "A practical Python tutorial project",
      html_url: "https://github.com/example/python-project", stargazers_count: 1200, language: "Python",
    }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    throw new Error("Unexpected provider request");
  };
  try {
    const result = await service.discoverLearningResources("Python");
    assert.equal(result.topic, "Python");
    assert.equal(result.videos[0].provider, "YouTube");
    assert.equal(result.videos[0].verified, false);
    assert.match(result.videos[0].url, /youtube\.com\/results/);
    assert.equal(result.audio[0].title, "Learn Python Podcast");
    assert.equal(result.projects[0].title, "example/python-project");
    assert.equal(result.projects[0].stars, 1200);
    assert.equal(result.availability.videos, "search_link");
  } finally {
    global.fetch = originalFetch;
  }
});

test("resource discovery validates empty topics", async () => {
  const service = new AiService({ get: () => undefined });
  await assert.rejects(() => service.discoverLearningResources(" "), /learning topic/);
});

test("resource discovery isolates provider failures", async () => {
  const service = new AiService({ get: () => undefined });
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes("itunes.apple.com")) throw new Error("podcast provider down");
    if (String(url).includes("api.github.com")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
    throw new Error("unexpected");
  };
  try {
    const result = await service.discoverLearningResources("JavaScript");
    assert.deepEqual(result.audio, []);
    assert.equal(result.availability.audio, "unavailable");
    assert.equal(result.availability.projects, "live");
  } finally {
    global.fetch = originalFetch;
  }
});
