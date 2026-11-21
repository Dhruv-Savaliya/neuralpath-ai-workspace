import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Axe Audits (OPEN-14)", () => {
  const marketingRoutes = [
    "/",
    "/features",
    "/how-it-works",
    "/about",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
  ];

  for (const route of marketingRoutes) {
    test(`axe audit marketing route: ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const seriousOrCritical = accessibilityScanResults.violations.filter(
        v => v.impact === "serious" || v.impact === "critical"
      );

      expect(seriousOrCritical, `Route ${route} has critical/serious accessibility violations: ${JSON.stringify(seriousOrCritical, null, 2)}`).toEqual([]);
    });
  }

  const authRoutes = [
    "/auth/sign-in",
    "/auth/sign-up",
    "/auth/forgot-password",
  ];

  for (const route of authRoutes) {
    test(`axe audit auth route: ${route}`, async ({ page }) => {
      await page.goto(route);
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const seriousOrCritical = accessibilityScanResults.violations.filter(
        v => v.impact === "serious" || v.impact === "critical"
      );

      expect(seriousOrCritical, `Route ${route} has critical/serious accessibility violations: ${JSON.stringify(seriousOrCritical, null, 2)}`).toEqual([]);
    });
  }

  test("axe audit dashboard route: /dashboard", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "np-e2e-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.route("**/api/v1/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: { id: "test-user-id", display_name: "Test Learner", experience_level: "intermediate" },
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
          learner: { displayName: "Test Learner", experienceLevel: "intermediate", interests: ["AI"], timezone: "UTC" },
          preferences: { learning_formats: ["projects"], learning_pace: "balanced", weekly_minutes: 120, language_code: "en", preferred_days: [1, 2, 3] },
          goals: { activeCount: 1, totalCount: 1, primaryGoal: "Master AI Engineering", categoryDistribution: { AI: 1 }, targetDates: [], weeklyMinutes: 120 },
          roadmap: { pathId: "path-1", title: "AI Engineer Roadmap", completedTasks: 1, totalTasks: 1, progressPercent: 100, nextTasks: [], phases: [] },
          activity: { completedLast7Days: 1, completedLast30Days: 1, currentStreak: 1, lastCompletedAt: Date.now(), weekly: [{ weekStart: "2026-11-17", completedTasks: 1 }] },
          emptyState: { needsGoal: false, needsRoadmap: false, needsProgress: false },
        }),
      });
    });

    await page.goto("/dashboard");
    await page.waitForSelector(".np-shell");
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const seriousOrCritical = accessibilityScanResults.violations.filter(
      v => v.impact === "serious" || v.impact === "critical"
    );

    expect(seriousOrCritical, `Route /dashboard has critical/serious accessibility violations: ${JSON.stringify(seriousOrCritical, null, 2)}`).toEqual([]);
  });
});
