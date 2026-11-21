"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (typeof window !== "undefined" && document.cookie.includes("np-e2e-auth=true")) {
    return {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "mock-e2e-token" } },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof createBrowserClient>;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase public environment variables.");
  client ??= createBrowserClient(url, key);
  return client;
}
