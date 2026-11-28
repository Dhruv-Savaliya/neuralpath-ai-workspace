import { expect, test } from "@playwright/test";
import { signInLearner } from "./support/learner";

test("private pages require a session", async ({ page }) => {
  for (const path of ["/dashboard", "/onboarding"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp("/auth/sign-in\\?next="));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick up");
  }
});

test("a delayed activity request leaves the workspace usable and a failed request can be retried", async ({ page }) => {
  const profile = { id: "learner", display_name: "Alex", profession: "student", experience_level: "beginner", interests: [], timezone: "UTC" };
  const path = { id: "path", goal_id: "goal", title: "Algebra roadmap", status: "active", items: [{ id: "item", title: "Linear equations", description: "Solve for x.", position: 0, status: "not_started" }] };
  const goal = { id: "goal", title: "Study algebra", category: "Math", paths: [path], status: "active" };
  let dashboardReads = 0;
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/dashboard", async route => {
    dashboardReads++;
    await route.fulfill({ json: { profile, goals: [goal], paths: [path], stats: { totalGoals: 1, totalPaths: 1 } } });
  });
  let activityReads = 0;
  await page.route("**/api/v1/learning/insights", async route => {
    activityReads++;
    if (activityReads === 1) {
      await delayed;
      return route.fulfill({ status: 503, json: {} });
    }
    await route.fulfill({ json: { activity: { weekly: [] }, preferences: null } });
  });
  await page.route("**/api/v1/profile", async route => {
    expect(route.request().method()).toBe("PATCH");
    Object.assign(profile, route.request().postDataJSON());
    await route.fulfill({ json: profile });
  });
  await signInLearner(page);
  try {
    await expect(page.getByRole("heading", { name: /Welcome back, Alex/ })).toBeVisible();
    await expect(page.getByText("Loading weekly activity...")).toBeVisible();
  } finally { release(); }
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Your activity will appear here")).toBeVisible();
  await page.getByRole("button", { name: /Learning goals/ }).first().click();
  await page.getByRole("button", { name: "Open 45-day path" }).click();
  await expect(page.getByRole("navigation").getByRole("button", { name: "Learning path", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "My profile", exact: true }).click();
  await page.getByLabel("Display name").fill("Robin");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("updated");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Welcome back, Robin/ })).toBeVisible();
  expect(dashboardReads).toBe(1);
  expect(activityReads).toBe(2);
  for (const width of [320, 375, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("a new learner signs in, completes onboarding, and signs out", async ({ page }) => {
  await page.route("**/api/v1/dashboard", route => route.fulfill({ json: { profile: null, goals: [], paths: [], stats: {} } }));
  await page.route("**/api/v1/learning/insights", route => route.fulfill({ json: { activity: { weekly: [] }, preferences: null } }));
  // Verify this build trusts the local fixture before submitting test credentials.
  await signInLearner(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().clearCookies();
  await page.goto("/auth/sign-in?next=/dashboard&next=/onboarding");
  await page.getByLabel("Email address").fill("new@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-fixture");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.reload();
  await page.locator("label.choice-option").filter({ hasText: "Technology" }).click();
  await page.locator('input[name="goal_title"]').fill("Learn linear algebra");
  await page.getByRole("button", { name: /Save profile/ }).click();
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test("mobile menu supports keyboard dismissal and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
