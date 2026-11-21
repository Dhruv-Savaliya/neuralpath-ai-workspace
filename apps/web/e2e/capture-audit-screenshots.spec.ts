import { test } from "@playwright/test";
import * as path from "node:path";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../../audit-artifacts/screenshots");

test.describe("Capture Audit Screenshots", () => {
  const viewports = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 375, height: 667 },
  ];

  const marketingRoutes = [
    { path: "/", filePrefix: "homepage" },
    { path: "/features", filePrefix: "features" },
    { path: "/how-it-works", filePrefix: "how-it-works" },
    { path: "/about", filePrefix: "about" },
    { path: "/faq", filePrefix: "faq" },
    { path: "/contact", filePrefix: "contact" },
    { path: "/privacy", filePrefix: "privacy" },
    { path: "/terms", filePrefix: "terms" },
  ];

  for (const route of marketingRoutes) {
    for (const vp of viewports) {
      test(`screenshot ${route.filePrefix} - ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${route.filePrefix}-${vp.name}.png`),
          fullPage: true,
        });
      });
    }
  }

  // JS Disabled verification for OPEN-02
  test("screenshot homepage - javascript disabled (OPEN-02)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "homepage-no-javascript.png"),
      fullPage: true,
    });
    await context.close();
  });

  const authRoutes = [
    { path: "/auth/sign-in", filePrefix: "auth-sign-in" },
    { path: "/auth/sign-up", filePrefix: "auth-sign-up" },
    { path: "/auth/forgot-password", filePrefix: "auth-forgot-password" },
  ];

  for (const route of authRoutes) {
    for (const vp of [viewports[0], viewports[2]]) {
      test(`screenshot ${route.filePrefix} - ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${route.filePrefix}-${vp.name}.png`),
          fullPage: true,
        });
      });
    }
  }

  // Dashboard & AI Tutor screenshots
  test("screenshot dashboard and ai-tutor markdown rendering", async ({ page, context }) => {
    await context.addCookies([
      { name: "np-e2e-auth", value: "true", domain: "localhost", path: "/" },
    ]);

    await page.route("**/api/v1/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: { id: "test-user-id", display_name: "Dhruv", experience_level: "intermediate" },
          goals: [{ id: "goal-1", title: "Master AI Engineering", status: "active" }],
          paths: [
            {
              id: "path-1",
              goal_id: "goal-1",
              title: "AI Engineer Roadmap",
              status: "active",
              items: [{ id: "item-1", path_id: "path-1", title: "Day 1: Intro", position: 0, status: "completed" }],
            },
          ],
          stats: { totalGoals: 1, activeGoals: 1, totalPaths: 1, completedItems: 1, xp: 120, streak: 3 },
        }),
      });
    });

    await page.route("**/api/v1/learning/insights", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          dataSource: "supabase",
          hasActivity: true,
          learner: { displayName: "Dhruv", experienceLevel: "intermediate", interests: ["AI"], timezone: "UTC" },
          preferences: { learning_formats: ["projects"], learning_pace: "balanced", weekly_minutes: 120, language_code: "en", preferred_days: [1, 2, 3] },
          goals: { activeCount: 1, totalCount: 1, primaryGoal: "Master AI Engineering", categoryDistribution: { AI: 1 }, targetDates: [], weeklyMinutes: 120 },
          roadmap: { pathId: "path-1", title: "AI Engineer Roadmap", completedTasks: 1, totalTasks: 1, progressPercent: 100, nextTasks: [], phases: [] },
          activity: { completedLast7Days: 1, completedLast30Days: 1, currentStreak: 3, lastCompletedAt: Date.now(), weekly: [{ weekStart: "2026-11-17", completedTasks: 1 }] },
          emptyState: { needsGoal: false, needsRoadmap: false, needsProgress: false },
        }),
      });
    });

    await page.route("**/api/v1/ai/knowledge", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sources: [
            {
              id: "src-1",
              title: "Neural Networks Architecture (PDF)",
              source_url: null,
              created_at: new Date().toISOString(),
              chunk_count: 8,
              visibility: "private",
            },
            {
              id: "src-2",
              title: "Python Data Structures (DOCX)",
              source_url: null,
              created_at: new Date().toISOString(),
              chunk_count: 5,
              visibility: "private",
            },
          ],
        }),
      });
    });

    await page.route("**/api/v1/ai/conversations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ conversations: [] }),
      });
    });

    await page.route("**/api/v1/ai/chat/stream", async (route) => {
      const markdownPayload = [
        "### Reciprocal Rank Fusion Architecture",
        "",
        "NeuralPath fuses dense embeddings with BM25 full-text rank scores via **RRF**:",
        "",
        "```python",
        "def calculate_rrf(vector_rank: int, fts_rank: int, k: int = 60) -> float:",
        "    \"\"\"Calculates reciprocal rank fusion with smoothing factor k.\"\"\"",
        "    return (1.0 / (k + vector_rank)) + (1.0 / (k + fts_rank))",
        "```",
        "",
        "| Engine | Model | Latency |",
        "| :--- | :--- | :--- |",
        "| Dense Vector | BAAI/bge-m3 | ~42ms |",
        "| Reranker | BAAI/bge-reranker-base | ~65ms |",
        "",
        "Mathematical formulation: $\\text{RRF}(d) = \\sum_{m \\in M} \\frac{1}{k + r_m(d)}$",
        "",
        "Validated with public library content [S1].",
      ].join("\n");

      const sseBody = [
        `event: token\ndata: ${JSON.stringify({ content: markdownPayload })}\n\n`,
        `event: done\ndata: ${JSON.stringify({
          answer: markdownPayload,
          conversation_id: "conv-demo-1",
          provider: "groq",
          model: "openai/gpt-oss-120b",
          sources: [
            {
              citation: "S1",
              title: "NeuralPath Standard Library",
              url: null,
              visibility: "public",
              similarity: 0.95,
            },
          ],
        })}\n\n`,
      ].join("");

      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: sseBody,
      });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");
    await page.waitForSelector(".np-shell");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-overview-desktop.png"),
      fullPage: true,
    });

    // Go to AI tutor tab
    const aiTabButton = page.locator("button", { hasText: /AI tutor & library/i });
    await aiTabButton.click();

    // Take screenshot of knowledge library & upload panel
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-ai-knowledge-library.png"),
      fullPage: true,
    });

    // Ask AI Tutor question
    const questionInput = page.locator("#neuralpath-ai-question");
    await questionInput.fill("How does RRF hybrid retrieval work?");
    const sendButton = page.locator("button:has-text('Ask NeuralPath')");
    await sendButton.click();

    await page.waitForSelector("article pre code");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "dashboard-ai-tutor-markdown-chat.png"),
      fullPage: true,
    });
  });
});
