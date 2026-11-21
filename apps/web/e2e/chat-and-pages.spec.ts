import { test, expect } from "@playwright/test";

test.describe("Marketing & Auth Pages E2E", () => {
  test("homepage loads with correct hero and metadata", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/NeuralPath/i);
    const heading = page.locator("h1");
    await expect(heading).toContainText("Your AI tutor");
    await expect(heading).toContainText("for every subject");
    await expect(page.locator("a[href='/auth/sign-up']").first()).toBeVisible();
    await expect(page.locator("a[href='/features']").first()).toBeVisible();
  });

  test("FAQ and contact pages display correct, up-to-date content", async ({ page }) => {
    // 1. FAQ content
    await page.goto("/faq");
    await expect(page).toHaveTitle(/Frequently Asked Questions/i);
    const faqBody = page.locator("main");
    await expect(faqBody).toContainText("Enter a public HTTPS webpage URL and NeuralPath will fetch, clean and embed its content");
    await expect(faqBody).toContainText("upload PDF and DOCX documents directly");

    // 2. Contact content
    await page.goto("/contact");
    await expect(page).toHaveTitle(/Contact NeuralPath/i);
    const mailtoLink = page.locator("a[href^='mailto:support@neuralpath.app']");
    await expect(mailtoLink).toBeVisible();
    await expect(mailtoLink).toContainText("support@neuralpath.app");
    const githubLink = page.locator("a[href*='github.com/Dhruv-Savaliya/neuralpath-ai-workspace']");
    await expect(githubLink).toBeVisible();
  });

  test("sign-in page links directly to forgot-password", async ({ page }) => {
    await page.goto("/auth/sign-in");
    const forgotLink = page.locator("a[href='/auth/forgot-password']");
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toContainText(/Forgot (?:your )?password\?/i);
  });
});

test.describe("Dashboard AI Chat Markdown Rendering E2E", () => {
  test("chat renders Markdown including code blocks, tables, bold text, and citations", async ({ page, context }) => {
    // Add mock test auth cookie to bypass auth middleware
    await context.addCookies([
      {
        name: "np-e2e-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);

    // Mock dashboard APIs
    await page.route("**/api/v1/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            id: "test-user-id",
            display_name: "Test Learner",
            profession: "Software Engineer",
            experience_level: "intermediate",
            interests: ["AI", "TypeScript"],
            timezone: "UTC",
          },
          goals: [
            {
              id: "goal-1",
              title: "Master AI Engineering",
              category: "AI",
              desired_outcome: "Build production apps",
              current_level: "intermediate",
              target_date: null,
              status: "active",
              paths: [],
            },
          ],
          paths: [
            {
              id: "path-1",
              goal_id: "goal-1",
              title: "AI Engineer Roadmap",
              status: "active",
              items: [
                {
                  id: "item-1",
                  path_id: "path-1",
                  title: "Day 1: Intro",
                  description: "Introduction to RRF",
                  position: 0,
                  status: "completed",
                },
              ],
            },
          ],
          stats: {
            totalGoals: 1,
            activeGoals: 1,
            totalPaths: 1,
            totalItems: 1,
            completedItems: 1,
            progressPercent: 100,
            completedThisWeek: 1,
            completedDays: 1,
            currentStreak: 1,
            xp: 50,
          },
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
          learner: {
            displayName: "Test Learner",
            experienceLevel: "intermediate",
            interests: ["AI"],
            timezone: "UTC",
          },
          preferences: {
            learning_formats: ["projects"],
            learning_pace: "balanced",
            weekly_minutes: 120,
            language_code: "en",
            preferred_days: [1, 2, 3],
          },
          goals: {
            activeCount: 1,
            totalCount: 1,
            primaryGoal: "Master AI Engineering",
            categoryDistribution: { AI: 1 },
            targetDates: [],
            weeklyMinutes: 120,
          },
          roadmap: {
            pathId: "path-1",
            title: "AI Engineer Roadmap",
            completedTasks: 1,
            totalTasks: 1,
            progressPercent: 100,
            nextTasks: [],
            phases: [],
          },
          activity: {
            completedLast7Days: 1,
            completedLast30Days: 1,
            currentStreak: 1,
            lastCompletedAt: Date.now(),
            weekly: [{ weekStart: "2026-11-17", completedTasks: 1 }],
          },
          emptyState: { needsGoal: false, needsRoadmap: false, needsProgress: false },
        }),
      });
    });

    await page.route("**/api/v1/ai/knowledge", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sources: [] }),
      });
    });

    await page.route("**/api/v1/ai/conversations", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ conversations: [] }),
      });
    });

    // Mock SSE chat stream endpoint returning Markdown
    await page.route("**/api/v1/ai/chat/stream", async (route) => {
      const markdownPayload = [
        "### Concept Explanation",
        "",
        "Reciprocal Rank Fusion (**RRF**) blends lexical and dense vector scores:",
        "",
        "```python",
        "def rrf_score(rank_vec, rank_lex, k=60):",
        "    return 1.0 / (k + rank_vec) + 1.0 / (k + rank_lex)",
        "```",
        "",
        "| Technique | Precision | Latency |",
        "| :--- | :--- | :--- |",
        "| Vector | High | ~45ms |",
        "| Hybrid RRF | Peak | ~60ms |",
        "",
        "Cited from documentation [S1].",
      ].join("\n");

      const sseBody = [
        `event: token\ndata: ${JSON.stringify({ content: markdownPayload })}\n\n`,
        `event: done\ndata: ${JSON.stringify({
          answer: markdownPayload,
          conversation_id: "test-conv-123",
          provider: "groq",
          model: "openai/gpt-oss-120b",
          sources: [
            {
              citation: "S1",
              title: "NeuralPath Knowledge Base",
              url: null,
              visibility: "public",
              similarity: 0.94,
            },
          ],
        })}\n\n`,
      ].join("");

      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: sseBody,
      });
    });

    await page.goto("/dashboard");

    // Click into AI tutor tab
    const aiTabButton = page.locator("button", { hasText: /AI tutor & library/i });
    await expect(aiTabButton).toBeVisible();
    await aiTabButton.click();

    // Fill in question and send
    const questionInput = page.locator("#neuralpath-ai-question");
    await expect(questionInput).toBeVisible();
    await questionInput.fill("Explain RRF hybrid search");

    const sendButton = page.locator("button:has-text('Ask NeuralPath')");
    await sendButton.click();

    // Verify Markdown elements in assistant response
    const assistantMessage = page.locator("article").filter({ hasText: /Reciprocal Rank Fusion/ });
    await expect(assistantMessage).toBeVisible();

    // 1. Heading
    await expect(assistantMessage.locator("h3")).toHaveText("Concept Explanation");

    // 2. Strong / Bold
    await expect(assistantMessage.locator("strong")).toHaveText("RRF");

    // 3. Code block & syntax block
    const codeBlock = assistantMessage.locator("pre code");
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText("def rrf_score");

    // 4. Code copy button
    const copyButton = assistantMessage.locator("button[aria-label='Copy code']");
    await expect(copyButton).toBeVisible();

    // 5. Table
    const table = assistantMessage.locator("table");
    await expect(table).toBeVisible();
    await expect(table.locator("th").first()).toHaveText("Technique");
    await expect(table.locator("td").filter({ hasText: "Hybrid RRF" })).toBeVisible();

    // 6. Source citation badge (NeuralPath library)
    const citationBadge = assistantMessage.locator("span", { hasText: /NeuralPath library/i });
    await expect(citationBadge).toBeVisible();
  });
});
