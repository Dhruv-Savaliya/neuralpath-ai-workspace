import type { Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";

export async function signInLearner(page: Page) {
  const origin = new URL(process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000").origin;
  const client = createServerClient("http://127.0.0.1:54329", "local-test-key", {
    cookies: {
      getAll: () => [],
      setAll: async (items) => {
        await page.context().addCookies(items.map(({ name, value }) => ({ name, value, url: origin })));
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: "learner@example.test", password: "local-fixture" });
  if (error) throw error;
  await page.goto("/dashboard");
}
